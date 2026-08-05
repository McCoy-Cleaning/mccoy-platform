import assert from "node:assert/strict";
import { evaluateShell } from "../checks/shell.mjs";
import { evaluateMcpCall } from "../checks/mcp.mjs";
import { sensitiveReadDecision } from "../checks/security.mjs";

let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}

test("blocks git reset --hard", () => {
  assert.equal(evaluateShell("git reset --hard HEAD", {}).ok, false);
});
test("allows ordinary test command", () => {
  assert.equal(evaluateShell("npm run test", {}).ok, true);
});
test("blocks sensitive .env read", () => {
  assert.equal(sensitiveReadDecision("C:/work/app/.env").ok, false);
});
test("denies unknown MCP server", () => {
  const result = evaluateMcpCall(
    { mcp_server_name: "unknown", tool_name: "read_file", arguments: {} },
    { mcp: { readOnlyPrefixes: ["read"], writeLikePrefixes: ["write"], reviewModeAllowsReadOnlyHeuristic: true } },
    { servers: {}, blockedToolPatterns: [], blockedArgumentPatterns: [] }
  );
  assert.equal(result.ok, false);
});
test("allows reviewed read-only MCP tool", () => {
  const result = evaluateMcpCall(
    { mcp_server_name: "codegraph", tool_name: "search_code", arguments: {} },
    { mcp: { readOnlyPrefixes: ["search"], writeLikePrefixes: ["write"], reviewModeAllowsReadOnlyHeuristic: true } },
    { servers: { codegraph: { enabled: true, trust: "review", allowedTools: [], blockedTools: [] } }, blockedToolPatterns: [], blockedArgumentPatterns: [] }
  );
  assert.equal(result.ok, true);
});
test("blocks reviewed write-like MCP tool", () => {
  const result = evaluateMcpCall(
    { mcp_server_name: "db", tool_name: "execute_sql", arguments: { sql: "select 1" } },
    { mcp: { readOnlyPrefixes: ["get","list","search"], writeLikePrefixes: ["execute"], reviewModeAllowsReadOnlyHeuristic: true } },
    { servers: { db: { enabled: true, trust: "review", allowedTools: [], blockedTools: [] } }, blockedToolPatterns: ["execute_sql"], blockedArgumentPatterns: [] }
  );
  assert.equal(result.ok, false);
});

console.log(`${passed} smoke tests passed.`);
