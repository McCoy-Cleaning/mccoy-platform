import { describe, expect, it } from "vitest";
import {
  blockedBlockTypesForPage,
  canAddBlockType,
  canRemoveBlockType,
  countPolicyInstances,
  validatePageBlockPolicies,
} from "./page-block-policies";
import { createDefaultJobs } from "./blocks/jobs";
import { createDefaultBlock } from "./blocks/registry";
import { addLayoutBlock } from "./layout-ops";
import { newBlockLayoutItem } from "./layout";
import { parseMigrateNormalizePage } from "./migrate";
import { normalizeCmsPage, validatePublishableCmsPage } from "./pipeline";
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

describe("pageBlockPolicies contact/offerte fixed equivalents", () => {
  it("credits contact.form fixed section toward contactForm min policy", () => {
    const page = parseMigrateNormalizePage({
      id: "page_contact",
      slug: "/contact",
      title: "Contact",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;

    expect(page.layout.some((i) => i.kind === "fixed" && i.key === "contact.form")).toBe(true);
    expect(page.blocks.some((b) => b.type === "contactForm")).toBe(false);
    expect(countPolicyInstances(page, "contactForm")).toBe(1);
    expect(validatePageBlockPolicies(page)).toEqual([]);
    // Fixed alone must not block catalog add — add replaces the fixed slot.
    expect(canAddBlockType(page, "contactForm")).toBe(true);
    expect(blockedBlockTypesForPage(page)).not.toContain("contactForm");
    expect(validatePublishableCmsPage(page).ok).toBe(true);
  });

  it("credits offerte.form fixed section toward quoteRequestForm min policy", () => {
    const page = parseMigrateNormalizePage({
      id: "page_offerte",
      slug: "/offerte",
      title: "Offerte",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;

    expect(countPolicyInstances(page, "quoteRequestForm")).toBe(1);
    expect(validatePageBlockPolicies(page)).toEqual([]);
    expect(canAddBlockType(page, "quoteRequestForm")).toBe(true);
    expect(validatePublishableCmsPage(page).ok).toBe(true);
  });

  it("fails contactForm min when neither fixed form nor block is present", () => {
    const page = parseMigrateNormalizePage({
      id: "page_contact",
      slug: "/contact",
      title: "Contact",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const withoutForm = {
      ...page,
      layout: page.layout.filter((i) => !(i.kind === "fixed" && i.key === "contact.form")),
    } as BuiltinCmsPage;

    const issues = validatePageBlockPolicies(withoutForm);
    expect(issues).toEqual([
      expect.objectContaining({
        code: "BLOCK_POLICY_MIN",
        blockType: "contactForm",
        message: "Pagina vereist minstens 1× contactForm (nu 0).",
      }),
    ]);
  });

  it("counts migrated contactForm block without fixed section", () => {
    const block = createDefaultBlock("contactForm");
    const page = {
      id: "page_contact",
      kind: "builtin" as const,
      pageKey: "contact" as const,
      slug: "/contact",
      title: "Contact",
      description: "",
      inNav: true,
      isCustom: false,
      blocks: [block],
      layout: [newBlockLayoutItem(block.id)],
      layoutVersion: 7,
      version: 1,
      updatedAt: Date.now(),
      sectionContent: {},
    } as BuiltinCmsPage;

    expect(countPolicyInstances(page, "contactForm")).toBe(1);
    expect(validatePageBlockPolicies(page)).toEqual([]);
    expect(canAddBlockType(page, "contactForm")).toBe(false);
    expect(blockedBlockTypesForPage(page)).toContain("contactForm");
  });

  it("adding contactForm from catalog replaces fixed contact.form", () => {
    const page = parseMigrateNormalizePage({
      id: "page_contact",
      slug: "/contact",
      title: "Contact",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const block = createDefaultBlock("contactForm");
    const result = addLayoutBlock(page, block, page.layout.length);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.layout.some((i) => i.kind === "fixed" && i.key === "contact.form")).toBe(
      false,
    );
    expect(result.page.blocks.some((b) => b.type === "contactForm")).toBe(true);
    expect(countPolicyInstances(result.page, "contactForm")).toBe(1);
    expect(validatePageBlockPolicies(result.page)).toEqual([]);
    // Normalize must not re-insert required fixed when block satisfies policy.
    const normalized = normalizeCmsPage(result.page);
    expect(normalized.layout.some((i) => i.kind === "fixed" && i.key === "contact.form")).toBe(
      false,
    );
    // Publish validation must accept catalog contactForm in place of fixed contact.form.
    const publishable = validatePublishableCmsPage(normalized);
    expect(publishable.ok).toBe(true);
    if (!publishable.ok) {
      expect(publishable.issues).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "MISSING_REQUIRED_SECTION",
            path: "contact.form",
          }),
        ]),
      );
    }
  });

  it("publish fails when contact.form is missing and no contactForm block", () => {
    const page = parseMigrateNormalizePage({
      id: "page_contact",
      slug: "/contact",
      title: "Contact",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const withoutForm = {
      ...page,
      layout: page.layout.filter((i) => !(i.kind === "fixed" && i.key === "contact.form")),
      blocks: [],
    } as BuiltinCmsPage;

    const result = validatePublishableCmsPage(withoutForm);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_REQUIRED_SECTION",
          message: "Required section contact.form is missing.",
          path: "contact.form",
        }),
      ]),
    );
  });
});
