import assert from "node:assert/strict";
import { validateFinding, dedupeFindings, summarizeFindings } from "./finding-schema.mjs";
import { runDeterministicChecks } from "./deterministic-checks.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const good = {
  id: "t1",
  ruleId: "arch.forbid.storefront-cms-editor",
  review: "architecture",
  severity: "blocker",
  confidence: "high",
  path: "apps/storefront/src/x.ts",
  title: "bad import",
  evidence: ["import @mccoy/cms-editor"],
  impact: "boundary break",
  recommendation: "remove",
  status: "open",
};

assert.equal(validateFinding(good).ok, true);
assert.equal(validateFinding({ ...good, evidence: [] }).ok, false);
assert.equal(validateFinding({ ...good, severity: "critical" }).ok, false);

const duped = dedupeFindings([
  good,
  { ...good, id: "t2", evidence: ["second"] },
]);
assert.equal(duped.length, 1);
assert.ok(duped[0].evidence.includes("second"));

const summary = summarizeFindings(duped);
assert.equal(summary.bySeverity.blocker, 1);

const fixtureFindings = runDeterministicChecks(root, {
  fixtureDir: path.join(__dirname, "fixtures"),
});
assert.ok(fixtureFindings.some((f) => f.ruleId === "arch.forbid.storefront-cms-editor"));
assert.ok(fixtureFindings.some((f) => f.ruleId === "sec.admin.persist-session-true"));
assert.ok(fixtureFindings.some((f) => f.ruleId === "ux.native-window-confirm"));

console.log("r8-review self-tests passed", {
  fixtureFindings: fixtureFindings.length,
});
