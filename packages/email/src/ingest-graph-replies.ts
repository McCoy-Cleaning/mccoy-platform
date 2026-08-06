/**
 * Bounded ingest of inbound Graph replies into website_request_mail_messages.
 * Called during inbox list so applicant replies append without becoming list rows.
 */
import {
  listKnownMailIdentitiesForMailbox,
  upsertWebsiteRequestMailMessage,
} from "@mccoy/database/server";
import { getGraphMailConfig } from "./graph-config";
import {
  correlateInboundGraphMessage,
  parseReferencesHeader,
} from "./inquiry-thread-correlation";
import { isReplyOrForwardSubject } from "./form-mail-subject";

type LightweightGraphMessage = {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  internetMessageId?: string | null;
  conversationId?: string | null;
  from?: { emailAddress?: { address?: string | null } | null } | null;
  internetMessageHeaders?: Array<{ name?: string | null; value?: string | null }> | null;
};

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

export async function ingestGraphReplyCandidates(options: {
  messages: LightweightGraphMessage[];
  mailbox: string;
}): Promise<{ appended: number; alreadyProcessed: number; unmatched: number }> {
  const config = getGraphMailConfig();
  const mailbox = (options.mailbox || config?.mailbox || "").trim().toLowerCase();
  if (!mailbox) {
    return { appended: 0, alreadyProcessed: 0, unmatched: 0 };
  }

  const known = await listKnownMailIdentitiesForMailbox(mailbox);
  if (known.length === 0) {
    return { appended: 0, alreadyProcessed: 0, unmatched: 0 };
  }

  let appended = 0;
  let alreadyProcessed = 0;
  let unmatched = 0;

  for (const msg of options.messages) {
    if (!msg.id) continue;
    const subject = msg.subject || "";
    // Only consider reply-shaped mail for append (form notifications stay list candidates).
    if (!isReplyOrForwardSubject(subject) && !readHeader(msg.internetMessageHeaders, "in-reply-to")) {
      continue;
    }

    const inReplyTo = readHeader(msg.internetMessageHeaders, "in-reply-to");
    const references = parseReferencesHeader(
      readHeader(msg.internetMessageHeaders, "references"),
    );
    const fromAddress = msg.from?.emailAddress?.address ?? null;

    const result = correlateInboundGraphMessage(
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

    if (result.status === "unmatched" || result.status === "ambiguous") {
      unmatched += 1;
      continue;
    }
    if (result.status === "already_processed") {
      alreadyProcessed += 1;
      continue;
    }

    const upsert = await upsertWebsiteRequestMailMessage({
      requestId: result.inquiryId,
      direction: "inbound",
      provider: "microsoft_graph",
      mailbox,
      graphMessageId: msg.id,
      internetMessageId: msg.internetMessageId ?? null,
      conversationId: msg.conversationId ?? null,
      inReplyTo,
      referencesHeader: references.join(" "),
      senderAddress: fromAddress,
      recipientAddresses: [mailbox],
      subject,
      bodyText: msg.bodyPreview ?? null,
      occurredAt: msg.receivedDateTime ?? new Date().toISOString(),
      isRead: msg.isRead !== false,
    });

    if (upsert?.status === "appended") appended += 1;
    else if (upsert?.status === "already_processed") alreadyProcessed += 1;
  }

  return { appended, alreadyProcessed, unmatched };
}
