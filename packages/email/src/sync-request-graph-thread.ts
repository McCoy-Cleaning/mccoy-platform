/**
 * When opening a website-request Aanvraag (`req:`), pull the Graph conversation
 * into website_request_mail_messages so applicant replies appear in Gesprek.
 *
 * List-time ingest alone is not enough: detail often loads before the next list
 * refresh, and outbound identity may only exist after createReply/sendMail.
 *
 * Graph conversationId $filter often returns InefficientFilter — we therefore
 * always also scan recent mailbox messages for this WR + submitter/mailbox.
 */
import {
  getWebsiteRequest,
  listWebsiteRequestMailMessages,
  upsertWebsiteRequestMailMessage,
} from "@mccoy/database/server";

import { isReplyOrForwardSubject } from "./form-mail-subject";
import { shouldAttemptGraphMail } from "./form-inbox-provider";
import { getGraphMailConfig } from "./graph-config";
import { messageBelongsToWebsiteRequest } from "./graph-odata-filters";
import {
  classifyGraphThreadDirection,
  findGraphMessageByInternetMessageId,
  getGraphMessagePlainBody,
  getGraphMessageSyncMeta,
  isMcCoyWebsiteFormNotificationBySender,
  listGraphConversationSyncMessages,
  listRecentGraphSyncMessages,
  type GraphConversationSyncMessage,
} from "./graph-mail";
import { normaliseThreadMessageBody } from "./inquiry-thread-dedupe";

export type SyncWebsiteRequestGraphThreadResult = {
  appended: number;
  alreadyProcessed: number;
  conversationsChecked: number;
  recentScanMatched: number;
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
}): Promise<"appended" | "already_processed" | "skipped"> {
  const direction = directionForPersist(
    options.msg,
    options.mailbox,
    options.submitterEmail,
  );
  if (direction === "skip") return "skipped";

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
    conversationId:
      options.msg.conversationId ?? options.conversationIdFallback ?? null,
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
      const { persistMailMessageGraphAttachments } = await import(
        "./persist-mail-graph-attachments"
      );
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

async function collectConversationIds(options: {
  requestId: string;
  mailbox: string;
}): Promise<Set<string>> {
  const conversationIds = new Set<string>();
  const rows = await listWebsiteRequestMailMessages(options.requestId);

  for (const row of rows) {
    if (row.conversation_id?.trim()) {
      conversationIds.add(row.conversation_id.trim());
    }
  }

  const graphIds = [
    ...new Set(
      rows
        .map((row) => row.graph_message_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  for (const graphId of graphIds.slice(0, 8)) {
    if (conversationIds.size >= 4) break;
    const meta = await getGraphMessageSyncMeta(graphId, options.mailbox);
    if (meta?.conversationId?.trim()) {
      conversationIds.add(meta.conversationId.trim());
    }
  }

  // Recover conversation from staff reply RFC ids when mail_messages lack Graph ids.
  if (conversationIds.size === 0) {
    const request = await getWebsiteRequest(options.requestId);
    const internetIds = [
      ...new Set(
        [
          ...(request?.replies ?? []).map((reply) => reply.resendId),
          ...rows.map((row) => row.internet_message_id),
        ]
          .map((id) => id?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ].slice(0, 6);

    for (const internetId of internetIds) {
      const hit = await findGraphMessageByInternetMessageId(internetId, options.mailbox);
      if (hit?.conversationId?.trim()) {
        conversationIds.add(hit.conversationId.trim());
      }
    }
  }

  return conversationIds;
}

export async function syncWebsiteRequestGraphThread(
  requestId: string,
): Promise<SyncWebsiteRequestGraphThreadResult> {
  const empty: SyncWebsiteRequestGraphThreadResult = {
    appended: 0,
    alreadyProcessed: 0,
    conversationsChecked: 0,
    recentScanMatched: 0,
  };

  if (!shouldAttemptGraphMail()) return empty;
  const config = getGraphMailConfig();
  const mailbox = (config?.mailbox || "").trim().toLowerCase();
  if (!mailbox || !requestId) return empty;

  const request = await getWebsiteRequest(requestId);
  if (!request) return empty;
  const submitterEmail = request.submitterEmail?.trim() || null;

  let conversationIds: Set<string>;
  try {
    conversationIds = await collectConversationIds({
      requestId,
      mailbox,
    });
  } catch (error) {
    console.error("[sync-request-graph-thread] identity collect failed", {
      requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    conversationIds = new Set();
  }

  let appended = 0;
  let alreadyProcessed = 0;
  let conversationsChecked = 0;
  let recentScanMatched = 0;
  const seenGraphIds = new Set<string>();

  for (const conversationId of conversationIds) {
    conversationsChecked += 1;
    let messages: GraphConversationSyncMessage[] = [];
    try {
      messages = await listGraphConversationSyncMessages({
        conversationId,
        mailbox,
      });
    } catch (error) {
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
      if (status === "appended") appended += 1;
      else if (status === "already_processed") alreadyProcessed += 1;
    }
  }

  // Always scan recent mail: conversation filters often fail, and this WR may
  // have no stored conversationId yet (staff reply only in website_request_replies).
  try {
    const recent = await listRecentGraphSyncMessages({
      mailbox,
      maxMessages: 120,
    });
    for (const msg of recent) {
      if (seenGraphIds.has(msg.id)) continue;
      const belongs = messageBelongsToWebsiteRequest({
        conversationId: msg.conversationId,
        knownConversationIds: conversationIds,
        subject: msg.subject,
        bodyPreview: msg.bodyPreview,
        fromAddress: msg.fromAddress,
        submitterEmail,
        mailbox,
        requestNumber: request.number,
        requestSubject: request.subject,
        isReplyOrForward: isReplyOrForwardSubject(msg.subject || ""),
        isMcCoySender: isMcCoyWebsiteFormNotificationBySender({
          fromName: msg.fromName,
          fromAddress: msg.fromAddress || "",
        }),
      });
      if (!belongs) continue;

      seenGraphIds.add(msg.id);
      recentScanMatched += 1;
      if (msg.conversationId?.trim()) {
        conversationIds.add(msg.conversationId.trim());
      }
      const status = await persistSyncMessage({
        requestId,
        mailbox,
        submitterEmail,
        msg,
      });
      if (status === "appended") appended += 1;
      else if (status === "already_processed") alreadyProcessed += 1;
    }
  } catch (error) {
    console.error("[sync-request-graph-thread] recent scan failed", {
      requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  return { appended, alreadyProcessed, conversationsChecked, recentScanMatched };
}
