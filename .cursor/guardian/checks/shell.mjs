const HARD_BLOCKS = [
  { re: /(^|\s)(rm|del)\s+(-[^\s]*r[^\s]*f[^\s]*|\/s\s+\/q)\s+([A-Za-z]:\\|\/|\.{1,2})(\s|$)/i, reason: "recursive destructive deletion" },
  { re: /\bgit\s+reset\s+--hard\b/i, reason: "git reset --hard can destroy uncommitted work" },
  { re: /\bgit\s+clean\s+-[^\s]*[fdx][^\s]*\b/i, reason: "destructive git clean" },
  { re: /\bgit\s+push\b[^\n]*(--force|-f)\b/i, reason: "force push" },
  { re: /\b(terraform|tofu)\s+destroy\b/i, reason: "infrastructure destruction" },
  { re: /\bkubectl\s+delete\b/i, reason: "Kubernetes deletion" },
  { re: /\b(supabase\s+db\s+reset|prisma\s+migrate\s+reset)\b/i, reason: "database reset" },
  { re: /\b(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE)\b/i, reason: "destructive SQL" },
  { re: /\b(curl|wget)\b[^|;\n]*(\||;)\s*(sh|bash|zsh|powershell|pwsh)\b/i, reason: "download-and-execute pipeline" },
  { re: /\b(Invoke-Expression|iex)\b/i, reason: "PowerShell dynamic execution" },
  { re: /\b(cat|type|Get-Content)\b[^\n]*(\.env(\.|$)|id_rsa|id_ed25519|credentials|\.pem\b|\.key\b)/i, reason: "reading credential material into the agent terminal" },
  { re: /\b(printenv|set)\b\s*$/i, reason: "dumping all environment variables" },
  { re: /\b(npm|pnpm|yarn|bun)\b[^\n]*(audit\s+fix\s+--force)/i, reason: "forced dependency rewrite" }
];

export function evaluateShell(command, policy = {}) {
  const text = String(command ?? "").trim();
  if (!text) return { ok: false, severity: "error", reason: "empty or unrecognized shell command payload" };

  for (const allowed of policy.allowedShellPatterns ?? []) {
    if (new RegExp(allowed, "i").test(text)) return { ok: true, reason: "explicitly allowlisted" };
  }
  for (const item of HARD_BLOCKS) {
    if (item.re.test(text)) return { ok: false, severity: "error", reason: item.reason };
  }
  for (const pattern of policy.blockedShellPatterns ?? []) {
    if (new RegExp(pattern, "i").test(text)) return { ok: false, severity: "error", reason: `policy pattern: ${pattern}` };
  }

  if (policy.blockUnpinnedNpx && /\bnpx\b/i.test(text)) {
    const match = text.match(/\bnpx(?:\s+-[^\s]+)*\s+([@A-Za-z0-9_./-]+)/i);
    const pkg = match?.[1] ?? "";
    const hasVersion = /@[^/]+$/.test(pkg) || pkg.startsWith(".") || pkg.includes("/") && !pkg.startsWith("@");
    if (pkg && !hasVersion && !["eslint", "prettier", "tsc", "vitest", "jest"].includes(pkg)) {
      return { ok: false, severity: "error", reason: `unpinned npx package '${pkg}'` };
    }
  }

  if (policy.blockProductionTargets) {
    for (const token of policy.productionTokens ?? []) {
      const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(token)}([^A-Za-z0-9]|$)`, "i");
      if (re.test(text) && /\b(deploy|migrate|reset|delete|destroy|write|apply|push|publish)\b/i.test(text)) {
        return { ok: false, severity: "error", reason: `write-like command targets production token '${token}'` };
      }
    }
  }

  return { ok: true, reason: "no blocking shell policy matched" };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
