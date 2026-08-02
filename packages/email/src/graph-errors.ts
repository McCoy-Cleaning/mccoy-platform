/**
 * Map Microsoft Entra / Graph error codes to clear Dutch operator guidance.
 * Never include secrets or full tokens in messages.
 */

/** Token endpoint (client credentials) failures. */
export function formatGraphTokenError(
  code: string,
  detail: string,
  httpStatus: number,
): string {
  const c = code.toLowerCase();
  const d = detail.toLowerCase();

  if (
    c === "invalid_client" ||
    /aadsts7000215|aadsts7000216|aadsts700016|client secret|secret is expired|invalid client secret/i.test(
      `${c} ${d}`,
    )
  ) {
    return (
      "Microsoft Graph authenticatie mislukt: ongeldige of verlopen CLIENT_SECRET " +
      `(${code}). Maak een nieuw client secret in Entra (appregistratie) en werk .env bij.`
    );
  }

  if (
    c === "unauthorized_client" ||
    /aadsts70011|aadsts65001|aadsts500011|does not have.*permission|consent/i.test(
      `${c} ${d}`,
    )
  ) {
    return (
      "Microsoft Graph authenticatie mislukt: ontbrekende app-rechten of admin consent " +
      `(${code}). Voeg Application permissions toe (Mail.Read; Mail.Send voor antwoorden via Graph) ` +
      "en geef admin consent in Entra."
    );
  }

  if (
    c === "invalid_request" ||
    /aadsts90002|aadsts900023|tenant|was not found/i.test(`${c} ${d}`)
  ) {
    return (
      "Microsoft Graph authenticatie mislukt: ongeldige TENANT_ID " +
      `(${code}). Controleer de Directory (tenant) ID in Entra.`
    );
  }

  if (/aadsts700016|application.*not found/i.test(`${c} ${d}`)) {
    return (
      "Microsoft Graph authenticatie mislukt: CLIENT_ID / APPLICATION_ID hoort niet bij deze tenant " +
      `(${code}). Controleer Application (client) ID en tenant.`
    );
  }

  const clipped = detail.trim().slice(0, 180);
  return (
    `Microsoft Graph authenticatie mislukt (${code || `http_${httpStatus}`}).` +
    (clipped ? ` ${clipped}` : "") +
    " Controleer TENANT_ID, CLIENT_ID/APPLICATION_ID, CLIENT_SECRET, " +
    "Application permissions (Mail.Read) met admin consent, en mailbox-toegang voor GRAPH_MAILBOX."
  );
}

/** Graph REST API failures after a token was obtained. */
export function formatGraphApiError(input: {
  status: number;
  code: string;
  detail: string;
  mailbox: string;
}): string {
  const { status, code, detail, mailbox } = input;
  const blob = `${code} ${detail}`.toLowerCase();

  if (status === 401 || /invalidauthenticationtoken|unauthenticated/i.test(blob)) {
    return (
      `Microsoft Graph token geweigerd (${code}). Vernieuw CLIENT_SECRET of controleer ` +
      "of de app nog bestaat in de tenant."
    );
  }

  if (
    status === 403 ||
    code === "ErrorAccessDenied" ||
    /accessdenied|forbidden|authorization_requestdenied/i.test(blob)
  ) {
    if (/applicationaccesspolicy|mailbox|not allowed|access.*denied.*mailbox/i.test(blob)) {
      return (
        `Microsoft Graph mag mailbox ${mailbox} niet openen (${code}). ` +
        "Stel een Exchange Application Access Policy in (of equivalent) zodat deze Entra-app " +
        "toegang heeft tot GRAPH_MAILBOX, en controleer admin consent op Mail.Read."
      );
    }
    return (
      `Microsoft Graph toegang geweigerd (${code}). Checklist: ` +
      "(1) Application permissions Mail.Read (lezen), Mail.Send (antwoorden/verzenden) en " +
      "Mail.ReadWrite (verwijderen + markeren als gelezen) met admin consent, " +
      `(2) app mag mailbox ${mailbox} openen (Application Access Policy), ` +
      "(3) juiste TENANT_ID / CLIENT_ID / CLIENT_SECRET."
    );
  }

  if (status === 404 || /ErrorItemNotFound|MailboxNotEnabledForRESTAPI/i.test(blob)) {
    if (/MailboxNotEnabledForRESTAPI/i.test(blob)) {
      return (
        `Mailbox ${mailbox} ondersteunt geen Graph REST API (${code}). ` +
        "Controleer of het een gelicentieerde Exchange Online-mailbox is."
      );
    }
    return (
      `Mailbox of bericht niet gevonden via Graph (${mailbox}, ${code}). ` +
      "Controleer GRAPH_MAILBOX (UPN/SMTP) en of de mailbox in deze tenant bestaat."
    );
  }

  const clipped = detail.trim().slice(0, 180);
  return `Microsoft Graph-fout (${code}).${clipped ? ` ${clipped}` : ""}`;
}

/** Graph REST failures for move/delete/mark-read (needs Mail.ReadWrite, not Mail.Read alone). */
export function formatGraphMailWriteError(input: {
  status: number;
  code: string;
  detail: string;
  mailbox: string;
}): string {
  const base = formatGraphApiError(input);
  const blob = `${input.code} ${input.detail}`.toLowerCase();
  if (
    input.status === 403 ||
    input.code === "ErrorAccessDenied" ||
    /accessdenied|forbidden|authorization_requestdenied/i.test(blob)
  ) {
    return (
      `${base} Verwijderen uit Aanvragen vereist Application permission Mail.ReadWrite ` +
      "(naast Mail.Read) met admin consent in Entra."
    );
  }
  return base;
}
