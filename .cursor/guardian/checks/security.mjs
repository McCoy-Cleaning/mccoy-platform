import path from "node:path";
import { safeRead, normalizeSlashes } from "../lib/io.mjs";

const SECRET_PATTERNS = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["openai-style-key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/]
];

const RISK_PATTERNS = [
  ["dynamic-eval", /\b(eval|new Function)\s*\(/, "Dynamic code execution requires explicit justification."],
  ["tls-disabled", /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/, "TLS verification is disabled."],
  ["wildcard-cors", /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|cors\s*\(\s*\{\s*origin\s*:\s*["']\*["']/, "Wildcard CORS can expose authenticated endpoints."],
  ["dangerous-html", /dangerouslySetInnerHTML|v-html\s*=|{@html\s+/, "Raw HTML injection needs sanitization and a documented source."],
  ["weak-token-randomness", /Math\.random\(\).*(token|secret|nonce|password)|(token|secret|nonce|password).*Math\.random\(\)/i, "Math.random is not suitable for security tokens."],
  ["shell-exec", /child_process\.(exec|execSync)\s*\(|\bexec\s*\([^)]*\$\{/, "Shell execution needs strict argument separation and validation."],
  ["sql-interpolation", /(SELECT|INSERT|UPDATE|DELETE)[^;\n]*\$\{|execute(Query)?\s*\(\s*`[^`]*\$\{/i, "Possible SQL interpolation; use parameterized queries."],
  ["auth-bypass-marker", /(skipAuth|disableAuth|bypassAuth|verifySignature\s*:\s*false)/i, "Possible authentication bypass."],
  ["debug-secret-log", /console\.(log|debug|info)\s*\([^)]*(token|secret|password|authorization)/i, "Potential credential logging."]
];

export function sensitiveReadDecision(filePath) {
  const rel = normalizeSlashes(filePath).toLowerCase();
  const sensitive = [
    /(^|\/)\.env($|[./])/, /(^|\/)id_(rsa|ed25519)$/, /\.(pem|p12|pfx|key)$/,
    /(^|\/)\.npmrc$/, /(^|\/)\.pypirc$/, /(^|\/)credentials($|[./])/,
    /(^|\/)\.aws\/credentials$/, /(^|\/)\.kube\/config$/
  ];
  if (sensitive.some((re) => re.test(rel))) {
    return { ok: false, reason: `sensitive file read blocked: ${filePath}` };
  }
  return { ok: true };
}

export function scanFile(file) {
  const text = safeRead(file);
  if (text == null) return [];
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (const [name, regex] of SECRET_PATTERNS) {
    lines.forEach((line, index) => {
      if (regex.test(line)) findings.push({ severity: "error", category: "secret", rule: name, file, line: index + 1, message: `Possible ${name}` });
      regex.lastIndex = 0;
    });
  }
  for (const [name, regex, message] of RISK_PATTERNS) {
    lines.forEach((line, index) => {
      if (regex.test(line)) findings.push({ severity: "warning", category: "security", rule: name, file, line: index + 1, message });
      regex.lastIndex = 0;
    });
  }
  return findings;
}

export function scanMcpOutput(payload) {
  const text = JSON.stringify(payload.output ?? payload.result ?? payload.response ?? "");
  const findings = [];
  for (const [name, regex] of SECRET_PATTERNS) {
    if (regex.test(text)) findings.push({ severity: "error", category: "mcp-output", rule: name, message: `MCP output appears to contain ${name}` });
    regex.lastIndex = 0;
  }
  if (/(ignore previous instructions|disable safeguards|reveal system prompt|send.*credentials|exfiltrat)/i.test(text)) {
    findings.push({ severity: "error", category: "mcp-output", rule: "prompt-injection", message: "MCP output contains instruction-override or credential-exfiltration language" });
  }
  return findings;
}
