/**
 * One-off Graph smoke test. Prints presence/lengths and API outcomes only — never secrets/tokens.
 * Usage: node --import tsx scripts/smoke-graph-mail.mts
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv(filePath: string): void {
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function reportKey(name: string): void {
  const raw = process.env[name];
  if (raw === undefined) {
    console.log(`${name}=missing`);
    return;
  }
  const value = raw.trim();
  console.log(`${name}=set (len=${value.length})`);
}

loadDotEnv(resolve(root, ".env"));

console.log("--- env key presence ---");
for (const key of [
  "TENANT_ID",
  "CLIENT_ID",
  "APPLICATION_ID",
  "CLIENT_SECRET",
  "GRAPH_MAILBOX",
  "SMTP_USER",
  "SMTP_FROM_EMAIL",
]) {
  reportKey(key);
}

const { isGraphMailConfigured, getGraphMailConfig } = await import(
  "../packages/email/src/graph-config.ts"
);
const { getGraphAccessToken, clearGraphAccessTokenCache } = await import(
  "../packages/email/src/graph-auth.ts"
);

const configured = isGraphMailConfigured();
const config = getGraphMailConfig();
console.log("--- config ---");
console.log(`graphConfigured=${configured}`);
if (config) {
  console.log(`tenantIdLen=${config.tenantId.length}`);
  console.log(`clientIdLen=${config.clientId.length}`);
  console.log(`clientSecretLen=${config.clientSecret.length}`);
  console.log(`mailbox=${config.mailbox}`);
  console.log(`tenantLooksLikeUuid=${/^[0-9a-f-]{36}$/i.test(config.tenantId)}`);
}

if (!config) {
  console.log("SMOKE=FAIL reason=not_configured");
  process.exit(1);
}

clearGraphAccessTokenCache();

console.log("--- token ---");
try {
  const token = await getGraphAccessToken(config);
  console.log(`tokenOk=true tokenLen=${token.length}`);
} catch (error) {
  const message = error instanceof Error ? error.message.slice(0, 280) : "unknown";
  console.log(`tokenOk=false error=${message}`);
  console.log("SMOKE=FAIL reason=token");
  process.exit(1);
}

console.log("--- mailbox list ---");
const mailbox = encodeURIComponent(config.mailbox);
const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/messages?$top=1&$select=id,subject,receivedDateTime`;
const token = await getGraphAccessToken(config);
let response: Response;
try {
  response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
} catch (error) {
  const message = error instanceof Error ? error.message.slice(0, 160) : "network";
  console.log(`mailboxOk=false error=${message}`);
  console.log("SMOKE=FAIL reason=mailbox_network");
  process.exit(1);
}

const bodyText = await response.text();
let graphCode = "";
let graphMessage = "";
try {
  const json = JSON.parse(bodyText) as {
    error?: { code?: string; message?: string };
    value?: unknown[];
  };
  graphCode = json.error?.code ?? "";
  graphMessage = (json.error?.message ?? "").slice(0, 200);
  if (response.ok) {
    const count = Array.isArray(json.value) ? json.value.length : -1;
    console.log(`mailboxOk=true status=${response.status} messageCount=${count}`);
    console.log("SMOKE=OK");
    process.exit(0);
  }
} catch {
  // non-json
}

console.log(
  `mailboxOk=false status=${response.status} code=${graphCode || "n/a"} message=${graphMessage || bodyText.slice(0, 160)}`,
);
console.log("SMOKE=FAIL reason=mailbox_access");
process.exit(1);
