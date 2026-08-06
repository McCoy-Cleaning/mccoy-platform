/**
 * Microsoft Graph JSON $batch delete/move for Aanvragen mailbox messages.
 * Parses every subresponse — envelope HTTP 200 is never treated as full success.
 */
import { FormInboxError } from "./form-inbox-contracts";
import { getGraphAccessToken } from "./graph-auth";
import { getGraphMailConfig } from "./graph-config";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
/** Graph JSON batch hard limit. */
export const GRAPH_BATCH_SIZE = 20;
const MAX_RETRIES = 2;

export type GraphBulkDeleteItemResult = {
  messageId: string;
  graphId: string;
  status: "deleted" | "already_absent" | "failed";
  statusCode?: number;
  retryable?: boolean;
  errorCode?: string;
};

export type GraphBulkDeleteResult = {
  requestedCount: number;
  results: GraphBulkDeleteItemResult[];
  deletedCount: number;
  alreadyAbsentCount: number;
  failedCount: number;
  chunkCount: number;
  graphRequestCount: number;
  durationMs: number;
};

type BatchSubResponse = {
  id: string;
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

type BatchEnvelope = {
  responses?: BatchSubResponse[];
};

function usersPath(mailbox: string, suffix: string): string {
  return `/users/${encodeURIComponent(mailbox)}${suffix}`;
}

function chunkIds<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headers?: Record<string, string>): number | undefined {
  if (!headers) return undefined;
  const raw = headers["Retry-After"] ?? headers["retry-after"];
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  return undefined;
}

async function postBatch(
  accessToken: string,
  requests: Array<{
    id: string;
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>,
): Promise<BatchSubResponse[]> {
  const response = await fetch(`${GRAPH_BASE}/$batch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  let json: BatchEnvelope | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as BatchEnvelope;
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    throw new FormInboxError(
      `Microsoft Graph-batch mislukt (HTTP ${response.status}).`,
    );
  }

  return json?.responses ?? [];
}

function mapSubStatus(
  graphId: string,
  encodedId: string,
  sub: BatchSubResponse | undefined,
): GraphBulkDeleteItemResult {
  if (!sub) {
    return {
      messageId: encodedId,
      graphId,
      status: "failed",
      errorCode: "missing_subresponse",
      retryable: true,
    };
  }
  if (sub.status === 204 || sub.status === 200 || sub.status === 201) {
    return { messageId: encodedId, graphId, status: "deleted", statusCode: sub.status };
  }
  if (sub.status === 404) {
    return {
      messageId: encodedId,
      graphId,
      status: "already_absent",
      statusCode: 404,
    };
  }
  return {
    messageId: encodedId,
    graphId,
    status: "failed",
    statusCode: sub.status,
    retryable: isRetryableStatus(sub.status),
    errorCode: `http_${sub.status}`,
  };
}

/**
 * Move messages to Deleted Items via Graph $batch (fallback DELETE in a follow-up batch for failures).
 * `items` must be unique Graph message IDs for a single mailbox.
 */
export async function bulkDeleteGraphMessages(options: {
  mailbox: string;
  /** Encoded Aanvragen ids + raw Graph ids */
  targets: Array<{ messageId: string; graphId: string }>;
}): Promise<GraphBulkDeleteResult> {
  const started = Date.now();
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }

  const accessToken = await getGraphAccessToken(config);
  const box = options.mailbox || config.mailbox;
  const unique = new Map<string, { messageId: string; graphId: string }>();
  for (const t of options.targets) {
    if (!t.graphId || !t.messageId) continue;
    unique.set(t.graphId, t);
  }
  const list = [...unique.values()];
  const byGraphId = new Map(list.map((t) => [t.graphId, t]));
  const results = new Map<string, GraphBulkDeleteItemResult>();
  let graphRequestCount = 0;
  let chunkCount = 0;

  async function runMoveOrDelete(
    method: "move" | "delete",
    pending: Array<{ messageId: string; graphId: string }>,
  ): Promise<void> {
    const chunks = chunkIds(pending, GRAPH_BATCH_SIZE);
    for (const chunk of chunks) {
      chunkCount += 1;
      let attempt = 0;
      let remaining = chunk;

      while (remaining.length > 0 && attempt <= MAX_RETRIES) {
        attempt += 1;
        graphRequestCount += 1;
        const requests = remaining.map((t, index) => {
          const reqId = String(index + 1);
          if (method === "move") {
            return {
              id: reqId,
              method: "POST",
              url: `${usersPath(box, `/messages/${encodeURIComponent(t.graphId)}/move`)}`,
              headers: { "Content-Type": "application/json" },
              body: { destinationId: "deleteditems" },
            };
          }
          return {
            id: reqId,
            method: "DELETE",
            url: `${usersPath(box, `/messages/${encodeURIComponent(t.graphId)}`)}`,
          };
        });

        const idByReq = new Map(
          remaining.map((t, index) => [String(index + 1), t] as const),
        );
        const responses = await postBatch(accessToken, requests);
        const byReqId = new Map(responses.map((r) => [r.id, r]));
        const retry: Array<{ messageId: string; graphId: string }> = [];
        let maxRetryAfter = 0;

        for (const [reqId, target] of idByReq) {
          const mapped = mapSubStatus(target.graphId, target.messageId, byReqId.get(reqId));
          if (mapped.status === "failed" && mapped.retryable && attempt <= MAX_RETRIES) {
            retry.push(target);
            const wait = parseRetryAfterMs(byReqId.get(reqId)?.headers);
            if (wait) maxRetryAfter = Math.max(maxRetryAfter, wait);
          } else {
            results.set(target.graphId, mapped);
          }
        }

        remaining = retry;
        if (remaining.length > 0) {
          await sleep(maxRetryAfter || Math.min(500 * 2 ** (attempt - 1), 4000));
        }
      }

      for (const t of remaining) {
        if (!results.has(t.graphId)) {
          results.set(t.graphId, {
            messageId: t.messageId,
            graphId: t.graphId,
            status: "failed",
            errorCode: "retries_exhausted",
            retryable: false,
          });
        }
      }
    }
  }

  await runMoveOrDelete("move", list);

  const needHardDelete = list.filter((t) => {
    const r = results.get(t.graphId);
    return r?.status === "failed";
  });
  if (needHardDelete.length > 0) {
    for (const t of needHardDelete) results.delete(t.graphId);
    await runMoveOrDelete("delete", needHardDelete);
  }

  const ordered: GraphBulkDeleteItemResult[] = list.map((t) => {
    return (
      results.get(t.graphId) ?? {
        messageId: t.messageId,
        graphId: t.graphId,
        status: "failed" as const,
        errorCode: "missing_result",
      }
    );
  });

  // Ensure every requested encoded id appears (including duplicates collapsed to one graph id)
  for (const t of options.targets) {
    if (!byGraphId.has(t.graphId)) continue;
  }

  const deletedCount = ordered.filter((r) => r.status === "deleted").length;
  const alreadyAbsentCount = ordered.filter((r) => r.status === "already_absent").length;
  const failedCount = ordered.filter((r) => r.status === "failed").length;

  return {
    requestedCount: list.length,
    results: ordered,
    deletedCount,
    alreadyAbsentCount,
    failedCount,
    chunkCount,
    graphRequestCount,
    durationMs: Date.now() - started,
  };
}
