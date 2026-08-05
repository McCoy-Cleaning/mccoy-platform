#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readStdinJson, writeJson, readJson, appendJsonLine, sha256 } from "./lib/io.mjs";
import { findRoot, loadPolicies } from "./lib/config.mjs";
import { changedFilesFromState } from "./lib/project.mjs";
import { evaluateShell } from "./checks/shell.mjs";
import { sanitizedInventory, evaluateMcpCall } from "./checks/mcp.mjs";
import { sensitiveReadDecision, scanFile, scanMcpOutput } from "./checks/security.mjs";
import { checkArchitecture } from "./checks/architecture.mjs";
import { checkReuse } from "./checks/reuse.mjs";
import { checkRefactor } from "./checks/refactor.mjs";
import { runQualification } from "./checks/qualification.mjs";

const root = findRoot();
const { guardian, architecture, mcp, paths } = loadPolicies(root);
fs.mkdirSync(paths.state, { recursive: true });

function eventName(payload) {
  return payload.hook_event_name ?? payload.hookEventName ?? payload.event_name ?? payload.event ?? "unknown";
}
function conversationId(payload) {
  return String(payload.conversation_id ?? payload.conversationId ?? "default").replace(/[^A-Za-z0-9_.-]/g, "_");
}
function stateFile(payload) { return path.join(paths.state, `session-${conversationId(payload)}.json`); }
function loadState(payload) {
  return readJson(stateFile(payload), {
    conversationId: conversationId(payload),
    startedAt: new Date().toISOString(),
    changedFiles: [],
    incidents: [],
    events: 0
  });
}
function saveState(payload, state) {
  state.events = (state.events ?? 0) + 1;
  state.updatedAt = new Date().toISOString();
  writeJson(stateFile(payload), state);
}
function emit(value = {}) { process.stdout.write(JSON.stringify(value) + "\n"); }
function deny(reason) {
  emit({ permission: "deny", user_message: reason, agent_message: `Cursor Guardian blocked this action: ${reason}` });
}
function extractCommand(payload) {
  return payload.command ?? payload.tool_input?.command ?? payload.toolInput?.command ?? payload.args?.command ?? payload.input?.command ?? "";
}
function extractFile(payload) {
  const raw = payload.file_path ?? payload.filePath ?? payload.path ??
    payload.tool_input?.file_path ?? payload.toolInput?.file_path ?? payload.input?.path ?? "";
  return raw ? path.resolve(root, raw) : "";
}
function recordEvent(event, payload, extra = {}) {
  appendJsonLine(path.join(paths.state, "events.jsonl"), {
    at: new Date().toISOString(),
    event,
    conversationId: conversationId(payload),
    ...extra
  });
}
function blockingFindings(findings) {
  return findings.filter((item) => item.severity === "error");
}
function formatFindings(findings, max = 20) {
  return findings.slice(0, max).map((f) => {
    const location = f.file ? `${path.relative(root, f.file)}${f.line ? `:${f.line}` : ""}: ` : "";
    return `- [${f.severity}] ${location}${f.message}`;
  }).join("\n");
}

async function main() {
  const payload = await readStdinJson();
  const event = eventName(payload);
  const state = loadState(payload);
  recordEvent(event, payload);

  if (event === "sessionStart") {
    const inventory = sanitizedInventory(root);
    state.mcpInventoryHash = sha256(JSON.stringify(inventory.servers));
    state.mcpInventoryFindings = inventory.findings;
    saveState(payload, state);
    emit({});
    return;
  }

  if (event === "beforeSubmitPrompt") {
    state.lastPromptHash = sha256(payload.prompt ?? payload.message ?? "");
    saveState(payload, state);
    emit({});
    return;
  }

  if (event === "beforeReadFile") {
    const file = extractFile(payload);
    const decision = sensitiveReadDecision(file);
    if (!decision.ok && guardian.security?.blockSensitiveReads !== false) {
      deny(decision.reason);
      return;
    }
    emit({ permission: "allow" });
    return;
  }

  if (event === "beforeShellExecution") {
    const command = extractCommand(payload);
    const decision = evaluateShell(command, guardian.security ?? {});
    recordEvent(event, payload, { commandHash: sha256(command), decision });
    if (!decision.ok) {
      state.incidents.push({ at: new Date().toISOString(), type: "shell", contained: true, ...decision });
      saveState(payload, state);
      deny(decision.reason);
      return;
    }
    emit({ permission: "allow" });
    return;
  }

  if (event === "afterShellExecution") {
    state.lastShellExitCode = payload.exit_code ?? payload.exitCode ?? payload.status ?? null;
    saveState(payload, state);
    emit({});
    return;
  }

  if (event === "beforeMCPExecution") {
    const inventory = sanitizedInventory(root);
    const configErrors = inventory.findings.filter((f) => f.severity === "error");
    if (configErrors.length) {
      state.incidents.push(...configErrors.map((item) => ({ at: new Date().toISOString(), type: "mcp-config", contained: false, ...item })));
      saveState(payload, state);
      deny(`MCP configuration is unsafe:\n${configErrors.map((f) => `- ${f.server}: ${f.message}`).join("\n")}`);
      return;
    }

    const decision = evaluateMcpCall(payload, guardian, mcp);
    recordEvent(event, payload, { mcp: decision.identity, decision: { ok: decision.ok, reason: decision.reason } });
    if (!decision.ok) {
      state.incidents.push({ at: new Date().toISOString(), type: "mcp-call", contained: true, server: decision.identity.server, tool: decision.identity.tool, reason: decision.reason });
      saveState(payload, state);
      deny(decision.reason);
      return;
    }
    emit({ permission: "allow" });
    return;
  }

  if (event === "afterMCPExecution") {
    const findings = scanMcpOutput(payload);
    if (findings.length) state.incidents.push(...findings.map((item) => ({ at: new Date().toISOString(), contained: false, ...item })));
    saveState(payload, state);
    emit({});
    return;
  }

  if (event === "afterFileEdit") {
    const file = extractFile(payload);
    if (file && !state.changedFiles.includes(file)) state.changedFiles.push(file);
    const findings = file ? scanFile(file) : [];
    if (findings.length) state.lastEditFindings = findings;
    saveState(payload, state);
    emit({});
    return;
  }

  if (event === "stop") {
    const loopCount = Number(payload.loop_count ?? payload.loopCount ?? 0);
    const changedFiles = changedFilesFromState(state).filter((file) => fs.existsSync(file));
    if (!changedFiles.length) {
      emit({});
      return;
    }

    // Drop stale MCP config incidents once the live inventory is clean.
    const inventory = sanitizedInventory(root);
    const openMcpConfigKeys = new Set(
      inventory.findings
        .filter((f) => f.severity === "error")
        .map((f) => `${f.server ?? ""}|${f.message ?? ""}`)
    );
    state.incidents = (state.incidents ?? []).map((item) => {
      if (item.type !== "mcp-config") return item;
      const key = `${item.server ?? ""}|${item.message ?? item.reason ?? ""}`;
      if (!openMcpConfigKeys.has(key)) return { ...item, contained: true };
      return item;
    });
    saveState(payload, state);

    const findings = [
      ...changedFiles.flatMap(scanFile),
      ...checkArchitecture(root, guardian, architecture, changedFiles),
      ...checkReuse(root, guardian, guardian.reuse ?? {}, changedFiles),
      ...checkRefactor(changedFiles, guardian.refactor ?? {}),
      ...inventory.findings,
      ...(state.incidents ?? []).map((item) => ({ severity: item.contained ? "warning" : "error", category: item.type ?? item.category ?? "incident", message: item.reason ?? item.message ?? "Unresolved governance incident" }))
    ];

    const strictWarnings = [
      ...(guardian.reuse?.strict ? findings.filter((f) => f.category === "reuse" && f.severity === "warning") : []),
      ...(guardian.refactor?.strict ? findings.filter((f) => f.category === "refactor" && f.severity === "warning") : [])
    ];
    const blockers = [...blockingFindings(findings), ...strictWarnings];
    const qualification = runQualification(root, guardian, changedFiles);
    const report = {
      generatedAt: new Date().toISOString(),
      conversationId: conversationId(payload),
      changedFiles: changedFiles.map((file) => path.relative(root, file)),
      findings,
      qualification,
      decision: blockers.length || !qualification.ok ? "blocked" : "qualified"
    };
    const reportFile = path.join(paths.state, `qualification-${conversationId(payload)}.json`);
    writeJson(reportFile, report);

    if ((blockers.length || !qualification.ok) && loopCount < (guardian.maxStopRepairLoops ?? 3)) {
      const sections = [];
      if (blockers.length) sections.push(`Blocking governance findings:\n${formatFindings(blockers)}`);
      if (!qualification.ok) sections.push(`Qualification failures:\n${qualification.blockers.map((b) => `- ${b}`).join("\n")}`);
      const warnings = findings.filter((f) => f.severity === "warning");
      if (warnings.length) sections.push(`Non-blocking design/refactor warnings:\n${formatFindings(warnings, 12)}`);
      sections.push(`Evidence report: ${path.relative(root, reportFile)}`);
      emit({
        followup_message:
          `Cursor Guardian has not qualified this implementation.\n\n${sections.join("\n\n")}\n\n` +
          `Fix the blocking issues, reuse existing abstractions where appropriate, keep the declared architecture boundaries, add or run the missing tests, and attempt completion again. Do not claim the phase is complete until the report decision is qualified.`
      });
      return;
    }

    emit({});
    return;
  }

  emit({});
}

main().catch((error) => {
  const message = `Cursor Guardian hook failure: ${error.stack || error.message}`;
  process.stderr.write(message + "\n");
  emit({ permission: "deny", user_message: message, agent_message: message });
  process.exitCode = 2;
});
