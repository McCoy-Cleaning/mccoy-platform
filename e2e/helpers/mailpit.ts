const DEFAULT_MAILPIT_URL = "http://127.0.0.1:54324";

export type MailpitMessageSummary = {
  ID: string;
  MessageID: string;
  Subject: string;
  To: Array<{ Address: string }>;
  Created: string;
};

export type MailpitMessage = MailpitMessageSummary & {
  Text?: string;
  HTML?: string;
};

function mailpitBase(): string {
  return (process.env.MAILPIT_URL || process.env.INBUCKET_URL || DEFAULT_MAILPIT_URL).replace(
    /\/$/,
    "",
  );
}

export async function isMailpitReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${mailpitBase()}/api/v1/messages`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listMailpitMessages(): Promise<MailpitMessageSummary[]> {
  const res = await fetch(`${mailpitBase()}/api/v1/messages`);
  if (!res.ok) throw new Error(`Mailpit list failed: ${res.status}`);
  const body = (await res.json()) as { messages?: MailpitMessageSummary[] };
  return body.messages ?? [];
}

export async function listMailpitMessagesSafe(): Promise<MailpitMessageSummary[]> {
  try {
    return await listMailpitMessages();
  } catch {
    return [];
  }
}

export async function getMailpitMessage(id: string): Promise<MailpitMessage> {
  const res = await fetch(`${mailpitBase()}/api/v1/message/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Mailpit get message failed: ${res.status}`);
  return (await res.json()) as MailpitMessage;
}

export async function waitForMailpitMessage(
  toEmail: string,
  options: { subjectIncludes?: string; timeoutMs?: number; afterIdCount?: number } = {},
): Promise<MailpitMessage> {
  const normalized = toEmail.trim().toLowerCase();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const start = Date.now();
  /** Total mailbox size before the action that should produce mail (newest-first list). */
  const priorTotal = options.afterIdCount;

  while (Date.now() - start < timeoutMs) {
    const messages = await listMailpitMessages();
    // Prefer newest arrivals, but always fall back to a full recipient scan so
    // concurrent Auth noise cannot hide the message we care about.
    const newestPool =
      priorTotal != null ? messages.slice(0, Math.max(0, messages.length - priorTotal)) : messages;
    const pools = priorTotal != null && newestPool.length > 0 ? [newestPool, messages] : [messages];

    for (const pool of pools) {
      const match = pool.find((m) => {
        const to = m.To?.some((t) => t.Address?.toLowerCase() === normalized);
        if (!to) return false;
        if (
          options.subjectIncludes &&
          !m.Subject?.toLowerCase().includes(options.subjectIncludes.toLowerCase())
        ) {
          return false;
        }
        return true;
      });
      if (match) return getMailpitMessage(match.ID);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Mailpit: no message for ${toEmail} within ${timeoutMs}ms`);
}

export function extractFirstUrl(text: string, pathHint: string): string | null {
  const re = new RegExp(`https?:\\/\\/[^\\s"'<>]+${pathHint}[^\\s"'<>]*`, "i");
  const match = text.match(re);
  return match?.[0] ?? null;
}

export function extractActivationUrl(text: string): string | null {
  return extractFirstUrl(text, "/account/activate");
}

export function extractPasswordResetUrl(text: string): string | null {
  return extractFirstUrl(text, "/account/reset-password") ?? extractFirstUrl(text, "type=recovery");
}

/**
 * Supabase Auth emails often contain `/auth/v1/verify?...&redirect_to=...`.
 * Local GoTrue defaults redirect_to to :3000 when the intended storefront origin
 * is not allow-listed — rewrite so Playwright lands on the running storefront.
 */
export function normalizeAuthEmailUrl(
  rawUrl: string,
  storefrontOrigin: string,
  path = "/account/reset-password",
): string {
  const targetOrigin = storefrontOrigin.replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.pathname.includes("/auth/v1/verify") || url.searchParams.has("redirect_to")) {
    const desired = `${targetOrigin}${path.startsWith("/") ? path : `/${path}`}`;
    url.searchParams.set("redirect_to", desired);
    return url.toString();
  }

  if (url.pathname.includes("/account/reset-password") || url.pathname.includes("/account/activate")) {
    return `${targetOrigin}${url.pathname}${url.search}${url.hash}`;
  }

  return rawUrl;
}
