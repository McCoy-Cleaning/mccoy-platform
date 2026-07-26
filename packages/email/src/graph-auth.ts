/**
 * Microsoft Entra client-credentials token for Microsoft Graph.
 * Caches the access token in-process; never logs secrets or tokens.
 */
import { FormInboxConfigError, FormInboxError } from "./form-inbox-contracts";
import { formatGraphTokenError } from "./graph-errors";
import { getGraphMailConfig, type GraphMailConfig } from "./graph-config";

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
  cacheKey: string;
};

let cached: CachedToken | null = null;

const TOKEN_SKEW_MS = 60_000;

function cacheKeyFor(config: GraphMailConfig): string {
  return `${config.tenantId}:${config.clientId}:${config.mailbox}`;
}

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export async function getGraphAccessToken(
  config = getGraphMailConfig(),
): Promise<string> {
  if (!config) {
    throw new FormInboxConfigError(
      "Configure MICROSOFT_GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET (or AZURE_* / MS_* / TENANT_ID + CLIENT_ID|APPLICATION_ID + CLIENT_SECRET) plus GRAPH_MAILBOX or SMTP_USER for Aanvragen via Microsoft Graph.",
    );
  }

  const key = cacheKeyFor(config);
  const now = Date.now();
  if (cached && cached.cacheKey === key && cached.expiresAtMs > now + TOKEN_SKEW_MS) {
    return cached.accessToken;
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "network error";
    console.error("[graph-auth] token request failed", { message });
    throw new FormInboxError(
      `Kon geen Microsoft Graph-token ophalen (${message}). Controleer netwerk en tenant-instellingen.`,
    );
  }

  let json: TokenResponse;
  try {
    json = (await response.json()) as TokenResponse;
  } catch {
    throw new FormInboxError(
      `Microsoft Graph-tokenrespons was ongeldig (HTTP ${response.status}).`,
    );
  }

  if (!response.ok) {
    const code = typeof json.error === "string" ? json.error : `http_${response.status}`;
    const detail =
      typeof json.error_description === "string"
        ? json.error_description.slice(0, 200)
        : "";
    console.error("[graph-auth] token rejected", {
      status: response.status,
      error: code,
      // Never log client_secret or access_token
    });
    throw new FormInboxError(formatGraphTokenError(code, detail, response.status));
  }

  const accessToken =
    typeof json.access_token === "string" ? json.access_token : "";
  const expiresIn =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? json.expires_in
      : 3600;

  if (!accessToken) {
    throw new FormInboxError("Microsoft Graph-tokenrespons miste access_token.");
  }

  cached = {
    accessToken,
    expiresAtMs: now + expiresIn * 1000,
    cacheKey: key,
  };

  return accessToken;
}

/** Test helper / recovery — clears the in-process token cache. */
export function clearGraphAccessTokenCache(): void {
  cached = null;
}
