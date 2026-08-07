// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

import { isClientDisconnectError } from "./is-client-disconnect-error";

let lastCapturedError: { error: unknown; at: number } | undefined;
/** Timestamp of the most recent client disconnect (HMR / navigation abort). */
let lastClientDisconnectAt: number | undefined;
const TTL_MS = 5_000;
const DISCONNECT_WINDOW_MS = 3_000;

function record(error: unknown) {
  if (isClientDisconnectError(error)) {
    lastClientDisconnectAt = Date.now();
    return;
  }
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

/**
 * True when a client disconnect was observed within the recent window.
 * Consumes the marker so a later real HTTPError is not misclassified.
 */
export function consumeRecentClientDisconnect(windowMs = DISCONNECT_WINDOW_MS): boolean {
  if (lastClientDisconnectAt == null) return false;
  const recent = Date.now() - lastClientDisconnectAt <= windowMs;
  lastClientDisconnectAt = undefined;
  return recent;
}
