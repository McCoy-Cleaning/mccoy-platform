/**
 * Post-list Graph inbox sync: persist form root identities and append
 * applicant replies to existing Aanvragen inquiries.
 *
 * Kept outside `graph-mail.ts` so the Graph adapter has no dependency on
 * ingest/database side effects (avoids circular imports).
 */
import {
  listWebsiteRequests,
  upsertWebsiteRequestMailMessage,
} from "@mccoy/database/server";

import { extractRequestNumber } from "./classify-form-email";
import { getGraphMailConfig } from "./graph-config";
import type { GraphInboxSyncCandidate } from "./graph-inbox-sync-types";
import { ingestGraphReplyCandidates } from "./ingest-graph-replies";
import { isReplyOrForwardSubject } from "./form-mail-subject";

export type { GraphInboxSyncCandidate } from "./graph-inbox-sync-types";

async function persistGraphFormRootIdentities(options: {
  messages: GraphInboxSyncCandidate[];
  mailbox: string;
}): Promise<number> {
  const mailbox = options.mailbox.trim().toLowerCase();
  if (!mailbox) return 0;
  let persisted = 0;

  for (const msg of options.messages) {
    if (!msg.isFormCandidate) continue;
    const number = extractRequestNumber(msg.subject || "", msg.bodyPreview || "");
    if (!number) continue;
    const matches = await listWebsiteRequests({ q: number });
    const match = matches.find((row) => row.number.toUpperCase() === number.toUpperCase());
    if (!match) continue;
    const result = await upsertWebsiteRequestMailMessage({
      requestId: match.id,
      direction: "inbound",
      provider: "website_form",
      mailbox,
      graphMessageId: msg.id,
      internetMessageId: msg.internetMessageId ?? null,
      conversationId: msg.conversationId ?? null,
      senderAddress: msg.fromAddress ?? null,
      recipientAddresses: [mailbox],
      subject: msg.subject ?? null,
      bodyText: msg.bodyPreview ?? null,
      occurredAt: msg.receivedDateTime ?? new Date().toISOString(),
      isRead: msg.isRead !== false,
    });
    if (result) persisted += 1;
  }

  return persisted;
}

/**
 * Run after a Graph inbox list page. Idempotent; safe to call on every refresh.
 */
export async function syncGraphInboxAfterList(options: {
  candidates: GraphInboxSyncCandidate[];
  mailbox?: string;
}): Promise<{
  rootsPersisted: number;
  replies: { appended: number; alreadyProcessed: number; unmatched: number };
}> {
  const config = getGraphMailConfig();
  const mailbox = (options.mailbox || config?.mailbox || "").trim().toLowerCase();
  if (!mailbox || options.candidates.length === 0) {
    return {
      rootsPersisted: 0,
      replies: { appended: 0, alreadyProcessed: 0, unmatched: 0 },
    };
  }

  let rootsPersisted = 0;
  try {
    rootsPersisted = await persistGraphFormRootIdentities({
      messages: options.candidates,
      mailbox,
    });
  } catch (error) {
    console.error("[graph-inbox-sync] root identity persist failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  let replies = { appended: 0, alreadyProcessed: 0, unmatched: 0 };
  try {
    const replyShaped = options.candidates.filter((msg) =>
      isReplyOrForwardSubject(msg.subject),
    );
    if (replyShaped.length > 0) {
      replies = await ingestGraphReplyCandidates({
        messages: replyShaped.map((msg) => ({
          id: msg.id,
          subject: msg.subject,
          bodyPreview: msg.bodyPreview,
          receivedDateTime: msg.receivedDateTime,
          isRead: msg.isRead,
          internetMessageId: msg.internetMessageId,
          conversationId: msg.conversationId,
          from: msg.fromAddress
            ? { emailAddress: { address: msg.fromAddress } }
            : null,
        })),
        mailbox,
      });
    }
  } catch (error) {
    console.error("[graph-inbox-sync] reply ingest failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  return { rootsPersisted, replies };
}
