import { describe, expect, it } from "vitest";
import {
  blockedBlockTypesForPage,
  canAddBlockType,
  canRemoveBlockType,
} from "./page-block-policies";
import { createDefaultJobs } from "./blocks/jobs";
import { newBlockLayoutItem } from "./layout";
import type { BuiltinCmsPage } from "./types";

function vacaturesPage(jobsCount: number): BuiltinCmsPage {
  const blocks = Array.from({ length: jobsCount }, (_, i) => ({
    id: `block_jobs_${i}`,
    type: "jobs" as const,
    data: createDefaultJobs() as unknown as Record<string, unknown>,
    dataVersion: 2,
  }));
  return {
    id: "page_vacatures",
    kind: "builtin",
    pageKey: "vacatures",
    slug: "/vacatures",
    title: "Vacatures",
    description: "",
    inNav: true,
    blocks,
    layout: [
      { id: "lay_fixed", kind: "fixed", key: "vacatures.main" },
      ...blocks.map((b) => newBlockLayoutItem(b.id)),
    ],
    version: 1,
    updatedAt: Date.now(),
  } as BuiltinCmsPage;
}

describe("pageBlockPolicies vacatures jobs", () => {
  it("blocks adding a second jobs block", () => {
    const page = vacaturesPage(1);
    expect(canAddBlockType(page, "jobs")).toBe(false);
    expect(blockedBlockTypesForPage(page)).toContain("jobs");
  });

  it("allows adding jobs when none exist", () => {
    const page = vacaturesPage(0);
    expect(canAddBlockType(page, "jobs")).toBe(true);
  });

  it("does not allow removing the required jobs block", () => {
    const page = vacaturesPage(1);
    expect(canRemoveBlockType(page, "jobs")).toBe(false);
  });

  it("does not constrain jobs on other pages", () => {
    const page = { ...vacaturesPage(1), id: "page_home", pageKey: "home" } as BuiltinCmsPage;
    expect(canAddBlockType(page, "jobs")).toBe(true);
    expect(canRemoveBlockType(page, "jobs")).toBe(true);
  });
});
