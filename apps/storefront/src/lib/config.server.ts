import { readServerEnv } from "@mccoy/security";
import process from "node:process";

// Server-only config. Prefer `@mccoy/security` `readServerEnv` in new code.

function buildSmtpFrom(): string {
  const explicit = readServerEnv("FORM_FROM_EMAIL");
  if (explicit) return explicit;

  const email = readServerEnv("SMTP_FROM_EMAIL") || readServerEnv("SMTP_USER");
  if (!email) return "McCoy Website <noreply@localhost>";
  if (email.includes("<")) return email;

  const name = readServerEnv("SMTP_FROM_NAME") || "McCoy Website";
  return `${name} <${email}>`;
}

function isSmtpAuthConfigured(): boolean {
  const user =
    readServerEnv("SMTP_USER") ||
    readServerEnv("SMTP_FROM_EMAIL") ||
    readServerEnv("FORM_INBOX_USER");
  const pass =
    readServerEnv("SMTP_PASS") ||
    readServerEnv("SMTP_PASSWORD") ||
    readServerEnv("FORM_INBOX_PASS");
  return Boolean(user && pass);
}

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    smtp: {
      host: readServerEnv("SMTP_HOST") || undefined,
      port: readServerEnv("SMTP_PORT") || undefined,
      fromEmail: readServerEnv("SMTP_FROM_EMAIL") || undefined,
      fromName: readServerEnv("SMTP_FROM_NAME") || undefined,
      replyTo: readServerEnv("SMTP_REPLY_TO") || undefined,
      /** True when auth credentials are present. Never exposes the password. */
      configured: isSmtpAuthConfigured(),
    },
    /** @deprecated use smtp.configured */
    smtpConfigured: isSmtpAuthConfigured(),
    formToEmail:
      readServerEnv("FORM_TO_EMAIL") ||
      readServerEnv("SMTP_REPLY_TO") ||
      "oana.dine1571@gmail.com",
    formFromEmail: buildSmtpFrom(),
    adminHost: readServerEnv("ADMIN_HOST") || "admin.mccoy.nl",
    publicHost: readServerEnv("PUBLIC_HOST") || "www.mccoy.nl,mccoy.nl",
    hostEnforce: readServerEnv("HOST_ENFORCE") || "auto",
  };
}
