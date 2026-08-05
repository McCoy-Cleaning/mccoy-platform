import fs from "node:fs";
import path from "node:path";
import { candidateMcpFiles } from "../lib/config.mjs";
import { readJson } from "../lib/io.mjs";

export function sanitizedInventory(root) {
  const servers = {};
  const findings = [];

  for (const file of candidateMcpFiles(root)) {
    const config = readJson(file, null);
    if (!config) continue;
    const entries = config.mcpServers ?? config.servers ?? {};
    for (const [name, value] of Object.entries(entries)) {
      const command = value.command ?? null;
      const args = Array.isArray(value.args) ? value.args.map(String) : [];
      const url = value.url ?? value.serverUrl ?? null;
      const envNames = Object.keys(value.env ?? {});
      const record = {
        name,
        source: file,
        transport: url ? "remote" : "local",
        command,
        args: args.map(redactArg),
        url: sanitizeUrl(url),
        envNames
      };
      servers[name] = record;

      if (url && /^http:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url)) {
        findings.push({ severity: "error", server: name, message: "remote MCP uses plaintext HTTP" });
      }
      if (command && /\bnpx(?:\.cmd)?$/i.test(command)) {
        const pkg = args.find((arg) => !arg.startsWith("-")) ?? "";
        if (pkg && !hasPinnedPackageVersion(pkg)) {
          findings.push({ severity: "error", server: name, message: `npx package is not pinned: ${pkg}` });
        }
      }
      for (const [envName, envValue] of Object.entries(value.env ?? {})) {
        if (typeof envValue === "string" && looksLikeLiteralSecret(envValue)) {
          findings.push({ severity: "error", server: name, message: `literal secret appears in MCP config env '${envName}'` });
        }
      }
    }
  }

  return { servers, findings };
}

export function evaluateMcpCall(payload, guardianPolicy, mcpPolicy) {
  const identity = extractMcpIdentity(payload);
  const serverPolicy = mcpPolicy.servers?.[identity.server];
  const combinedArgs = JSON.stringify(identity.arguments ?? {});

  for (const pattern of mcpPolicy.blockedArgumentPatterns ?? []) {
    if (new RegExp(pattern, "i").test(combinedArgs)) {
      return { ok: false, identity, reason: `MCP arguments match blocked sensitive pattern` };
    }
  }
  for (const pattern of mcpPolicy.blockedToolPatterns ?? []) {
    if (new RegExp(pattern, "i").test(identity.tool)) {
      return { ok: false, identity, reason: `MCP tool '${identity.tool}' matches blocked tool pattern` };
    }
  }

  if (!serverPolicy || serverPolicy.enabled === false) {
    return { ok: false, identity, reason: `unknown or unapproved MCP server '${identity.server || "unidentified"}'` };
  }

  const blocked = (serverPolicy.blockedTools ?? []).some((item) => wildcard(item, identity.tool));
  if (blocked) return { ok: false, identity, reason: `tool '${identity.tool}' is explicitly blocked` };

  const allowed = (serverPolicy.allowedTools ?? []).some((item) => wildcard(item, identity.tool));
  if (allowed) return { ok: true, identity, reason: "explicitly approved MCP tool" };

  if (serverPolicy.trust === "review" && guardianPolicy.mcp?.reviewModeAllowsReadOnlyHeuristic) {
    const lower = identity.tool.toLowerCase();
    const writeLike = (guardianPolicy.mcp.writeLikePrefixes ?? []).some((prefix) => lower.startsWith(prefix) || lower.includes(`_${prefix}`));
    const readLike = (guardianPolicy.mcp.readOnlyPrefixes ?? []).some((prefix) => lower.startsWith(prefix) || lower.includes(`_${prefix}`));
    if (readLike && !writeLike) return { ok: true, identity, reason: "review-mode read-only heuristic" };
    return { ok: false, identity, reason: `review-mode MCP tool '${identity.tool}' is not confidently read-only` };
  }

  return { ok: false, identity, reason: `tool '${identity.tool}' is not explicitly approved` };
}

export function extractMcpIdentity(payload) {
  const server = String(
    payload.mcp_server_name ?? payload.server_name ?? payload.server ??
    payload.mcpServerName ?? payload.command ?? "unidentified"
  );
  const tool = String(
    payload.tool_name ?? payload.toolName ?? payload.tool ??
    payload.name ?? payload.function_name ?? "unidentified"
  );
  const argumentsValue =
    payload.arguments ?? payload.args ?? payload.tool_input ?? payload.toolInput ??
    payload.input ?? {};
  return { server, tool, arguments: argumentsValue };
}

function wildcard(pattern, value) {
  if (pattern === "*") return true;
  const re = new RegExp("^" + String(pattern).split("*").map(escapeRegex).join(".*") + "$", "i");
  return re.test(value);
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function redactArg(value) {
  return String(value).replace(/(token|secret|password|key)=\S+/ig, "$1=[REDACTED]");
}
function sanitizeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|key/i.test(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch { return String(value).replace(/(token|secret|password|key)=([^&\s]+)/ig, "$1=[REDACTED]"); }
}
function hasPinnedPackageVersion(pkg) {
  if (pkg.startsWith("@")) return /^@[^/]+\/[^@]+@[^/]+$/.test(pkg);
  return /^[^@]+@[^/]+$/.test(pkg);
}
function looksLikeLiteralSecret(value) {
  if (/^\$\{?.+\}?$/.test(value) || /^%[^%]+%$/.test(value)) return false;
  return value.length >= 16 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
