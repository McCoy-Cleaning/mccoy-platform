import type { ContentAiProvenance } from "./types";

export type CacheEntry<T> = {
  value: T;
  provenance: ContentAiProvenance;
  storedAt: number;
};

/**
 * E5 — In-process source-hash cache (server-only).
 * Survives within a warm server process; not a cross-instance store.
 */
export class SourceHashCache {
  private readonly map = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options?: { maxEntries?: number; ttlMs?: number }) {
    this.maxEntries = options?.maxEntries ?? 200;
    this.ttlMs = options?.ttlMs ?? 1000 * 60 * 60;
  }

  get<T>(sourceHash: string): CacheEntry<T> | null {
    const hit = this.map.get(sourceHash);
    if (!hit) return null;
    if (Date.now() - hit.storedAt > this.ttlMs) {
      this.map.delete(sourceHash);
      return null;
    }
    return hit as CacheEntry<T>;
  }

  set<T>(sourceHash: string, value: T, provenance: ContentAiProvenance): void {
    if (this.map.size >= this.maxEntries) {
      const first = this.map.keys().next().value;
      if (first) this.map.delete(first);
    }
    this.map.set(sourceHash, { value, provenance, storedAt: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }
}

export const globalContentAiCache = new SourceHashCache();
