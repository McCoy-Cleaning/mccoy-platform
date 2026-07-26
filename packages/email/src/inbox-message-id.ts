/**
 * Encode / decode Aanvragen inbox message ids for IMAP and Microsoft Graph.
 * Pure helpers — safe to unit-test without network.
 */

import { FormInboxError } from "./form-inbox-contracts";

const DEFAULT_MAILBOX = "INBOX";

export type DecodedInboxMessageId =
  | { provider: "imap"; mailbox: string; uid: number }
  | { provider: "graph"; mailbox: string; graphId: string }
  | { provider: "e2e"; mailbox: string; requestId: string };

export function encodeImapMessageId(uid: number, mailbox = DEFAULT_MAILBOX): string {
  return `imap:${encodeURIComponent(mailbox)}:${uid}`;
}

export function encodeGraphMessageId(graphId: string, mailbox: string): string {
  return `graph:${encodeURIComponent(mailbox)}:${encodeURIComponent(graphId)}`;
}

/** Deterministic inbox ids for MCCOY_E2E (JSON website-requests store → Aanvragen UI). */
export function encodeE2eMessageId(requestId: string, mailbox = "website-requests"): string {
  return `e2e:${encodeURIComponent(mailbox)}:${encodeURIComponent(requestId)}`;
}

/** Stable positive int for UI fields that still expect a numeric uid. */
export function graphIdToSyntheticUid(graphId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < graphId.length; i++) {
    hash ^= graphId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = hash >>> 0;
  return positive === 0 ? 1 : positive;
}

export function decodeInboxMessageId(id: string): DecodedInboxMessageId {
  const trimmed = id.trim();
  const imap = /^imap:([^:]+):(\d+)$/.exec(trimmed);
  if (imap) {
    const mailbox = decodeURIComponent(imap[1]!);
    const uid = Number.parseInt(imap[2]!, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      throw new FormInboxError("Ongeldig berichten-ID.");
    }
    return { provider: "imap", mailbox, uid };
  }

  const graph = /^graph:([^:]+):(.+)$/.exec(trimmed);
  if (graph) {
    const mailbox = decodeURIComponent(graph[1]!);
    const graphId = decodeURIComponent(graph[2]!);
    if (!mailbox || !graphId) {
      throw new FormInboxError("Ongeldig berichten-ID.");
    }
    return { provider: "graph", mailbox, graphId };
  }

  const e2e = /^e2e:([^:]+):(.+)$/.exec(trimmed);
  if (e2e) {
    const mailbox = decodeURIComponent(e2e[1]!);
    const requestId = decodeURIComponent(e2e[2]!);
    if (!mailbox || !requestId) {
      throw new FormInboxError("Ongeldig berichten-ID.");
    }
    return { provider: "e2e", mailbox, requestId };
  }

  throw new FormInboxError("Ongeldig berichten-ID.");
}

/** Zod-friendly pattern: imap / graph / e2e deterministic store */
export const INBOX_MESSAGE_ID_PATTERN =
  /^(imap:[^:]+:\d+|graph:[^:]+:.+|e2e:[^:]+:.+)$/;
