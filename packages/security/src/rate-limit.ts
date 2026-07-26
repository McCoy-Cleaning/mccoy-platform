/** In-memory sliding-window rate limit (per process). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export class RateLimitError extends Error {
  readonly code = "rate_limit" as const;
  constructor(message = "Too many requests. Please wait a moment.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export function assertRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
  message?: string,
): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    throw new RateLimitError(message);
  }
  bucket.count += 1;
}

/** Honeypot: treat non-empty website field as bot spam. */
export function isHoneypotTriggered(website: string | undefined | null): boolean {
  return Boolean(website && website.trim().length > 0);
}
