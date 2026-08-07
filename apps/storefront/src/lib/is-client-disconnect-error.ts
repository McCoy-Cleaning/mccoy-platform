/**
 * Detect client-gone / socket-reset failures during SSR.
 *
 * Vite HMR, SPA navigations, admin iframe remounts, and browser reloads often
 * abort an in-flight SSR request. Node reports that as ECONNRESET/`aborted`;
 * h3 then wraps it as an unhandled HTTPError 500. That is not an app bug —
 * the client already left — so the storefront must not treat it as catastrophic.
 */

type Errorish = {
  name?: string;
  message?: string;
  code?: string | number;
  cause?: unknown;
  status?: number;
  unhandled?: boolean;
};

function asErrorish(value: unknown): Errorish | null {
  if (!value || typeof value !== "object") return null;
  return value as Errorish;
}

function collectCodes(error: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  const e = asErrorish(error);
  if (!e) return [];
  const codes: string[] = [];
  if (e.code != null) codes.push(String(e.code));
  if (e.cause) codes.push(...collectCodes(e.cause, depth + 1));
  return codes;
}

function collectMessages(error: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  const e = asErrorish(error);
  if (!e) {
    if (typeof error === "string") return [error];
    return [];
  }
  const parts: string[] = [];
  if (e.name) parts.push(e.name);
  if (e.message) parts.push(e.message);
  if (e.cause) parts.push(...collectMessages(e.cause, depth + 1));
  return parts;
}

const DISCONNECT_CODES = new Set([
  "ECONNRESET",
  "ECONNABORTED",
  "EPIPE",
  "ECANCELED",
  "ABORT_ERR",
]);

/**
 * True when `error` (or its cause chain) is a client disconnect / request abort
 * rather than an application failure.
 */
export function isClientDisconnectError(error: unknown): boolean {
  if (error == null) return false;

  const codes = collectCodes(error).map((c) => c.toUpperCase());
  if (codes.some((c) => DISCONNECT_CODES.has(c))) return true;

  const text = collectMessages(error).join(" ").toLowerCase();
  if (!text) return false;

  if (/\baborterror\b/.test(text)) return true;
  if (/\beconnreset\b/.test(text)) return true;
  if (/\beconnaborted\b/.test(text)) return true;
  if (/\bsocket hang up\b/.test(text)) return true;
  // Node's abortIncoming uses message "aborted" — match whole word only.
  if (/\baborted\b/.test(text)) return true;

  return false;
}
