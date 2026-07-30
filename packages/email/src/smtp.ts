/**
 * Shared Nodemailer SMTP transport for McCoy transactional email.
 * Prefer explicit SMTP_*; otherwise reuse FORM_INBOX_* (Gmail App Password).
 */
import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import { readServerEnv } from "@mccoy/security";

export type SmtpAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: "base64";
};

export type SendSmtpMailInput = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  bcc?: string | string[];
  headers?: Record<string, string>;
  attachments?: SmtpAttachment[];
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

let cachedTransport: Transporter | null = null;
let cachedKey = "";

function parsePort(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function smtpPassword(): string {
  return (
    readServerEnv("SMTP_PASS") ||
    readServerEnv("SMTP_PASSWORD") ||
    readServerEnv("FORM_INBOX_PASS") ||
    ""
  );
}

/**
 * Resolve SMTP settings. Gmail IMAP credentials can send via smtp.gmail.com:587.
 * Auth user: SMTP_USER → SMTP_FROM_EMAIL → FORM_INBOX_USER
 * Password: SMTP_PASS → SMTP_PASSWORD → FORM_INBOX_PASS
 */
export function getSmtpConfig(): SmtpConfig | null {
  const user =
    readServerEnv("SMTP_USER") ||
    readServerEnv("SMTP_FROM_EMAIL") ||
    readServerEnv("FORM_INBOX_USER") ||
    "";
  const pass = smtpPassword();
  if (!user || !pass) return null;

  const inboxHost = readServerEnv("FORM_INBOX_HOST").toLowerCase();
  const defaultHost =
    inboxHost.includes("gmail") || user.toLowerCase().endsWith("@gmail.com")
      ? "smtp.gmail.com"
      : inboxHost.replace(/^imap\./, "smtp.") || "smtp.gmail.com";

  const host = readServerEnv("SMTP_HOST") || defaultHost;
  const port = parsePort(readServerEnv("SMTP_PORT"), 587);
  const secureEnv = readServerEnv("SMTP_SECURE").toLowerCase();
  const secure =
    secureEnv === "true" || secureEnv === "1" || port === 465;

  return { host, port, secure, user, pass };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

/**
 * True when SMTP is likely usable for outbound mail.
 * Microsoft 365 usually has SmtpClientAuthentication disabled — treating those
 * hosts as "configured" previously stole invites from working Supabase Auth mail.
 */
export function isSmtpUsableForOutbound(): boolean {
  const config = getSmtpConfig();
  if (!config) return false;
  const host = config.host.toLowerCase();
  if (
    host.includes("office365.com") ||
    host.includes("outlook.com") ||
    host.includes("outlook.office.com")
  ) {
    return false;
  }
  return true;
}

function getTransport(): Transporter {
  const config = getSmtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured.");
  }
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (!cachedTransport || cachedKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    cachedKey = key;
  }
  return cachedTransport;
}

/** Build `Name <email>` From header from env. */
export function defaultTransactionalFrom(): string {
  const explicit = readServerEnv("FORM_FROM_EMAIL");
  if (explicit) return explicit;

  const email =
    readServerEnv("SMTP_FROM_EMAIL") ||
    readServerEnv("SMTP_USER") ||
    readServerEnv("FORM_INBOX_USER");
  if (!email) return "McCoy Website <noreply@localhost>";

  const name = readServerEnv("SMTP_FROM_NAME") || "McCoy Website";
  if (email.includes("<")) return email;
  return `${name} <${email}>`;
}

export async function sendSmtpMail(
  input: SendSmtpMailInput,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      error:
        "E-mailverzending is niet geconfigureerd. Stel SMTP_HOST/PORT, SMTP_FROM_EMAIL, SMTP_PASSWORD (of SMTP_USER/SMTP_PASS) in.",
    };
  }

  try {
    const transport = getTransport();
    const mail: SendMailOptions = {
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      bcc: input.bcc,
      headers: input.headers,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        encoding: a.encoding,
      })),
    };
    const info = await transport.sendMail(mail);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 240) : "SMTP send failed";
    console.error("[email] SMTP send failed", message);
    return { ok: false, error: message };
  }
}
