/**
 * Shared subject helpers for form-inbox filtering and reply correlation.
 * Kept free of Graph/IMAP adapters to avoid circular imports.
 */

/**
 * True for reply/forward subjects — conversation mail, not form submissions.
 * Keep in sync with `@mccoy/domain` `stripReplyForwardPrefixes` (RE/FW/FWD/AW/WG).
 */
export function isReplyOrForwardSubject(subject: string | null | undefined): boolean {
  return /^(?:(?:RE|FW|FWD|AW|WG)\s*:\s*)+/i.test((subject ?? "").trim());
}
