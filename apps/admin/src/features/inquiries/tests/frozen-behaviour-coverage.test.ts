/**
 * Frozen Aanvragen behaviour — coverage index (Stage 3 structural extraction).
 *
 * Behaviour is frozen after manual acceptance. This file documents which suites
 * protect each invariant. Failures here mean the index drifted; fix by pointing
 * at the real tests, never by weakening product semantics.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../../../../");

function read(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), "utf8");
}

/** Map of frozen behaviour → evidence file that must keep asserting it. */
const FROZEN_COVERAGE: Array<{ behaviour: string; file: string; mustMatch: RegExp }> = [
  {
    behaviour: "stable list loading",
    file: "apps/admin/src/features/inquiries/tests/hooks.test.tsx",
    mustMatch: /loads list success/,
  },
  {
    behaviour: "stale-while-refresh behaviour",
    file: "apps/admin/src/features/inquiries/tests/hooks.test.tsx",
    mustMatch: /keeps existing items visible while refreshing/,
  },
  {
    behaviour: "single deletion (optimistic + Graph failure restore)",
    file: "apps/admin/src/features/inquiries/tests/hooks.test.tsx",
    mustMatch: /optimistically removes a row and restores it on Graph failure/,
  },
  {
    behaviour: "bulk deletion",
    file: "apps/admin/src/features/inquiries/tests/hooks.test.tsx",
    mustMatch: /sends every unique selected id for bulk delete/,
  },
  {
    behaviour: "partial deletion rollback / keep successful deletes",
    file: "apps/admin/src/features/inquiries/tests/hooks.test.tsx",
    mustMatch: /keeps successful deletes removed on partial bulk failure/,
  },
  {
    behaviour: "stale-response protection (tombstones)",
    file: "apps/admin/src/features/inquiries/tests/hooks.test.tsx",
    mustMatch: /does not restore deleted ids when a stale refresh arrives/,
  },
  {
    behaviour: "stale-response protection (pure helpers)",
    file: "apps/admin/src/features/inquiries/tests/optimistic-delete.test.ts",
    mustMatch: /stale refresh cannot restore tombstoned ids/,
  },
  {
    behaviour: "one inquiry per conversation (no subject-only merge)",
    file: "packages/email/src/inquiry-thread-correlation.test.ts",
    mustMatch: /keeps two applicants with the same subject separate/,
  },
  {
    behaviour: "Graph/RFC thread correlation",
    file: "packages/email/src/inquiry-thread-correlation.test.ts",
    mustMatch: /appends when In-Reply-To matches a known outbound internetMessageId/,
  },
  {
    behaviour: "message timeline persistence (Graph sync append)",
    file: "packages/email/src/sync-request-graph-thread.test.ts",
    mustMatch: /appends inbound applicant Graph replies into the website request thread/,
  },
  {
    behaviour: "repeated-sync idempotency",
    file: "packages/email/src/sync-request-graph-thread.test.ts",
    mustMatch: /repeated sync is idempotent/,
  },
];

describe("frozen Aanvragen behaviour coverage index", () => {
  for (const row of FROZEN_COVERAGE) {
    it(`protects: ${row.behaviour}`, () => {
      const src = read(row.file);
      expect(src, `missing evidence file ${row.file}`).toBeTruthy();
      expect(src).toMatch(row.mustMatch);
    });
  }
});
