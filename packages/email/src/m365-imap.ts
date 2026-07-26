/**
 * Microsoft 365 / Exchange Online IMAP guidance.
 * M365 disables IMAP basic auth; use Microsoft Graph for Admin → Aanvragen reads.
 */

export function isMicrosoft365ImapHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return (
    h === "outlook.office365.com" ||
    h === "outlook.office.com" ||
    h.includes("office365") ||
    /(?:^|\.)outlook\.office(?:365)?\.com$/.test(h) ||
    h === "imap-mail.outlook.com"
  );
}

/** Dutch operator-facing message when IMAP basic auth cannot work on M365. */
export function microsoft365ImapBasicAuthBlockedMessage(user?: string): string {
  const who = user?.trim() ? ` Gebruiker: ${user.trim()}.` : "";
  return (
    "Microsoft 365 blokkeert IMAP-login met alleen gebruikersnaam/wachtwoord " +
    "(basic auth is uitgeschakeld). SMTP kan wel werken voor verzenden; lezen moet via " +
    "Microsoft Graph (FORM_INBOX_PROVIDER=graph of auto met TENANT_ID / CLIENT_ID / " +
    "CLIENT_SECRET + GRAPH_MAILBOX). Alternatief: Gmail-mailbox met App Password " +
    `(FORM_INBOX_PROVIDER=imap).${who}`
  );
}
