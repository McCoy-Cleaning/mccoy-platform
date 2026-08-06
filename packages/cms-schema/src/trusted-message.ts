/**
 * Origin-gated window message listener for admin ↔ storefront bridges.
 * Never register a raw message listener without going through this helper.
 */

function normalizeAllowedOrigins(allowedOrigins: readonly string[] | string): string[] {
  const list = typeof allowedOrigins === "string" ? [allowedOrigins] : [...allowedOrigins];
  return list.map((o) => o.replace(/\/$/, "")).filter(Boolean);
}

export function isTrustedMessageOrigin(
  eventOrigin: string,
  allowedOrigins: readonly string[] | string,
): boolean {
  const allowed = normalizeAllowedOrigins(allowedOrigins);
  return allowed.some((origin) => origin === eventOrigin);
}

/**
 * Registers `message` with an allowlist check before the handler runs.
 * Returns an unsubscribe function.
 */
export function addTrustedMessageListener(
  allowedOrigins: readonly string[] | string,
  handler: (event: MessageEvent) => void,
  target: Window = typeof window !== "undefined" ? window : (undefined as unknown as Window),
): () => void {
  const allowed = normalizeAllowedOrigins(allowedOrigins);
  const onMessage = (event: MessageEvent) => {
    // Semgrep: reject unexpected origins before any payload handling.
    if (!allowed.some((origin) => origin === event.origin)) return;
    handler(event);
  };
  target.addEventListener("message", onMessage);
  return () => target.removeEventListener("message", onMessage);
}
