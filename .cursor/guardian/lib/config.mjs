import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { readJson } from "./io.mjs";

export function findRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(current, ".git")) ||
        fs.existsSync(path.join(current, "package.json")) ||
        fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

export function paths(root = findRoot()) {
  const guardian = path.join(root, ".cursor", "guardian");
  return {
    root,
    guardian,
    state: path.join(guardian, ".state"),
    policy: path.join(guardian, "policy"),
    guardianPolicy: path.join(guardian, "policy", "guardian.json"),
    architecturePolicy: path.join(guardian, "policy", "architecture.json"),
    mcpPolicy: path.join(guardian, "policy", "mcp-policy.json"),
    localMcpPolicy: path.join(guardian, "policy", "mcp-policy.local.json")
  };
}

export function loadPolicies(root = findRoot()) {
  const p = paths(root);
  const guardian = readJson(p.guardianPolicy, {});
  const architecture = readJson(p.architecturePolicy, {});
  const committedMcp = readJson(p.mcpPolicy, { servers: {} });
  const localMcp = readJson(p.localMcpPolicy, { servers: {} });
  const mcp = {
    ...committedMcp,
    ...localMcp,
    blockedToolPatterns: [...(committedMcp.blockedToolPatterns ?? []), ...(localMcp.blockedToolPatterns ?? [])],
    blockedArgumentPatterns: [...(committedMcp.blockedArgumentPatterns ?? []), ...(localMcp.blockedArgumentPatterns ?? [])],
    servers: { ...(committedMcp.servers ?? {}), ...(localMcp.servers ?? {}) }
  };
  return { guardian, architecture, mcp, paths: p };
}

export function candidateMcpFiles(root = findRoot()) {
  return [
    path.join(root, ".cursor", "mcp.json"),
    path.join(os.homedir(), ".cursor", "mcp.json")
  ];
}
