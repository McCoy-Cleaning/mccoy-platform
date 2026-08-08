import { describe, expect, it } from "vitest";
import type { BuiltinCmsPage } from "../types";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import {
  assertApplyGates,
  runMg5Apply,
  runMg5DryRun,
  runMg5Rollback,
  type Mg5OperatorPageRecord,
  type Mg5PersistencePort,
  type Mg5BackupPort,
} from "./mg5-operator";
import { MG5_PRODUCTION_CONFIRM_PHRASE } from "./mg5-version";
import type { Mg5BackupArtifact } from "./mg5-backup";
import { pageContentHash } from "./mg5-pipeline";

function homeRecord(overrides?: Partial<BuiltinCmsPage>): Mg5OperatorPageRecord {
  const payload: BuiltinCmsPage = {
    kind: "builtin",
    isCustom: false,
    id: "page_home",
    pageKey: "home",
    slug: "/",
    title: "Home",
    description: "fixture",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:home.hero", kind: "fixed", key: "home.hero", hidden: false },
      { id: "fixed:home.partners", kind: "fixed", key: "home.partners", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "home.hero": { heading: "Hero NL", body: "Body NL" },
      "home.partners": { heading: "Partners", items: [] },
    } as unknown as BuiltinCmsPage["sectionContent"],
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
  return {
    pageId: "page_home",
    pageKey: "home",
    draftRevisionNumber: 3,
    payload,
  };
}

function memoryPorts(initial: Mg5OperatorPageRecord[]) {
  const pages = new Map(initial.map((p) => [p.pageId, structuredClone(p)]));
  const writes: Array<{ pageId: string; expected: number }> = [];
  const backups = new Map<string, Mg5BackupArtifact>();

  const persistence: Mg5PersistencePort = {
    async listBuiltinPages(filter) {
      return [...pages.values()].filter((p) => {
        if (filter?.pageId && p.pageId !== filter.pageId) return false;
        if (filter?.pageKey && p.pageKey !== filter.pageKey) return false;
        return true;
      });
    },
    async saveDraftAtomic(input) {
      writes.push({ pageId: input.pageId, expected: input.expectedRevisionNumber });
      const cur = pages.get(input.pageId);
      if (!cur) throw new Error("missing");
      if (cur.draftRevisionNumber !== input.expectedRevisionNumber) {
        throw Object.assign(new Error("conflict"), { code: "conflict" });
      }
      if (input.payload.kind !== "builtin") throw new Error("not builtin");
      const next = {
        ...cur,
        draftRevisionNumber: cur.draftRevisionNumber + 1,
        payload: structuredClone(input.payload) as BuiltinCmsPage,
      };
      pages.set(input.pageId, next);
      return { draftRevisionNumber: next.draftRevisionNumber };
    },
    async readDraft(pageId) {
      const cur = pages.get(pageId);
      return cur ? structuredClone(cur) : null;
    },
  };

  const backupPort: Mg5BackupPort = {
    async writeArtifact(artifact) {
      backups.set(artifact.runId, artifact);
      return { path: `memory://${artifact.runId}.json` };
    },
    async readArtifact(runId) {
      return backups.get(runId) ?? null;
    },
  };

  return { persistence, backupPort, pages, writes, backups };
}

describe("MG5 operator gates", () => {
  it("dry-run never writes drafts", async () => {
    const { persistence, writes } = memoryPorts([homeRecord()]);
    const { report, qualification } = await runMg5DryRun(persistence, {
      environment: "test",
      createRunId: () => "mg5_test_run_1",
      now: () => "2026-08-08T12:00:00.000Z",
    });
    expect(writes).toEqual([]);
    expect(report.mode).toBe("dry-run");
    expect(report.pagesChanged).toBeGreaterThanOrEqual(1);
    expect(qualification.runId).toBe("mg5_test_run_1");
    expect(qualification.pageHashes.page_home?.draftRevisionNumber).toBe(3);
  });

  it("apply refuses without qualified run / production confirm", () => {
    expect(
      assertApplyGates({
        environment: "staging",
        mode: "apply",
      }).ok,
    ).toBe(false);
    expect(
      assertApplyGates({
        environment: "production",
        mode: "apply",
        qualifiedRunId: "x",
        confirmProduction: "nope",
      }).ok,
    ).toBe(false);
    expect(
      assertApplyGates({
        environment: "production",
        mode: "apply",
        qualifiedRunId: "x",
        confirmProduction: MG5_PRODUCTION_CONFIRM_PHRASE,
      }).ok,
    ).toBe(true);
  });

  it("apply backs up, CAS-writes, and verifies re-read", async () => {
    const ports = memoryPorts([homeRecord()]);
    const { report: dryReport, qualification } = await runMg5DryRun(ports.persistence, {
      environment: "staging",
      createRunId: () => "mg5_qual_1",
      now: () => "2026-08-08T12:00:00.000Z",
    });
    expect(dryReport.pagesChanged).toBeGreaterThanOrEqual(1);

    const applyReport = await runMg5Apply(
      ports.persistence,
      ports.backupPort,
      qualification,
      {
        environment: "staging",
        mode: "apply",
        qualifiedRunId: "mg5_qual_1",
        now: () => "2026-08-08T12:01:00.000Z",
      },
    );
    expect(applyReport.qualificationStale).toBe(false);
    expect(applyReport.pagesChanged).toBeGreaterThanOrEqual(1);
    expect(applyReport.results.some((r) => r.applyStatus === "applied")).toBe(true);
    expect(applyReport.results.some((r) => r.postWriteVerification === "passed")).toBe(true);
    expect(ports.backups.has("mg5_qual_1")).toBe(true);
    expect(ports.writes.length).toBeGreaterThanOrEqual(1);
  });

  it("stale qualification (editor save) refuses overwrite", async () => {
    const ports = memoryPorts([homeRecord()]);
    const { qualification } = await runMg5DryRun(ports.persistence, {
      environment: "staging",
      createRunId: () => "mg5_qual_stale",
      now: () => "2026-08-08T12:00:00.000Z",
    });
    // Simulate concurrent editor save.
    const cur = ports.pages.get("page_home")!;
    ports.pages.set("page_home", {
      ...cur,
      draftRevisionNumber: cur.draftRevisionNumber + 1,
      payload: {
        ...cur.payload,
        title: "Edited after dry-run",
      },
    });

    const applyReport = await runMg5Apply(
      ports.persistence,
      ports.backupPort,
      qualification,
      {
        environment: "staging",
        mode: "apply",
        qualifiedRunId: "mg5_qual_stale",
        now: () => "2026-08-08T12:02:00.000Z",
      },
    );
    expect(applyReport.qualificationStale).toBe(true);
    expect(applyReport.results.some((r) => r.applyStatus === "refused")).toBe(true);
    expect(ports.writes.length).toBe(0);
  });

  it("rollback restores original content hash", async () => {
    const ports = memoryPorts([homeRecord()]);
    const originalHash = pageContentHash(ports.pages.get("page_home")!.payload);
    const { qualification } = await runMg5DryRun(ports.persistence, {
      environment: "test",
      createRunId: () => "mg5_rb_1",
      now: () => "2026-08-08T12:00:00.000Z",
    });
    const applyReport = await runMg5Apply(
      ports.persistence,
      ports.backupPort,
      qualification,
      {
        environment: "test",
        mode: "apply",
        qualifiedRunId: "mg5_rb_1",
        now: () => "2026-08-08T12:01:00.000Z",
      },
    );
    const afterHashes: Record<string, string> = {};
    for (const r of applyReport.results) {
      if (r.applyStatus === "applied") afterHashes[r.pageId] = r.afterHash;
    }
    const artifact = ports.backups.get("mg5_rb_1")!;
    const rollback = await runMg5Rollback(ports.persistence, artifact, {
      environment: "test",
      expectedAfterHashes: afterHashes,
      now: () => "2026-08-08T12:03:00.000Z",
    });
    expect(rollback.pagesChanged).toBeGreaterThanOrEqual(1);
    const restored = ports.pages.get("page_home")!;
    expect(pageContentHash(restored.payload)).toBe(originalHash);
  });
});
