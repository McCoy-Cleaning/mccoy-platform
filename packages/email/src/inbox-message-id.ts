/**
 * Encode / decode Aanvragen inbox message ids for IMAP and Microsoft Graph.
 * Pure helpers — safe to unit-test without network.
 */

import { FormInboxError } from "./form-inbox-contracts";

const DEFAULT_MAILBOX = "INBOX";

export type DecodedInboxMessageId =
  | { provider: "imap"; mailbox: string; uid: number }
  | { provider: "graph"; mailbox: string; graphId: string }
  | { provider: "request"; mailbox: string; requestId: string }
  /** @deprecated Prefer provider "request" — still decoded for older E2E ids. */
  | { provider: "e2e"; mailbox: string; requestId: string };

export function encodeImapMessageId(uid: number, mailbox = DEFAULT_MAILBOX): string {
  return `imap:${encodeURIComponent(mailbox)}:${uid}`;
}

export function encodeGraphMessageId(graphId: string, mailbox: string): string {
  return `graph:${encodeURIComponent(mailbox)}:${encodeURIComponent(graphId)}`;
}

/** Production + E2E ids for website_requests-backed Aanvragen rows. */
export function encodeRequestMessageId(
  requestId: string,
  mailbox = "website-requests",
): string {
  return `req:${encodeURIComponent(mailbox)}:${encodeURIComponent(requestId)}`;
}

/** @deprecated Use encodeRequestMessageId — kept for existing E2E fixtures. */
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

  const request = /^req:([^:]+):(.+)$/.exec(trimmed);
  if (request) {
    const mailbox = decodeURIComponent(request[1]!);
    const requestId = decodeURIComponent(request[2]!);
    if (!mailbox || !requestId) {
      throw new FormInboxError("Ongeldig berichten-ID.");
    }
    return { provider: "request", mailbox, requestId };
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

/**
 * Thread items for Graph replies are sometimes encoded as
 * `req:mailbox:{requestId}:mail:{mailRowId}`. Decode that suffix so attachment
 * download can still resolve the website request.
 */
export function splitWebsiteRequestInboxTarget(requestId: string): {
  requestId: string;
  mailRowId?: string;
} {
  const trimmed = requestId.trim();
  const match = /^(.+):mail:(.+)$/.exec(trimmed);
  if (!match) return { requestId: trimmed };
  return { requestId: match[1]!, mailRowId: match[2] };
}

/** Zod-friendly pattern: imap / graph / req / e2e */
export const INBOX_MESSAGE_ID_PATTERN =
  /^(imap:[^:]+:\d+|graph:[^:]+:.+|req:[^:]+:.+|e2e:[^:]+:.+)$/;
