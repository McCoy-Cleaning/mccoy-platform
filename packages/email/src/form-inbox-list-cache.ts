/**
 * Short-lived in-process cache for the unfiltered Aanvragen merge.
 * Default list is website_requests + hidden numbers (no Graph).
 * Graph mailbox is loaded only when fresh=true (Vernieuwen).
 */

export type InboxListSnapshotCacheOptions = {
  ttlMs?: number;
  fresh?: boolean;
};

const DEFAULT_TTL_MS = 20_000;
const COLD_GRAPH_LIST_BUDGET_MS = 350;
const FRESH_GRAPH_LIST_BUDGET_MS = 4_000;

type Entry<T> = {
  value: T;
  expiresAt: number;
};

let inflight: Promise<unknown> | null = null;
let inflightKey = "";
let cached: Entry<unknown> | null = null;
let cachedKey = "";

export function clearInboxListSnapshotCache(): void {
  inflight = null;
  inflightKey = "";
  cached = null;
  cachedKey = "";
}

/**
 * Graph mailbox budget — only used on explicit Vernieuwen (fresh=true).
 * The default list path does not call Graph at all.
 */
export function graphListBudgetMs(fresh = false): number {
  return fresh ? FRESH_GRAPH_LIST_BUDGET_MS : COLD_GRAPH_LIST_BUDGET_MS;
}

export function peekInboxListSnapshotCache<T>(key = "default"): T | null {
  if (cachedKey !== key || !cached) return null;
  if (Date.now() >= cached.expiresAt) return null;
  return cached.value as T;
}

export async function getOrLoadInboxListSnapshot<T>(
  load: () => Promise<T>,
  options?: InboxListSnapshotCacheOptions & { key?: string },
): Promise<T> {
  const key = options?.key ?? "default";
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const fresh = options?.fresh === true;

  if (!fresh) {
    const existing = peekInboxListSnapshotCache<T>(key);
    if (existing) return existing;
    if (inflight && inflightKey === key) {
      return inflight as Promise<T>;
    }
  }

  const pending = load().then((value) => {
    cached = { value, expiresAt: Date.now() + ttlMs };
    cachedKey = key;
    return value;
  });
  inflight = pending;
  inflightKey = key;
  try {
    return await pending;
  } finally {
    if (inflight === pending) {
      inflight = null;
      inflightKey = "";
    }
  }
}
