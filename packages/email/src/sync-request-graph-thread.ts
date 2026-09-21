/**
 * When opening a website-request Aanvraag (`req:`), pull the Graph conversation
 * into website_request_mail_messages so applicant replies appear in Gesprek.
 *
 * List-time ingest alone is not enough: detail often loads before the next list
 * refresh, and outbound identity may only exist after createReply/sendMail.
 *
 * Graph conversationId $filter can fail or an older thread can fall outside the
 * generic mailbox window. We therefore also query the mailbox for the request's
 * exact submitter from the request creation date. A bounded general scan remains
 * a fallback only when neither targeted lookup nor conversation lookup can help.
 *
 * Both paths then require `requestSubmitterIsParticipant`. Threading evidence
 * alone cannot separate "our reply on this request" from "our reply to another
 * customer" — both are From the shared mailbox — and a conversationId inherited
 * from an earlier mis-attribution would otherwise keep re-importing the foreign
 * thread on every detail open.
 */
import {
  getWebsiteRequest,
  listWebsiteRequestMailMessages,
  recordUnmatchedInboundMail,
  resolveUnmatchedInboundMail,
  upsertWebsiteRequestMailMessage,
} from "@mccoy/database/server";

import { isReplyOrForwardSubject } from "./form-mail-subject";
import { shouldAttemptGraphMail } from "./form-inbox-provider";
import { getGraphMailConfig } from "./graph-config";
import { websiteRequestMailEvidence } from "./graph-odata-filters";
import {
  normaliseInternetMessageId,
  requestSubmitterIsParticipant,
  textCitesRequestNumber,
  verifiedReplyParentBelongsToWebsiteRequest,
} from "./inquiry-thread-correlation";
import {
  classifyGraphThreadDirection,
  findGraphMessageByInternetMessageId,
  getGraphMessagePlainBody,
  getGraphReplyParentContext,
  getGraphMessageSyncMeta,
  isMcCoyWebsiteFormNotificationBySender,
  listGraphConversationSyncMessages,
  listGraphSenderSyncMessages,
  listRecentGraphSyncMessages,
  type GraphConversationSyncMessage,
} from "./graph-mail";
import { normaliseThreadMessageBody } from "./inquiry-thread-dedupe";

export type SyncWebsiteRequestGraphThreadResult = {
  appended: number;
  alreadyProcessed: number;
  conversationsChecked: number;
  targetedScanMatched: number;
  /** Submitter-scoped mail left alone because request-specific evidence was absent. */
  targetedScanRejected: number;
  recentScanMatched: number;
  /** Recent mailbox mail left alone because membership could not be proven. */
  recentScanRejected: number;
  /** Mail dropped because this request's submitter was not a participant. */
  participantRejected: number;
  verifiedParentMatched: number;
  verifiedParentRejected: number;
};

/** Per-request identity used to prove that mailbox mail belongs to this thread. */
type RequestThreadIdentity = {
  conversationIds: Set<string>;
  /** Normalised RFC Message-IDs of messages already correlated to this request. */
  messageIds: Set<string>;
};

function directionForPersist(
  msg: GraphConversationSyncMessage,
  mailbox: string,
  submitterEmail: string | null,
): "inbound" | "outbound" | "skip" {
  const direction = classifyGraphThreadDirection({
    fromAddress: msg.fromAddress,
    fromName: msg.fromName,
    subject: (msg.subject || "").trim() || "(geen onderwerp)",
    text: msg.textBody || msg.bodyPreview || "",
    inboxUser: mailbox,
    submitter: submitterEmail,
  });
  if (direction === "form") return "skip";
  return direction === "admin" ? "outbound" : "inbound";
}

async function persistSyncMessage(options: {
  requestId: string;
  mailbox: string;
  submitterEmail: string | null;
  msg: GraphConversationSyncMessage;
  conversationIdFallback?: string | null;
  /** Set only after verifiedReplyParentBelongsToWebsiteRequest succeeds. */
  verifiedReplyParent?: boolean;
  inReplyTo?: string | null;
  references?: readonly string[];
}): Promise<"appended" | "already_processed" | "skipped" | "foreign_participants"> {
  const direction = directionForPersist(options.msg, options.mailbox, options.submitterEmail);
  if (direction === "skip") return "skipped";

  // Deny by default, in both directions. A staff reply is From the shared
  // mailbox whichever customer it answers, so the sender cannot tell "our reply
  // on this request" from "our reply to another customer" — the recipient can.
  // This also stops an already mis-attributed conversationId from re-importing
  // the foreign thread on every detail open.
  if (
    !options.verifiedReplyParent &&
    !requestSubmitterIsParticipant(options.msg, options.submitterEmail)
  ) {
    return "foreign_participants";
  }

  let rawBody = options.msg.textBody || options.msg.bodyPreview || "";
  // Inbound bodyPreview often starts mid-quote of the McCoy template. Prefer full body.
  if (direction === "inbound" && options.msg.id) {
    const previewOnly =
      !options.msg.textBody ||
      options.msg.textBody === (options.msg.bodyPreview || "").trim() ||
      rawBody.length < 280;
    if (previewOnly) {
      const full = await getGraphMessagePlainBody(options.msg.id, options.mailbox);
      if (full && full.length > rawBody.length) rawBody = full;
    }
  }

  const upsert = await upsertWebsiteRequestMailMessage({
    requestId: options.requestId,
    direction,
    provider: "microsoft_graph",
    mailbox: options.mailbox,
    graphMessageId: options.msg.id,
    internetMessageId: options.msg.internetMessageId,
    conversationId: options.msg.conversationId ?? options.conversationIdFallback ?? null,
    inReplyTo: options.inReplyTo ?? null,
    referencesHeader: options.references?.join(" ") || null,
    senderAddress: options.msg.fromAddress,
    recipientAddresses:
      options.msg.toAddresses.length > 0
        ? options.msg.toAddresses
        : direction === "inbound"
          ? [options.mailbox]
          : options.submitterEmail
            ? [options.submitterEmail]
            : [],
    subject: options.msg.subject,
    bodyText: normaliseThreadMessageBody(rawBody, direction).slice(0, 20000),
    occurredAt: options.msg.receivedDateTime ?? new Date().toISOString(),
    isRead: options.msg.isRead,
  });

  if (upsert?.status === "appended") {
    if (options.msg.hasAttachments) {
      const { persistMailMessageGraphAttachments } =
        await import("./persist-mail-graph-attachments");
      await persistMailMessageGraphAttachments({
        mailMessageId: upsert.id,
        graphMessageId: options.msg.id,
        mailbox: options.mailbox,
      });
    }
    if (direction === "inbound") {
      const { notifyApplicantReplyAppended } = await import("./notify-applicant-reply");
      await notifyApplicantReplyAppended({
        requestId: options.requestId,
        mailMessageId: upsert.id,
        mailbox: options.mailbox,
        senderAddress: options.msg.fromAddress,
      });
    }
    return "appended";
  }
  if (upsert?.status === "already_processed") return "already_processed";
  return "skipped";
}

/**
 * Surface customer mail we refused to attach, so it is reviewable instead of
 * silently dropped. Our own Sent-Items copies are only counted: they already sit
 * in the thread of the request they really belong to, and the review queue is
 * for customer mail that reached nobody.
 */
async function queueForeignParticipantMail(options: {
  mailbox: string;
  msg: GraphConversationSyncMessage;
}): Promise<void> {
  const from = (options.msg.fromAddress || "").trim().toLowerCase();
  if (!from || from === options.mailbox) return;
  try {
    await recordUnmatchedInboundMail({
      mailbox: options.mailbox,
      provider: "microsoft_graph",
      graphMessageId: options.msg.id,
      internetMessageId: options.msg.internetMessageId,
      conversationId: options.msg.conversationId,
      senderAddress: options.msg.fromAddress,
      subject: options.msg.subject,
      reason: "unmatched",
      receivedAt: options.msg.receivedDateTime,
    });
  } catch (error) {
    console.error("[sync-request-graph-thread] unmatched record failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }
}

async function collectThreadIdentity(options: {
  requestId: string;
  mailbox: string;
  /** RFC Message-IDs of staff replies already sent for this request. */
  staffReplyIds: string[];
}): Promise<RequestThreadIdentity> {
  const conversationIds = new Set<string>();
  const messageIds = new Set<string>();
  const rows = await listWebsiteRequestMailMessages(options.requestId);

  for (const row of rows) {
    if (row.conversation_id?.trim()) {
      conversationIds.add(row.conversation_id.trim());
    }
    const normalised = normaliseInternetMessageId(row.internet_message_id);
    if (normalised) messageIds.add(normalised);
  }

  const graphIds = [
    ...new Set(
      rows.map((row) => row.graph_message_id?.trim()).filter((id): id is string => Boolean(id)),
    ),
  ];

  for (const graphId of graphIds.slice(0, 8)) {
    if (conversationIds.size >= 4) break;
    const meta = await getGraphMessageSyncMeta(graphId, options.mailbox);
    if (meta?.conversationId?.trim()) {
      conversationIds.add(meta.conversationId.trim());
    }
  }

  // Staff reply RFC ids belong to this thread even when mail rows lack Graph ids.
  const staffReplyIds = options.staffReplyIds;
  for (const id of staffReplyIds) {
    const normalised = normaliseInternetMessageId(id);
    if (normalised) messageIds.add(normalised);
  }

  // A form notification and the later staff response can have different Graph
  // conversation ids. Always resolve staff reply RFC ids; an existing form-root
  // conversation is not proof that we already know the customer-reply thread.
  const staffInternetIds = [...new Set(staffReplyIds)].slice(0, 6);
  for (const internetId of staffInternetIds) {
    const hit = await findGraphMessageByInternetMessageId(internetId, options.mailbox);
    if (hit?.conversationId?.trim()) {
      conversationIds.add(hit.conversationId.trim());
    }
  }

  return { conversationIds, messageIds };
}

export async function syncWebsiteRequestGraphThread(
  requestId: string,
): Promise<SyncWebsiteRequestGraphThreadResult> {
  const empty: SyncWebsiteRequestGraphThreadResult = {
    appended: 0,
    alreadyProcessed: 0,
    conversationsChecked: 0,
    targetedScanMatched: 0,
    targetedScanRejected: 0,
    recentScanMatched: 0,
    recentScanRejected: 0,
    participantRejected: 0,
    verifiedParentMatched: 0,
    verifiedParentRejected: 0,
  };

  if (!shouldAttemptGraphMail()) return empty;
  const config = getGraphMailConfig();
  const mailbox = (config?.mailbox || "").trim().toLowerCase();
  if (!mailbox || !requestId) return empty;

  const request = await getWebsiteRequest(requestId);
  if (!request) return empty;
  const submitterEmail = request.submitterEmail?.trim() || null;

  const staffReplyIds = [
    ...new Set(
      (request.replies ?? [])
        .map((reply) => reply.resendId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let identity: RequestThreadIdentity;
  try {
    identity = await collectThreadIdentity({
      requestId,
      mailbox,
      staffReplyIds,
    });
  } catch (error) {
    console.error("[sync-request-graph-thread] identity collect failed", {
      requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    identity = { conversationIds: new Set(), messageIds: new Set() };
  }
  const { conversationIds, messageIds } = identity;

  let appended = 0;
  let alreadyProcessed = 0;
  let conversationsChecked = 0;
  let targetedScanMatched = 0;
  let targetedScanRejected = 0;
  let recentScanMatched = 0;
  let recentScanRejected = 0;
  let participantRejected = 0;
  let verifiedParentMatched = 0;
  let verifiedParentRejected = 0;
  let conversationAccepted = 0;
  let conversationLookupFailed = false;
  let targetedLookupFailed = false;
  const seenGraphIds = new Set<string>();

  const persistVerifiedParentReply = async (
    msg: GraphConversationSyncMessage,
  ): Promise<{
    replyStatus: "appended" | "already_processed" | "skipped" | "foreign_participants";
    parentStatus: "appended" | "already_processed" | "skipped" | "foreign_participants";
  } | null> => {
    // Avoid two extra Graph reads for ordinary unrelated mail. A verified alias
    // reply must already cite this exact request and be shaped like a reply.
    if (
      !isReplyOrForwardSubject(msg.subject || "") ||
      !textCitesRequestNumber(request.number, msg.subject, msg.bodyPreview)
    ) {
      return null;
    }

    const context = await getGraphReplyParentContext(msg.id, mailbox);
    if (!context) {
      verifiedParentRejected += 1;
      return null;
    }
    if (
      !verifiedReplyParentBelongsToWebsiteRequest({
        mailbox,
        submitterEmail,
        requestNumber: request.number,
        inReplyTo: context.inReplyTo,
        reply: msg,
        parent: context.parent,
      })
    ) {
      verifiedParentRejected += 1;
      return null;
    }
    verifiedParentMatched += 1;

    // Persist the trusted outbound parent first. Besides preserving the actual
    // thread, its RFC id becomes durable proof for rendering this alias reply.
    const parentStatus = await persistSyncMessage({
      requestId,
      mailbox,
      submitterEmail,
      msg: context.parent,
    });
    const parentMessageId = normaliseInternetMessageId(context.parent.internetMessageId);
    if (parentMessageId) messageIds.add(parentMessageId);
    if (context.parent.conversationId?.trim()) {
      conversationIds.add(context.parent.conversationId.trim());
    }
    seenGraphIds.add(context.parent.id);

    const replyStatus = await persistSyncMessage({
      requestId,
      mailbox,
      submitterEmail,
      msg,
      verifiedReplyParent: true,
      inReplyTo: context.inReplyTo,
      references: context.references,
    });
    if (replyStatus === "appended" || replyStatus === "already_processed") {
      await resolveUnmatchedInboundMail({
        mailbox,
        graphMessageId: msg.id,
        internetMessageId: msg.internetMessageId,
      });
    }
    return { replyStatus, parentStatus };
  };

  const countPersistStatus = (
    status: "appended" | "already_processed" | "skipped" | "foreign_participants",
  ): void => {
    if (status === "appended") appended += 1;
    else if (status === "already_processed") alreadyProcessed += 1;
    else if (status === "foreign_participants") participantRejected += 1;
  };

  for (const conversationId of conversationIds) {
    conversationsChecked += 1;
    let messages: GraphConversationSyncMessage[] = [];
    try {
      messages = await listGraphConversationSyncMessages({
        conversationId,
        mailbox,
      });
    } catch (error) {
      conversationLookupFailed = true;
      console.error("[sync-request-graph-thread] conversation list failed", {
        requestId,
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
      continue;
    }

    for (const msg of messages) {
      if (seenGraphIds.has(msg.id)) continue;
      seenGraphIds.add(msg.id);
      const status = await persistSyncMessage({
        requestId,
        mailbox,
        submitterEmail,
        msg,
        conversationIdFallback: conversationId,
      });
      if (status === "appended") {
        appended += 1;
        conversationAccepted += 1;
      } else if (status === "already_processed") {
        alreadyProcessed += 1;
        conversationAccepted += 1;
      } else if (status === "foreign_participants") {
        const verified = await persistVerifiedParentReply(msg);
        if (verified) {
          countPersistStatus(verified.parentStatus);
          countPersistStatus(verified.replyStatus);
          seenGraphIds.add(msg.id);
          conversationAccepted += 1;
        } else {
          participantRejected += 1;
          await queueForeignParticipantMail({ mailbox, msg });
        }
      }
    }
  }

  const processEvidenceMessage = async (
    msg: GraphConversationSyncMessage,
    source: "targeted" | "recent",
  ): Promise<void> => {
    if (seenGraphIds.has(msg.id)) return;
    const evidence = websiteRequestMailEvidence({
      conversationId: msg.conversationId,
      knownConversationIds: conversationIds,
      knownMessageIds: messageIds,
      subject: msg.subject,
      bodyPreview: msg.bodyPreview,
      fromAddress: msg.fromAddress,
      submitterEmail,
      mailbox,
      requestNumber: request.number,
      isReplyOrForward: isReplyOrForwardSubject(msg.subject || ""),
      isMcCoySender: isMcCoyWebsiteFormNotificationBySender({
        fromName: msg.fromName,
        fromAddress: msg.fromAddress || "",
      }),
    });
    const directParticipant = requestSubmitterIsParticipant(msg, submitterEmail);
    if (!evidence || !directParticipant) {
      const verified = await persistVerifiedParentReply(msg);
      if (verified) {
        seenGraphIds.add(msg.id);
        if (source === "targeted") targetedScanMatched += 1;
        else recentScanMatched += 1;
        const normalisedId = normaliseInternetMessageId(msg.internetMessageId);
        if (normalisedId) messageIds.add(normalisedId);
        if (msg.conversationId?.trim()) conversationIds.add(msg.conversationId.trim());
        countPersistStatus(verified.parentStatus);
        countPersistStatus(verified.replyStatus);
        return;
      }

      if (!evidence) {
        if (source === "targeted") targetedScanRejected += 1;
        else recentScanRejected += 1;
        return;
      }
    }
    // Threading evidence can be satisfied by a value this request shares with
    // others; participation cannot. Check it before widening the identity sets,
    // so a rejected message never becomes tomorrow's "proof".
    if (!directParticipant) {
      participantRejected += 1;
      await queueForeignParticipantMail({ mailbox, msg });
      return;
    }

    seenGraphIds.add(msg.id);
    if (source === "targeted") targetedScanMatched += 1;
    else recentScanMatched += 1;
    // Widen the thread identity only from per-request proof, never from a
    // conversation we merely guessed — that is how foreign threads leaked in.
    if (evidence !== "conversation_id" && msg.conversationId?.trim()) {
      conversationIds.add(msg.conversationId.trim());
    }
    const normalisedId = normaliseInternetMessageId(msg.internetMessageId);
    if (normalisedId) messageIds.add(normalisedId);
    const status = await persistSyncMessage({
      requestId,
      mailbox,
      submitterEmail,
      msg,
    });
    if (status === "appended") appended += 1;
    else if (status === "already_processed") alreadyProcessed += 1;
    else if (status === "foreign_participants") participantRejected += 1;
  };

  // The generic latest-200 mailbox window can be exhausted quickly on a shared
  // mailbox. Query the exact submitter from request creation so older legitimate
  // replies remain recoverable without scanning unrelated customers.
  if (submitterEmail) {
    try {
      const targeted = await listGraphSenderSyncMessages({
        senderAddress: submitterEmail,
        receivedSince: request.createdAt,
        mailbox,
        top: 40,
      });
      for (const msg of targeted) {
        await processEvidenceMessage(msg, "targeted");
      }
    } catch (error) {
      targetedLookupFailed = true;
      console.error("[sync-request-graph-thread] targeted sender scan failed", {
        requestId,
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
    }
  }

  // Legacy fallback: a stored form-root or contaminated conversation id must
  // not suppress discovery. Scan only when the narrower paths failed or no
  // conversation produced a request-owned message and the sender scan found
  // nothing. The per-message proof below still rejects unrelated mailbox mail.
  if (
    targetedLookupFailed ||
    conversationLookupFailed ||
    (conversationAccepted === 0 && targetedScanMatched === 0)
  ) {
    try {
      const recent = await listRecentGraphSyncMessages({
        mailbox,
        maxMessages: 120,
      });
      for (const msg of recent) {
        await processEvidenceMessage(msg, "recent");
      }
    } catch (error) {
      console.error("[sync-request-graph-thread] recent scan failed", {
        requestId,
        message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
    }
  }

  return {
    appended,
    alreadyProcessed,
    conversationsChecked,
    targetedScanMatched,
    targetedScanRejected,
    recentScanMatched,
    recentScanRejected,
    participantRejected,
    verifiedParentMatched,
    verifiedParentRejected,
  };
}
