/**
 * Post-list Graph inbox sync: persist form root identities and append
 * applicant replies to existing Aanvragen inquiries.
 *
 * Kept outside `graph-mail.ts` so the Graph adapter has no dependency on
 * ingest/database side effects (avoids circular imports).
 */
import {
  findWebsiteRequestIdByNumber,
  upsertWebsiteRequestMailMessage,
} from "@mccoy/database/server";

import { extractRequestNumber } from "./classify-form-email";
import { getGraphMailConfig } from "./graph-config";
import type { GraphInboxSyncCandidate } from "./graph-inbox-sync-types";
import { ingestGraphReplyCandidates } from "./ingest-graph-replies";

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
    const requestId = await findWebsiteRequestIdByNumber(number);
    if (!requestId) continue;
    const result = await upsertWebsiteRequestMailMessage({
      requestId,
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
  replies: {
    appended: number;
    alreadyProcessed: number;
    unmatched: number;
    participantRejected: number;
  };
}> {
  const config = getGraphMailConfig();
  const mailbox = (options.mailbox || config?.mailbox || "").trim().toLowerCase();
  if (!mailbox || options.candidates.length === 0) {
    return {
      rootsPersisted: 0,
      replies: { appended: 0, alreadyProcessed: 0, unmatched: 0, participantRejected: 0 },
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

  let replies = { appended: 0, alreadyProcessed: 0, unmatched: 0, participantRejected: 0 };
  try {
    // Correlation decides whether a non-form Inbox message belongs to an
    // inquiry. Ordinary mailbox traffic is ignored by the request pipeline;
    // request-aware failures retain internal diagnostic metadata only.
    const receivedMail = options.candidates.filter((msg) => !msg.isFormCandidate);
    if (receivedMail.length > 0) {
      replies = await ingestGraphReplyCandidates({
        messages: receivedMail.map((msg) => ({
          id: msg.id,
          subject: msg.subject,
          bodyPreview: msg.bodyPreview,
          receivedDateTime: msg.receivedDateTime,
          isRead: msg.isRead,
          hasAttachments: msg.hasAttachments,
          internetMessageId: msg.internetMessageId,
          conversationId: msg.conversationId,
          from: msg.fromAddress ? { emailAddress: { address: msg.fromAddress } } : null,
          toRecipients: (msg.toAddresses ?? []).map((address) => ({
            emailAddress: { address },
          })),
          internetMessageHeaders: msg.internetMessageHeaders,
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

/**
 * Refresh the bounded Graph Inbox routing window without making the normal
 * Aanvragen list depend on Graph latency. Kept as a server-side operational
 * hook for explicit mailbox reconciliation.
 */
export async function refreshGraphInboxRouting(options?: {
  limit?: number;
  signal?: AbortSignal;
}): Promise<Awaited<ReturnType<typeof syncGraphInboxAfterList>>> {
  const config = getGraphMailConfig();
  if (!config) {
    return {
      rootsPersisted: 0,
      replies: { appended: 0, alreadyProcessed: 0, unmatched: 0, participantRejected: 0 },
    };
  }

  const { listGraphFormInboxMessages } = await import("./graph-mail");
  const listed = await listGraphFormInboxMessages({
    limit: Math.min(Math.max(options?.limit ?? 80, 1), 200),
    scanLimit: Math.min(Math.max(options?.limit ?? 80, 1), 200),
    signal: options?.signal,
  });
  return syncGraphInboxAfterList({
    candidates: listed.syncCandidates ?? [],
    mailbox: config.mailbox,
  });
}
