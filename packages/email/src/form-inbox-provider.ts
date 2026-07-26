/**
 * Explicit control over Admin → Aanvragen mail transport.
 * Server-only — never import from browser code.
 *
 * FORM_INBOX_PROVIDER=imap|graph|auto (default: auto)
 * - imap  — never call Graph; IMAP read + SMTP send (Gmail App Password style)
 * - graph — Graph for inbox list/detail (send may still fall back to SMTP)
 * - auto  — prefer Graph when configured; fall back to IMAP only when host is not M365
 *
 * Microsoft 365: use graph or auto + Graph credentials. IMAP basic auth is blocked on M365.
 */
import { readServerEnv } from "@mccoy/security";

import { isGraphMailConfigured } from "./graph-config";

export type FormInboxProviderMode = "imap" | "graph" | "auto";

export function getFormInboxProviderMode(): FormInboxProviderMode {
  const raw = readServerEnv("FORM_INBOX_PROVIDER").trim().toLowerCase();
  if (!raw || raw === "auto") return "auto";
  // "smtp" is accepted as an alias for forcing IMAP+SMTP (no Graph).
  if (raw === "imap" || raw === "smtp") return "imap";
  if (raw === "graph") return "graph";
  console.warn(
    `[email] Unknown FORM_INBOX_PROVIDER=${JSON.stringify(raw)}; using auto`,
  );
  return "auto";
}

/**
 * Whether Graph should be attempted for inbox/send.
 * False when FORM_INBOX_PROVIDER=imap even if Graph env vars are present.
 */
export function shouldAttemptGraphMail(): boolean {
  if (getFormInboxProviderMode() === "imap") return false;
  return isGraphMailConfigured();
}

/** Whether IMAP may be used for inbox reads (forced or as auto fallback). */
export function shouldAllowImapInbox(): boolean {
  return getFormInboxProviderMode() !== "graph";
}

/** Whether auto mode should fall back to IMAP/SMTP after a Graph failure. */
export function shouldFallbackFromGraph(): boolean {
  return getFormInboxProviderMode() === "auto";
}

export function formInboxConfigHelpMessage(): string {
  const mode = getFormInboxProviderMode();
  if (mode === "imap") {
    return (
      "FORM_INBOX_PROVIDER=imap: configureer SMTP_* / FORM_INBOX_* (Gmail App Password e.d.). " +
      "Microsoft 365 IMAP basic auth werkt niet — zet FORM_INBOX_PROVIDER=graph met Entra-credentials."
    );
  }
  if (mode === "graph") {
    return (
      "FORM_INBOX_PROVIDER=graph: configureer Microsoft Graph " +
      "(TENANT_ID / CLIENT_ID|APPLICATION_ID / CLIENT_SECRET + GRAPH_MAILBOX) " +
      "met Application permissions Mail.Read (+ Mail.Send optioneel) en admin consent. " +
      "SMTP_* kan apart blijven voor verzenden."
    );
  }
  return (
    "Configureer Microsoft Graph (TENANT_ID / CLIENT_ID / CLIENT_SECRET + GRAPH_MAILBOX) voor M365, " +
    "of SMTP_* / FORM_INBOX_* voor Gmail-stijl IMAP (FORM_INBOX_PROVIDER=imap)."
  );
}
