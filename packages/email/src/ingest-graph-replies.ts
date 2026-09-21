/**
 * Bounded ingest of non-form messages from the Graph Inbox.
 *
 * A message is appended only when durable mail identity resolves exactly one
 * inquiry, or an exact WR number is backed by per-request participant proof.
 * Ordinary shared-mailbox traffic is outside the Aanvragen domain and ignored.
 */
import {
  findWebsiteRequestIdByNumber,
  getWebsiteRequest,
  listKnownMailIdentitiesForMailbox,
  recordUnmatchedInboundMail,
  resolveUnmatchedInboundMail,
  upsertWebsiteRequestMailMessage,
} from "@mccoy/database/server";
import { isReplyOrForwardSubject } from "./form-mail-subject";
import { getGraphMailConfig } from "./graph-config";
import {
  correlateInboundGraphMessage,
  extractWebsiteRequestNumberToken,
  inboundSenderAuthenticationExplicitlyFails,
  inboundSenderAuthenticationPasses,
  parseReferencesHeader,
  requestSubmitterIsParticipant,
  verifiedReplyParentBelongsToWebsiteRequest,
} from "./inquiry-thread-correlation";
import { normaliseThreadMessageBody } from "./inquiry-thread-dedupe";

type GraphRecipient = { emailAddress?: { address?: string | null } | null } | null;

type LightweightGraphMessage = {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  internetMessageId?: string | null;
  conversationId?: string | null;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[] | null;
  internetMessageHeaders?: Array<{ name?: string | null; value?: string | null }> | null;
};

function recipientAddresses(recipients: GraphRecipient[] | null | undefined): string[] {
  if (!recipients?.length) return [];
  return recipients
    .map((recipient) => recipient?.emailAddress?.address?.trim().toLowerCase() || "")
    .filter((address) => address.length > 0);
}

function readHeader(
  headers: LightweightGraphMessage["internetMessageHeaders"],
  name: string,
): string | null {
  if (!headers?.length) return null;
  const wanted = name.toLowerCase();
  for (const header of headers) {
    if ((header.name ?? "").trim().toLowerCase() !== wanted) continue;
    const value = header.value?.trim();
    if (value) return value;
  }
  return null;
}

type RequestNumberResolution =
  | {
      status: "matched";
      inquiryId: string;
      submitterEmail: string | null;
      verifiedReplyParent: boolean;
      inReplyTo: string | null;
      references: string[];
    }
  | { status: "inactive" }
  | { status: "unresolved"; inquiryId: string | null }
  | null;

/**
 * Recover a request-aware reply when the bounded identity index has no hit.
 * An exact WR token is only a locator; request ownership still requires either
 * the stored submitter as participant or an exact, independently verified
 * outbound parent in Microsoft Graph.
 */
async function resolveByRequestNumber(options: {
  msg: LightweightGraphMessage;
  mailbox: string;
  fromAddress: string | null;
  toAddresses: string[];
  senderAuthenticated: boolean;
}): Promise<RequestNumberResolution> {
  const subject = options.msg.subject || "";
  const bodyPreview = options.msg.bodyPreview || "";
  const requestNumber = extractWebsiteRequestNumberToken(subject, bodyPreview);
  if (!requestNumber) return null;

  const requestId = await findWebsiteRequestIdByNumber(requestNumber);
  if (!requestId) return { status: "unresolved", inquiryId: null };
  const request = await getWebsiteRequest(requestId);
  if (!request) return { status: "unresolved", inquiryId: requestId };
  if (request.status === "deleted" || request.status === "spam") {
    return { status: "inactive" };
  }

  if (
    options.senderAuthenticated &&
    requestSubmitterIsParticipant(
      { fromAddress: options.fromAddress, toAddresses: options.toAddresses },
      request.submitterEmail,
    )
  ) {
    return {
      status: "matched",
      inquiryId: request.id,
      submitterEmail: request.submitterEmail,
      verifiedReplyParent: false,
      inReplyTo: readHeader(options.msg.internetMessageHeaders, "in-reply-to"),
      references: parseReferencesHeader(
        readHeader(options.msg.internetMessageHeaders, "references"),
      ),
    };
  }

  if (!options.msg.id || !isReplyOrForwardSubject(subject)) {
    return { status: "unresolved", inquiryId: request.id };
  }

  try {
    const { getGraphReplyParentContext } = await import("./graph-mail");
    const context = await getGraphReplyParentContext(options.msg.id, options.mailbox);
    if (
      context &&
      verifiedReplyParentBelongsToWebsiteRequest({
        mailbox: options.mailbox,
        submitterEmail: request.submitterEmail,
        requestNumber: request.number,
        inReplyTo: context.inReplyTo,
        reply: {
          subject,
          bodyPreview,
          conversationId: options.msg.conversationId ?? null,
          fromAddress: options.fromAddress,
          toAddresses: options.toAddresses,
        },
        parent: context.parent,
      })
    ) {
      return {
        status: "matched",
        inquiryId: request.id,
        submitterEmail: request.submitterEmail,
        verifiedReplyParent: true,
        inReplyTo: context.inReplyTo,
        references: context.references,
      };
    }
  } catch (error) {
    console.error("[ingest-graph-replies] parent verification failed", {
      requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  return { status: "unresolved", inquiryId: request.id };
}

export async function ingestGraphReplyCandidates(options: {
  messages: LightweightGraphMessage[];
  mailbox: string;
}): Promise<{
  appended: number;
  alreadyProcessed: number;
  unmatched: number;
  /** Mail dropped because the resolved request's submitter was not a participant. */
  participantRejected: number;
}> {
  const config = getGraphMailConfig();
  const mailbox = (options.mailbox || config?.mailbox || "").trim().toLowerCase();
  const empty = { appended: 0, alreadyProcessed: 0, unmatched: 0, participantRejected: 0 };
  if (!mailbox) return empty;

  const known = await listKnownMailIdentitiesForMailbox(mailbox);

  let appended = 0;
  let alreadyProcessed = 0;
  let unmatched = 0;
  let participantRejected = 0;

  for (const msg of options.messages) {
    if (!msg.id) continue;
    const subject = msg.subject || "";
    let headers = msg.internetMessageHeaders ?? [];
    let inReplyTo = readHeader(headers, "in-reply-to");
    let references = parseReferencesHeader(readHeader(headers, "references"));
    const fromAddress = msg.from?.emailAddress?.address ?? null;
    const toAddresses = recipientAddresses(msg.toRecipients);
    const direction =
      fromAddress && fromAddress.trim().toLowerCase() === mailbox ? "outbound" : "inbound";
    if (direction === "outbound") continue;

    let result = correlateInboundGraphMessage(
      {
        mailbox,
        graphMessageId: msg.id,
        internetMessageId: msg.internetMessageId ?? null,
        conversationId: msg.conversationId ?? null,
        inReplyTo,
        references,
        subject,
        fromAddress,
      },
      known,
    );

    const requestNumber = extractWebsiteRequestNumberToken(subject, msg.bodyPreview || "");
    const requestAware = result.status !== "unmatched" || Boolean(requestNumber);
    if (requestAware && headers.length === 0) {
      try {
        const { getGraphMessageInternetHeaders } = await import("./graph-mail");
        headers = await getGraphMessageInternetHeaders(msg.id, mailbox);
        inReplyTo = readHeader(headers, "in-reply-to");
        references = parseReferencesHeader(readHeader(headers, "references"));
        result = correlateInboundGraphMessage(
          {
            mailbox,
            graphMessageId: msg.id,
            internetMessageId: msg.internetMessageId ?? null,
            conversationId: msg.conversationId ?? null,
            inReplyTo,
            references,
            subject,
            fromAddress,
          },
          known,
        );
      } catch (error) {
        console.warn("[ingest-graph-replies] authentication headers unavailable", {
          messageId: msg.id,
          message: error instanceof Error ? error.message.slice(0, 120) : "unknown",
        });
      }
    }
    const senderAuthenticated = inboundSenderAuthenticationPasses(headers, fromAddress);
    const senderAuthenticationFailed = inboundSenderAuthenticationExplicitlyFails(headers);

    // The shared mailbox contains ordinary business mail that is unrelated to
    // website requests. Only request-aware failures belong in the internal
    // diagnostic table; ordinary mail stays in Outlook and is ignored here.
    const correlatedIdentity =
      result.status === "appended" || result.status === "already_processed"
        ? (known.find((row) => row.inquiryId === result.inquiryId) ?? null)
        : null;
    const correlatedParticipant = correlatedIdentity
      ? requestSubmitterIsParticipant(
          { fromAddress, toAddresses },
          correlatedIdentity.submitterEmail,
        )
      : false;
    const numberResolution =
      result.status === "unmatched" || result.status === "ambiguous" || !correlatedParticipant
        ? await resolveByRequestNumber({
            msg: { ...msg, internetMessageHeaders: headers },
            mailbox,
            fromAddress,
            toAddresses,
            senderAuthenticated,
          })
        : null;
    if (numberResolution?.status === "inactive") continue;

    const correlatedInquiryId =
      result.status === "appended" || result.status === "already_processed"
        ? result.inquiryId
        : null;
    const numberInquiryId =
      numberResolution?.status === "matched" ? numberResolution.inquiryId : null;
    const inquiryId = correlatedInquiryId ?? numberInquiryId;

    if (!inquiryId) {
      const diagnosticRequestIds = new Set<string>();
      if (result.status === "ambiguous") {
        for (const id of result.inquiryIds) diagnosticRequestIds.add(id);
      }
      if (numberResolution?.status === "unresolved" && numberResolution.inquiryId) {
        diagnosticRequestIds.add(numberResolution.inquiryId);
      }
      if (diagnosticRequestIds.size === 0) continue;

      unmatched += 1;
      await recordUnmatchedInboundMail({
        mailbox,
        provider: "microsoft_graph",
        graphMessageId: msg.id,
        internetMessageId: msg.internetMessageId ?? null,
        conversationId: msg.conversationId ?? null,
        senderAddress: fromAddress,
        subject,
        reason: result.status === "ambiguous" ? "ambiguous" : "unmatched",
        candidateRequestIds: [...diagnosticRequestIds],
        receivedAt: msg.receivedDateTime ?? null,
      });
      continue;
    }

    const resolved = correlatedIdentity;
    const submitterEmail =
      resolved?.submitterEmail ??
      (numberResolution?.status === "matched" ? numberResolution.submitterEmail : null);
    const verifiedReplyParent =
      numberResolution?.status === "matched" &&
      numberResolution.inquiryId === inquiryId &&
      numberResolution.verifiedReplyParent;
    const exactIdentityReply =
      (result.status === "appended" || result.status === "already_processed") &&
      (result.match === "in_reply_to" || result.match === "references");
    // Stored Graph ids and conversation ids can themselves be contaminated by
    // an older bad match. Re-check participant ownership for both new and
    // already-processed mail before trusting that durable identity.
    if (
      !verifiedReplyParent &&
      (!requestSubmitterIsParticipant({ fromAddress, toAddresses }, submitterEmail) ||
        senderAuthenticationFailed ||
        (!senderAuthenticated && !exactIdentityReply))
    ) {
      participantRejected += 1;
      if (requestNumber) {
        unmatched += 1;
        await recordUnmatchedInboundMail({
          mailbox,
          provider: "microsoft_graph",
          graphMessageId: msg.id,
          internetMessageId: msg.internetMessageId ?? null,
          conversationId: msg.conversationId ?? null,
          senderAddress: fromAddress,
          subject,
          reason: "unmatched",
          candidateRequestIds: [inquiryId],
          receivedAt: msg.receivedDateTime ?? null,
        });
      }
      continue;
    }

    if (result.status === "already_processed") {
      alreadyProcessed += 1;
      await resolveUnmatchedInboundMail({
        mailbox,
        graphMessageId: msg.id,
        internetMessageId: msg.internetMessageId ?? null,
        requestId: inquiryId,
      });
      continue;
    }

    const upsert = await upsertWebsiteRequestMailMessage({
      requestId: inquiryId,
      direction,
      provider: "microsoft_graph",
      mailbox,
      graphMessageId: msg.id,
      internetMessageId: msg.internetMessageId ?? null,
      conversationId: msg.conversationId ?? null,
      inReplyTo: numberResolution?.status === "matched" ? numberResolution.inReplyTo : inReplyTo,
      referencesHeader:
        numberResolution?.status === "matched"
          ? numberResolution.references.join(" ")
          : references.join(" "),
      senderAddress: fromAddress,
      recipientAddresses: toAddresses.length > 0 ? toAddresses : [mailbox],
      subject,
      bodyText: normaliseThreadMessageBody(msg.bodyPreview ?? "", direction),
      occurredAt: msg.receivedDateTime ?? new Date().toISOString(),
      isRead: msg.isRead !== false,
    });

    if (upsert?.status === "appended") {
      appended += 1;
      await resolveUnmatchedInboundMail({
        mailbox,
        graphMessageId: msg.id,
        internetMessageId: msg.internetMessageId ?? null,
        requestId: inquiryId,
      });
      if (msg.hasAttachments !== false) {
        const { persistMailMessageGraphAttachments } =
          await import("./persist-mail-graph-attachments");
        await persistMailMessageGraphAttachments({
          mailMessageId: upsert.id,
          graphMessageId: msg.id,
          mailbox,
        });
      }
      if (direction === "inbound") {
        const { notifyApplicantReplyAppended } = await import("./notify-applicant-reply");
        await notifyApplicantReplyAppended({
          requestId: inquiryId,
          mailMessageId: upsert.id,
          mailbox,
          senderAddress: fromAddress,
        });
      }
    } else if (upsert?.status === "already_processed") {
      alreadyProcessed += 1;
      await resolveUnmatchedInboundMail({
        mailbox,
        graphMessageId: msg.id,
        internetMessageId: msg.internetMessageId ?? null,
        requestId: inquiryId,
      });
    }
  }

  return { appended, alreadyProcessed, unmatched, participantRejected };
}
