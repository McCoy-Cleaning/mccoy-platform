import { describe, expect, it } from "vitest";
import {
  enPublishBlockedByCoverage,
  scanTranslationCoverage,
  selectTranslateMissingFromPage,
} from "./translation-coverage";
import {
  collectPageNlFieldDraftMap,
  planEnFieldDraftSync,
  remapEnFieldDraftsToCanonicalPaths,
} from "./en-field-sync";
import { planTranslationRepairDryRun } from "./translation-repair";
import type { BuiltinCmsPage } from "./types";

function samplePage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: "page_home",
    kind: "builtin",
    key: "home",
    slug: "/",
    title: "Home",
    description: "NL desc",
    inNav: true,
    blocks: [
      {
        id: "blk_1",
        type: "featureGrid",
        data: {
          title: "Assortiment",
          features: [
            { id: "prod_hygiene", title: "Hygiëne papier", body: "NL body" },
            { id: "prod_soaps", title: "Zepen", body: "NL soap" },
          ],
        },
      },
    ],
    layout: [],
    layoutVersion: 1,
    sectionContent: {
      "home.hero": {
        heading: "NL hero",
        body: "NL body",
      },
    },
    enFieldDrafts: {},
    updatedAt: 1,
    version: 1,
    ...overrides,
  } as unknown as BuiltinCmsPage;
}

describe("scanTranslationCoverage", () => {
  it("marks missing EN fields and is incomplete", () => {
    const coverage = scanTranslationCoverage({ page: samplePage() });
    expect(coverage.missing).toBeGreaterThan(0);
    expect(coverage.complete).toBe(false);
    expect(coverage.fields.some((f) => f.path.includes("prod_hygiene"))).toBe(true);
  });

  it("treats blank draft as blank (not translated)", () => {
    const page = samplePage({
      enFieldDrafts: {
        "section:home.hero:heading": "",
        "section:home.hero:body": "EN body",
        "block:blk_1:title": "Range",
        "block:blk_1:features.prod_hygiene.title": "Hygiene paper",
        "block:blk_1:features.prod_hygiene.body": "EN body",
        "block:blk_1:features.prod_soaps.title": "Soaps",
        "block:blk_1:features.prod_soaps.body": "EN soap",
        "page:meta:title": "Home EN",
        "page:meta:description": "EN desc",
      },
    });
    const coverage = scanTranslationCoverage({ page });
    const heading = coverage.fields.find((f) => f.path === "section:home.hero:heading");
    expect(heading?.state).toBe("blank");
    expect(coverage.complete).toBe(false);
  });

  it("complete when all required fields translated", () => {
    const page = samplePage({
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "section:home.hero:body": "EN body",
        "block:blk_1:title": "Range",
        "block:blk_1:features.prod_hygiene.title": "Hygiene paper",
        "block:blk_1:features.prod_hygiene.body": "EN body",
        "block:blk_1:features.prod_soaps.title": "Soaps",
        "block:blk_1:features.prod_soaps.body": "EN soap",
        "page:meta:title": "Home EN",
        "page:meta:description": "EN desc",
      },
      enFieldDraftSources: {
        "section:home.hero:heading": "NL hero",
        "section:home.hero:body": "NL body",
        "block:blk_1:title": "Assortiment",
        "block:blk_1:features.prod_hygiene.title": "Hygiëne papier",
        "block:blk_1:features.prod_hygiene.body": "NL body",
        "block:blk_1:features.prod_soaps.title": "Zepen",
        "block:blk_1:features.prod_soaps.body": "NL soap",
        "page:meta:title": "Home",
        "page:meta:description": "NL desc",
      },
    });
    const coverage = scanTranslationCoverage({ page });
    expect(coverage.missing).toBe(0);
    expect(coverage.blank).toBe(0);
    expect(coverage.complete).toBe(true);
    expect(enPublishBlockedByCoverage(coverage)).toBe(false);
  });

  it("preserves intentional_blank as resolved", () => {
    const page = samplePage({
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "section:home.hero:body": "",
        "block:blk_1:title": "Range",
        "block:blk_1:features.prod_hygiene.title": "Hygiene paper",
        "block:blk_1:features.prod_hygiene.body": "EN body",
        "block:blk_1:features.prod_soaps.title": "Soaps",
        "block:blk_1:features.prod_soaps.body": "EN soap",
        "page:meta:title": "Home EN",
        "page:meta:description": "EN desc",
      },
      enFieldDraftMeta: {
        "section:home.hero:body": { status: "intentional_blank" },
      },
    });
    const coverage = scanTranslationCoverage({ page });
    expect(coverage.intentionalBlank).toBe(1);
    const body = coverage.fields.find((f) => f.path === "section:home.hero:body");
    expect(body?.state).toBe("intentional_blank");
  });

  it("treats override_removed as resolved (NL fallback, not missing)", () => {
    const page = samplePage({
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "block:blk_1:title": "Range",
        "block:blk_1:features.prod_hygiene.title": "Hygiene paper",
        "block:blk_1:features.prod_hygiene.body": "EN body",
        "block:blk_1:features.prod_soaps.title": "Soaps",
        "block:blk_1:features.prod_soaps.body": "EN soap",
        "page:meta:title": "Home EN",
        "page:meta:description": "EN desc",
      },
      enFieldDraftMeta: {
        "section:home.hero:body": { status: "override_removed" },
      },
    });
    const coverage = scanTranslationCoverage({ page });
    expect(coverage.overrideRemoved).toBe(1);
    expect(coverage.missing).toBe(0);
    const body = coverage.fields.find((f) => f.path === "section:home.hero:body");
    expect(body?.state).toBe("override_removed");
    expect(enPublishBlockedByCoverage(coverage)).toBe(false);
  });
});

describe("selectTranslateMissingFromPage", () => {
  it("selects missing/blank/override_removed and skips intentional_blank + manual", () => {
    const page = samplePage({
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "section:home.hero:body": "",
      },
      enFieldDraftMeta: {
        "section:home.hero:heading": { status: "manually_translated" },
        "section:home.hero:body": { status: "intentional_blank" },
        "page:meta:description": { status: "override_removed" },
      },
    });
    const selected = selectTranslateMissingFromPage(page);
    expect(
      selected.every(
        (s) => s.state === "missing" || s.state === "blank" || s.state === "override_removed",
      ),
    ).toBe(true);
    expect(selected.some((s) => s.path === "section:home.hero:heading")).toBe(false);
    expect(selected.some((s) => s.path === "section:home.hero:body")).toBe(false);
    expect(selected.some((s) => s.path === "page:meta:description")).toBe(true);
    expect(selected.some((s) => s.path.includes("prod_hygiene"))).toBe(true);
  });

  it("includes override_removed for both Opslaan sync and translate-missing", () => {
    const path = "section:home.hero:body";
    const page = samplePage({
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "block:blk_1:title": "Range",
        "block:blk_1:features.prod_hygiene.title": "Hygiene paper",
        "block:blk_1:features.prod_hygiene.body": "EN body",
        "block:blk_1:features.prod_soaps.title": "Soaps",
        "block:blk_1:features.prod_soaps.body": "EN soap",
        "page:meta:title": "Home EN",
        "page:meta:description": "EN desc",
      },
      enFieldDraftMeta: {
        [path]: { status: "override_removed" },
      },
    });
    const nlFields = collectPageNlFieldDraftMap(page);
    const plan = planEnFieldDraftSync({
      nlFields,
      existingDrafts: page.enFieldDrafts,
      existingMeta: page.enFieldDraftMeta,
    });
    expect(plan.toTranslate[path]).toBe(nlFields[path]?.trim());

    const selected = selectTranslateMissingFromPage(page);
    expect(selected.some((s) => s.path === path && s.state === "override_removed")).toBe(true);
  });
});

describe("remapEnFieldDraftsToCanonicalPaths", () => {
  it("remaps colon and index aliases onto stable-id dotted paths", () => {
    const page = samplePage({
      enFieldDrafts: {
        "block:blk_1:features:prod_hygiene:title": "Hygiene paper",
        "block:blk_1:features.0.body": "EN body",
      },
    });
    const result = remapEnFieldDraftsToCanonicalPaths(page);
    expect(result.enFieldDrafts["block:blk_1:features.prod_hygiene.title"]).toBe(
      "Hygiene paper",
    );
    expect(result.enFieldDrafts["block:blk_1:features.prod_hygiene.body"]).toBe("EN body");
    expect(result.remapped).toBeGreaterThan(0);
  });
});

describe("planTranslationRepairDryRun", () => {
  it("plans remaps and translate-missing without writing", () => {
    const page = samplePage({
      enFieldDrafts: {
        "block:blk_1:features:prod_hygiene:title": "Hygiene paper",
      },
    });
    const plan = planTranslationRepairDryRun(page);
    expect(plan.remappedCount).toBeGreaterThan(0);
    expect(plan.translateMissingCount).toBeGreaterThan(0);
    expect(plan.previewDrafts["block:blk_1:features.prod_hygiene.title"]).toBe(
      "Hygiene paper",
    );
    // Original page untouched.
    expect(page.enFieldDrafts?.["block:blk_1:features:prod_hygiene:title"]).toBe(
      "Hygiene paper",
    );
  });
});
