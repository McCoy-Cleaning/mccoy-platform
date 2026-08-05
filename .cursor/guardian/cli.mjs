#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findRoot, loadPolicies } from "./lib/config.mjs";
import { readJson, writeJson } from "./lib/io.mjs";
import { sanitizedInventory } from "./checks/mcp.mjs";
import { checkArchitecture } from "./checks/architecture.mjs";
import { checkReuse } from "./checks/reuse.mjs";
import { checkRefactor } from "./checks/refactor.mjs";
import { scanFile } from "./checks/security.mjs";
import { listFiles } from "./lib/project.mjs";
import { runQualification } from "./checks/qualification.mjs";
import { run } from "./lib/process.mjs";

const root = findRoot();
const policies = loadPolicies(root);
const command = process.argv[2] ?? "help";

function print(value) {
  process.stdout.write(typeof value === "string" ? value + "\n" : JSON.stringify(value, null, 2) + "\n");
}

if (command === "doctor") {
  const checks = {
    node: Number(process.versions.node.split(".")[0]) >= 20,
    hooks: fs.existsSync(path.join(root, ".cursor", "hooks.json")),
    guardianPolicy: fs.existsSync(policies.paths.guardianPolicy),
    architecturePolicy: fs.existsSync(policies.paths.architecturePolicy),
    mcpPolicy: fs.existsSync(policies.paths.mcpPolicy)
  };
  const hooks = readJson(path.join(root, ".cursor", "hooks.json"), {});
  const expected = ["sessionStart","beforeSubmitPrompt","beforeReadFile","beforeShellExecution","afterShellExecution","beforeMCPExecution","afterMCPExecution","afterFileEdit","stop"];
  checks.hookEvents = Object.fromEntries(expected.map((event) => [event, Boolean(hooks.hooks?.[event]?.some((h) => h.command?.includes("guardian-hook.mjs")))]));
  print(checks);
  process.exit(Object.values(checks).some((v) => v === false) || Object.values(checks.hookEvents).some((v) => !v) ? 1 : 0);
}

if (command === "inventory") {
  print(sanitizedInventory(root));
  process.exit(0);
}

if (command === "bootstrap-mcp") {
  const inventory = sanitizedInventory(root);
  const local = readJson(policies.paths.localMcpPolicy, { version: 1, servers: {} });
  local.servers ??= {};
  for (const name of Object.keys(inventory.servers)) {
    local.servers[name] ??= { enabled: true, trust: "review", allowedTools: [], blockedTools: [] };
  }
  writeJson(policies.paths.localMcpPolicy, local);
  print(`Wrote ${policies.paths.localMcpPolicy}\nReview discovered servers before allowing write tools.`);
  process.exit(inventory.findings.some((f) => f.severity === "error") ? 1 : 0);
}

if (command === "approve-mcp") {
  const name = process.argv[3];
  if (!name) throw new Error("Usage: approve-mcp SERVER [--tools a,b,c]");
  const toolIndex = process.argv.indexOf("--tools");
  const tools = toolIndex >= 0 ? String(process.argv[toolIndex + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];
  const local = readJson(policies.paths.localMcpPolicy, { version: 1, servers: {} });
  local.servers ??= {};
  local.servers[name] = {
    enabled: true,
    trust: tools.length ? "approved" : "review",
    allowedTools: tools,
    blockedTools: local.servers[name]?.blockedTools ?? []
  };
  writeJson(policies.paths.localMcpPolicy, local);
  print(`Approved ${name}${tools.length ? ` tools: ${tools.join(", ")}` : " in read-only review mode"}.`);
  process.exit(0);
}

if (command === "verify") {
  const files = listFiles(root, { extensions: policies.guardian.sourceExtensions, sourceRoots: policies.guardian.sourceRoots, maxFiles: 8000 });
  const changed = detectChangedFiles(root).filter((file) => fs.existsSync(file));
  const qualificationFiles = changed.length ? changed : [];
  const findings = [
    ...files.flatMap(scanFile),
    ...checkArchitecture(root, policies.guardian, policies.architecture, qualificationFiles),
    ...checkReuse(root, policies.guardian, policies.guardian.reuse ?? {}, qualificationFiles),
    ...checkRefactor(qualificationFiles, policies.guardian.refactor ?? {})
  ];
  const qualification = runQualification(root, policies.guardian, qualificationFiles);
  const errors = findings.filter((f) => f.severity === "error");
  print({ findings, qualification, decision: errors.length || !qualification.ok ? "blocked" : "qualified" });
  process.exit(errors.length || !qualification.ok ? 1 : 0);
}

if (command === "smoke") {
  await import("./tests/smoke.mjs");
  process.exit(process.exitCode ?? 0);
}

if (command === "explain") {
  const inventory = sanitizedInventory(root);
  print({
    root,
    mode: policies.guardian.mode,
    configuredMcpServers: Object.keys(inventory.servers),
    approvedMcpServers: Object.keys(policies.mcp.servers ?? {}),
    architecture: policies.architecture,
    reuse: policies.guardian.reuse,
    refactor: policies.guardian.refactor,
    qualification: policies.guardian.qualification
  });
  process.exit(0);
}

function detectChangedFiles(root) {
  const base = process.env.GITHUB_BASE_REF;
  const args = base ? ["diff", "--name-only", `origin/${base}...HEAD`] : ["diff", "--name-only", "HEAD"];
  let result = run("git", args, { cwd: root, timeout: 60_000 });
  if (!result.ok && base) result = run("git", ["diff", "--name-only", "HEAD^...HEAD"], { cwd: root, timeout: 60_000 });
  if (!result.ok) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean).map((file) => path.resolve(root, file));
}

print(`Cursor Guardian commands:
  doctor
  inventory
  bootstrap-mcp
  approve-mcp SERVER [--tools a,b,c]
  verify
  smoke
  explain`);
