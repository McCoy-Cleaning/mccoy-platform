import assert from "node:assert/strict";
import test from "node:test";
import { verifySupabaseTargetIdentity } from "./supabase-verified-target.mjs";

const staging = "abcdefghij1234567890";
const production = "zyxwvutsrq0987654321";
const valid = {
  environment: "staging",
  declaredEnvironment: "staging",
  branch: "development",
  supabaseUrl: `https://${staging}.supabase.co`,
  stagingProjectId: staging,
  productionProjectId: production,
  linkedProjectRef: staging,
};

test("accepts only a fully consistent migration target", () => {
  assert.deepEqual(verifySupabaseTargetIdentity(valid), {
    environment: "staging",
    branch: "development",
    supabaseProjectRef: "abcd…7890",
    linkedSupabaseProjectRef: "abcd…7890",
    targetVerified: true,
    ok: true,
  });
});

test("fails closed on stale CLI link without leaking full refs", () => {
  const result = verifySupabaseTargetIdentity({ ...valid, linkedProjectRef: production });
  assert.equal(result.ok, false);
  assert.equal(result.code, "supabase.cli_link_mismatch");
  assert.equal(result.targetVerified, false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(staging));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(production));
});

test("fails closed on branch, allowlist, and environment mismatches", () => {
  assert.equal(
    verifySupabaseTargetIdentity({ ...valid, branch: "main" }).code,
    "supabase.branch_mismatch",
  );
  assert.equal(
    verifySupabaseTargetIdentity({ ...valid, productionProjectId: staging }).code,
    "supabase.shared_project",
  );
  assert.equal(
    verifySupabaseTargetIdentity({ ...valid, declaredEnvironment: "production" }).code,
    "supabase.environment_mismatch",
  );
});
