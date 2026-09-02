const APPROVED_QUAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function assertQualificationSupabaseUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("QUALIFICATION_SUPABASE_URL is empty");
  try {
    const parsed = new URL(trimmed);
    if (!APPROVED_QUAL_HOSTS.has(parsed.hostname)) {
      throw new Error(
        `Refusing qualification against non-local Supabase URL: ${parsed.hostname}. ` +
          "Use http://127.0.0.1:54321 only.",
      );
    }
    if (parsed.port && parsed.port !== "54321") {
      throw new Error(`Unexpected qualification API port: ${parsed.port}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing")) throw error;
    throw new Error(`Invalid qualification Supabase URL: ${trimmed}`);
  }
}

export function qualificationMailpitSmtpEnv(): Record<string, string> {
  return {
    E2E_CUSTOMER_PORTAL_QUAL: "1",
    FORM_INBOX_PROVIDER: "imap",
    QUALIFICATION_SMTP_HOST: process.env.QUALIFICATION_SMTP_HOST || "127.0.0.1",
    QUALIFICATION_SMTP_PORT: process.env.QUALIFICATION_SMTP_PORT || "54325",
    SMTP_HOST: process.env.QUALIFICATION_SMTP_HOST || "127.0.0.1",
    SMTP_PORT: process.env.QUALIFICATION_SMTP_PORT || "54325",
    SMTP_SECURE: "false",
    SMTP_USER: "qual@local.test",
    SMTP_PASSWORD: "qual-local-smtp",
    SMTP_PASS: "qual-local-smtp",
    SMTP_FROM_EMAIL: "qual@local.test",
    SMTP_FROM_NAME: "McCoy Qual",
  };
}
