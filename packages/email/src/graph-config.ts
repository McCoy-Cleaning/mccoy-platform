/**
 * Microsoft Graph (Entra ID app-only) configuration for Aanvragen mailbox access.
 * Server-only — never import from browser code.
 */
import { readServerEnv } from "@mccoy/security";

export type GraphMailConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** UPN or mailbox SMTP address used in /users/{mailbox}/... */
  mailbox: string;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = readServerEnv(name);
    if (value) return value;
  }
  return "";
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

function resolveMailbox(): string {
  const candidates = [
    firstEnv(
      "GRAPH_MAILBOX",
      "MICROSOFT_GRAPH_MAILBOX",
      "MS_MAILBOX",
      "AZURE_MAILBOX",
    ),
    readServerEnv("SMTP_USER"),
    readServerEnv("FORM_INBOX_USER"),
    readServerEnv("SMTP_FROM_EMAIL"),
    readServerEnv("FORM_TO_EMAIL"),
  ];
  for (const raw of candidates) {
    const email = extractEmailAddress(raw);
    if (email && EMAIL_RE.test(email)) return email;
  }
  return "";
}

/**
 * Accept common Entra / Azure / MS naming for app-only Graph credentials.
 * Prefer MICROSOFT_GRAPH_* / AZURE_* / MS_* over bare CLIENT_ID to avoid collisions.
 * Azure Portal labels the app id as "Application (client) ID" — also accept APPLICATION_ID.
 */
export function getGraphMailConfig(): GraphMailConfig | null {
  const tenantId = normalizeTenantId(
    firstEnv(
      "MICROSOFT_GRAPH_TENANT_ID",
      "AZURE_TENANT_ID",
      "MS_TENANT_ID",
      "TENANT_ID",
    ),
  );
  const clientId = firstEnv(
    "MICROSOFT_GRAPH_CLIENT_ID",
    "AZURE_CLIENT_ID",
    "MS_CLIENT_ID",
    "CLIENT_ID",
    "APPLICATION_ID",
    "AZURE_APPLICATION_ID",
    "MS_APPLICATION_ID",
  );
  const clientSecret = firstEnv(
    "MICROSOFT_GRAPH_CLIENT_SECRET",
    "AZURE_CLIENT_SECRET",
    "MS_CLIENT_SECRET",
    "CLIENT_SECRET",
  );
  const mailbox = resolveMailbox();

  if (!tenantId || !clientId || !clientSecret || !mailbox) {
    return null;
  }

  return { tenantId, clientId, clientSecret, mailbox };
}

const TENANT_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Recover from accidental `prefix=uuid` paste into TENANT_ID (dotenv keeps everything
 * after the first `=`). Prefer a UUID substring when the raw value is not a bare UUID.
 */
function normalizeTenantId(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (TENANT_UUID_RE.test(value) && value.length === 36) return value;
  const match = value.match(TENANT_UUID_RE);
  return match ? match[0] : value;
}

export function isGraphMailConfigured(): boolean {
  return getGraphMailConfig() !== null;
}
