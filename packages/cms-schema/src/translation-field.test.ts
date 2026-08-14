import { describe, expect, it } from "vitest";
import {
  applyEnFieldDraftEditorPatch,
  classifyTranslationField,
  createTranslationSourceHash,
  resolveLocalizedField,
  translationFieldIsResolved,
  translationFieldRequiresEnglish,
} from "./translation-field";
import { planEnFieldDraftSync } from "./en-field-sync";
import { localizeCmsPageForLocale } from "./en-field-drafts";
import type { BuiltinCmsPage } from "./types";

function builtinHero(body = "NL body"): BuiltinCmsPage {
  return {
    id: "page_home",
    kind: "builtin",
    key: "home",
    slug: "/",
    title: "Home",
    description: "",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: 1,
    sectionContent: {
      "home.hero": {
        heading: "NL hero",
        body,
        primaryCta: { label: "Offerte", href: "/offerte" },
      },
    },
    enFieldDrafts: {},
    updatedAt: 1,
    version: 1,
  } as unknown as BuiltinCmsPage;
}

describe("resolveLocalizedField — blank EN must not suppress NL", () => {
  it("falls back to NL when EN path is missing", () => {
    const result = resolveLocalizedField({
      sourceValue: "Nederlandse tekst",
      translatedValue: undefined,
      fallbackToSource: true,
    });
    expect(result.value).toBe("Nederlandse tekst");
    expect(result.state).toBe("missing");
    expect(result.usedFallback).toBe(true);
  });

  it("falls back to NL when EN is null", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL",
      translatedValue: null,
      fallbackToSource: true,
    });
    expect(result.value).toBe("NL");
    expect(result.state).toBe("blank");
  });

  it("falls back to NL when EN is empty string", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL body",
      translatedValue: "",
      fallbackToSource: true,
    });
    expect(result.value).toBe("NL body");
    expect(result.state).toBe("blank");
    expect(result.usedFallback).toBe(true);
  });

  it("falls back to NL when EN is whitespace only", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL body",
      translatedValue: "   \n\t  ",
      fallbackToSource: true,
    });
    expect(result.value).toBe("NL body");
    expect(result.state).toBe("blank");
  });

  it("renders blank only for intentional_blank metadata", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL body",
      translatedValue: "",
      metadata: { status: "intentional_blank" },
      fallbackToSource: true,
    });
    expect(result.value).toBe("");
    expect(result.state).toBe("intentional_blank");
    expect(result.usedFallback).toBe(false);
  });

  it("renders valid EN", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL body",
      translatedValue: "EN body",
      fallbackToSource: true,
    });
    expect(result.value).toBe("EN body");
    expect(result.state).toBe("machine_translated");
  });

  it("renders stale EN but marks stale", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL changed",
      translatedValue: "EN old",
      sourceHash: createTranslationSourceHash("NL changed"),
      translatedSourceHash: createTranslationSourceHash("NL old"),
      fallbackToSource: true,
    });
    expect(result.value).toBe("EN old");
    expect(result.state).toBe("stale");
  });

  it("invalid EN type falls back safely", () => {
    const result = resolveLocalizedField({
      sourceValue: "NL",
      translatedValue: { nested: true },
      fallbackToSource: true,
    });
    expect(result.value).toBe("NL");
    expect(result.state).toBe("invalid");
  });
});

describe("classifyTranslationField", () => {
  it("treats any non-empty EN, including an NL echo, as protected content", () => {
    expect(
      classifyTranslationField({
        path: "block:x:title",
        sourceLocale: "nl",
        targetLocale: "en",
        sourceValue: "Zelfde",
        targetValue: "Zelfde",
      }),
    ).toBe("machine_translated");
  });

  it("source_empty does not require EN", () => {
    const state = classifyTranslationField({
      path: "block:x:optional",
      sourceLocale: "nl",
      targetLocale: "en",
      sourceValue: "  ",
      targetValue: undefined,
    });
    expect(state).toBe("source_empty");
    expect(translationFieldRequiresEnglish(state)).toBe(false);
    expect(translationFieldIsResolved(state)).toBe(true);
  });

  it("empty NL with non-empty EN draft is translated (render must use EN)", () => {
    const state = classifyTranslationField({
      path: "block:b_cv7xo09j:body",
      sourceLocale: "nl",
      targetLocale: "en",
      sourceValue: null,
      targetValue: "Quality starts with the right products",
    });
    expect(state).toBe("machine_translated");
    const resolved = resolveLocalizedField({
      sourceValue: null,
      translatedValue: "Quality starts with the right products",
      fallbackToSource: true,
    });
    expect(resolved.usedFallback).toBe(false);
    expect(resolved.value).toBe("Quality starts with the right products");
  });

  it("override_removed is resolved NL fallback, not intentional blank", () => {
    const state = classifyTranslationField({
      path: "section:hero:body",
      sourceLocale: "nl",
      targetLocale: "en",
      sourceValue: "Alles is mogelijk",
      targetValue: undefined,
      metadata: { status: "override_removed" },
    });
    expect(state).toBe("override_removed");
    expect(translationFieldIsResolved(state)).toBe(true);
    expect(translationFieldRequiresEnglish(state)).toBe(false);
    const resolved = resolveLocalizedField({
      sourceValue: "Alles is mogelijk",
      translatedValue: undefined,
      metadata: { status: "override_removed" },
      fallbackToSource: true,
    });
    expect(resolved.value).toBe("Alles is mogelijk");
    expect(resolved.usedFallback).toBe(true);
  });
});

describe("applyEnFieldDraftEditorPatch — clear EN must stick through sync", () => {
  it("clearing EN marks override_removed; Opslaan re-queues empty override for refill", () => {
    const path = "section:hero:body";
    const nl = "Alles voor een efficiënte opstelling van uw toiletruimte";
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: { [path]: "Everything is possible for an efficient setup of your toilet group" },
      sources: { [path]: nl },
      meta: { [path]: { status: "machine_translated" } },
      patch: { [path]: "" },
      nlFields: { [path]: nl },
    });
    expect(cleared.enFieldDrafts[path]).toBeUndefined();
    expect(cleared.enFieldDraftMeta[path]?.status).toBe("override_removed");

    const plan = planEnFieldDraftSync({
      nlFields: { [path]: nl, "section:hero:title": "Welkom" },
      existingDrafts: cleared.enFieldDrafts,
      existingSources: cleared.enFieldDraftSources,
      existingMeta: cleared.enFieldDraftMeta,
    });
    // Empty override_removed is translate-eligible (no second clear required).
    expect(plan.toTranslate[path]).toBe(nl);
    expect(plan.toTranslate["section:hero:title"]).toBe("Welkom");
  });

  it("clearing a never-translated EN slot stays missing (Opslaan can still auto-fill)", () => {
    const path = "block:b_gallery:images.img_1.body";
    const nl = "Schoonmakers voor interieur, vloeren en sanitair.";
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: {},
      sources: {},
      meta: {},
      patch: { [path]: "" },
      nlFields: { [path]: nl },
    });
    expect(cleared.enFieldDrafts[path]).toBeUndefined();
    expect(cleared.enFieldDraftMeta[path]).toBeUndefined();

    const plan = planEnFieldDraftSync({
      nlFields: { [path]: nl },
      existingDrafts: cleared.enFieldDrafts,
      existingSources: cleared.enFieldDraftSources,
      existingMeta: cleared.enFieldDraftMeta,
    });
    expect(plan.toTranslate[path]).toBe(nl);
  });

  it("clearing an already-empty override_removed slot deletes meta (unblocks Opslaan)", () => {
    const path = "block:b_ha9mlx32:images.img_q4fpvnop.body";
    const nl = "Schoonmakers voor interieur, vloeren en sanitair.";
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: {},
      sources: {},
      meta: { [path]: { status: "override_removed" } },
      patch: { [path]: "" },
      nlFields: { [path]: nl },
    });
    expect(cleared.enFieldDrafts[path]).toBeUndefined();
    expect(cleared.enFieldDraftMeta[path]).toBeUndefined();

    const plan = planEnFieldDraftSync({
      nlFields: { [path]: nl },
      existingDrafts: cleared.enFieldDrafts,
      existingSources: cleared.enFieldDraftSources,
      existingMeta: cleared.enFieldDraftMeta,
    });
    expect(plan.toTranslate[path]).toBe(nl);
  });

  it("clearing non-empty EN marks override_removed; Opslaan queues refill (intentional_blank stays skipped)", () => {
    const path = "block:b_gallery:images.img_1.body";
    const nl = "Nederlandse gallery tekst";
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: { [path]: "English gallery text" },
      sources: { [path]: nl },
      meta: { [path]: { status: "machine_translated" } },
      patch: { [path]: "  " },
      nlFields: { [path]: nl },
    });
    expect(cleared.enFieldDraftMeta[path]?.status).toBe("override_removed");
    const plan = planEnFieldDraftSync({
      nlFields: { [path]: nl },
      existingDrafts: cleared.enFieldDrafts,
      existingMeta: cleared.enFieldDraftMeta,
    });
    expect(plan.toTranslate[path]).toBe(nl);

    const blankPlan = planEnFieldDraftSync({
      nlFields: { [path]: nl },
      existingDrafts: {},
      existingMeta: { [path]: { status: "intentional_blank" } },
    });
    expect(blankPlan.toTranslate[path]).toBeUndefined();
  });

  it("storefront falls back to NL when override_removed after a real clear", () => {
    const page = builtinHero("NL body for clear");
    const path = "section:home.hero:body";
    page.enFieldDrafts = {
      "section:home.hero:heading": "EN hero",
      [path]: "EN body for clear",
    };
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: page.enFieldDrafts,
      patch: { [path]: "" },
      nlFields: { [path]: "NL body for clear", "section:home.hero:heading": "NL hero" },
    });
    page.enFieldDrafts = cleared.enFieldDrafts;
    page.enFieldDraftMeta = cleared.enFieldDraftMeta;
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "EN hero",
      body: "NL body for clear",
    });
  });

  it("clearing EN via stable-id path also purges index alias drafts (no snap-back)", () => {
    const canonical = "block:blk:items.item_1.text";
    const alias = "block:blk:items.0.text";
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: {
        [alias]: "Everything for an efficient toilet group setup",
      },
      sources: { [alias]: "Alles voor een efficiënte toiletruimte" },
      patch: { [canonical]: "" },
      nlFields: { [canonical]: "Alles voor een efficiënte toiletruimte" },
      aliases: { [alias]: canonical },
    });
    expect(cleared.enFieldDrafts[canonical]).toBeUndefined();
    expect(cleared.enFieldDrafts[alias]).toBeUndefined();
    expect(cleared.enFieldDraftMeta[canonical]?.status).toBe("override_removed");
    expect(cleared.enFieldDraftMeta[alias]?.status).toBe("override_removed");
  });

  it("typing EN after clear marks manually_translated and retains the draft", () => {
    const path = "section:hero:body";
    const nl = "Nederlandse tekst";
    const afterClear = applyEnFieldDraftEditorPatch({
      drafts: { [path]: "Old EN" },
      patch: { [path]: "   " },
      nlFields: { [path]: nl },
    });
    const afterType = applyEnFieldDraftEditorPatch({
      ...{
        drafts: afterClear.enFieldDrafts,
        sources: afterClear.enFieldDraftSources,
        meta: afterClear.enFieldDraftMeta,
      },
      patch: { [path]: "Custom English" },
      nlFields: { [path]: nl },
    });
    expect(afterType.enFieldDrafts[path]).toBe("Custom English");
    expect(afterType.enFieldDraftMeta[path]?.status).toBe("manually_translated");
    const plan = planEnFieldDraftSync({
      nlFields: { [path]: nl },
      existingDrafts: afterType.enFieldDrafts,
      existingSources: afterType.enFieldDraftSources,
      existingMeta: afterType.enFieldDraftMeta,
    });
    expect(plan.retainedDrafts[path]).toBe("Custom English");
    expect(plan.toTranslate).toEqual({});
  });

  it("preserves trailing spaces while typing so Space works in controlled EN fields", () => {
    const path = "block:block_f8h28wuh:introduction";
    const nl = "Word onderdeel van een vast inhuis team van";
    const withSpace = applyEnFieldDraftEditorPatch({
      drafts: { [path]: "Become part of a permanent in-house team" },
      patch: { [path]: "Become part of a permanent in-house team " },
      nlFields: { [path]: nl },
    });
    expect(withSpace.enFieldDrafts[path]).toBe("Become part of a permanent in-house team ");
    expect(withSpace.enFieldDraftMeta[path]?.status).toBe("manually_translated");

    const nextWord = applyEnFieldDraftEditorPatch({
      drafts: withSpace.enFieldDrafts,
      sources: withSpace.enFieldDraftSources,
      meta: withSpace.enFieldDraftMeta,
      patch: { [path]: "Become part of a permanent in-house team of" },
      nlFields: { [path]: nl },
    });
    expect(nextWord.enFieldDrafts[path]).toBe("Become part of a permanent in-house team of");
  });
});

describe("localizeCmsPageForLocale — blank draft regression", () => {
  it("blank EN draft key does not wipe NL base on overlay", () => {
    const page = builtinHero("NL body");
    page.enFieldDrafts = {
      "section:home.hero:heading": "EN hero",
      "section:home.hero:body": "",
      "section:home.hero:primaryCta.label": "   ",
    };
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "EN hero",
      body: "NL body",
      primaryCta: { label: "Offerte" },
    });
  });

  it("missing EN fields keep Dutch — English page existence does not clear them", () => {
    const page = builtinHero("Only Dutch body");
    page.enFieldDrafts = {
      "section:home.hero:heading": "EN hero",
    };
    page.localeContent = {
      nl: {
        navigationLabel: "Home",
        pageTitle: "Home",
        seo: { title: "Home", description: "" },
      },
      en: {
        navigationLabel: "Home EN",
        pageTitle: "Home EN",
        seo: { title: "Home EN", description: "" },
      },
    };
    const localized = localizeCmsPageForLocale(page, "en");
    expect(localized.kind === "builtin" && localized.sectionContent["home.hero"]).toMatchObject({
      heading: "EN hero",
      body: "Only Dutch body",
    });
  });
});
