import { describe, expect, it } from "vitest";
import {
  applyTranslatedEnFields,
  canonicalizeEnFieldDraftPath,
  chunkRecordByBudget,
  classifyEnOverlayValidity,
  collectPageNlFieldDraftCollection,
  collectPageNlFieldDraftMap,
  collectTranslatableStringPaths,
  enOverlayNeedsTranslation,
  filterNonEmptyTranslateFields,
  lookupEnFieldDraft,
  planEnFieldDraftSync,
  remapEnFieldDraftsToCanonicalPaths,
} from "./en-field-sync";
import { applyEnFieldDraftEditorPatch } from "./translation-field";
import type { BuiltinCmsPage } from "./types";

describe("collectTranslatableStringPaths", () => {
  it("collects nested column title/body and skips ids", () => {
    const paths = collectTranslatableStringPaths({
      title: "No Columns, Just Clean",
      columns: [
        { id: "col_1", title: "Kolom 1", body: "Tekst" },
        { id: "col_2", title: "Kolom 2", body: "Tekst" },
      ],
    });
    expect(paths).toEqual({
      title: "No Columns, Just Clean",
      "columns.col_1.title": "Kolom 1",
      "columns.col_1.body": "Tekst",
      "columns.col_2.title": "Kolom 2",
      "columns.col_2.body": "Tekst",
    });
  });

  it("skips media src but keeps alt", () => {
    const paths = collectTranslatableStringPaths({
      image: { src: "/x.jpg", alt: "Schoon kantoor" },
      heading: "Hallo",
    });
    expect(paths).toEqual({
      "image.alt": "Schoon kantoor",
      heading: "Hallo",
    });
  });
});

describe("classifyEnOverlayValidity", () => {
  it("translates empty values but protects a non-empty source echo", () => {
    expect(classifyEnOverlayValidity({ nl: "Welkom" })).toBe("missing");
    expect(classifyEnOverlayValidity({ nl: "Welkom", en: "" })).toBe("blank");
    expect(
      classifyEnOverlayValidity({
        nl: "Welkom",
        en: undefined,
        status: "override_removed",
      }),
    ).toBe("override_removed");
    expect(classifyEnOverlayValidity({ nl: "Welkom", en: "Welkom" })).toBe("source_echo");
    expect(enOverlayNeedsTranslation("override_removed")).toBe(true);
    expect(enOverlayNeedsTranslation("source_echo")).toBe(false);
  });

  it("retains valid distinct EN and never auto-fills intentional_blank / manual", () => {
    expect(classifyEnOverlayValidity({ nl: "Welkom", en: "Welcome" })).toBe("valid_en");
    expect(
      classifyEnOverlayValidity({
        nl: "Welkom",
        en: "",
        status: "intentional_blank",
      }),
    ).toBe("intentional_blank");
    expect(
      classifyEnOverlayValidity({
        nl: "Welkom",
        en: "",
        status: "manually_translated",
      }),
    ).toBe("manually_translated");
    expect(enOverlayNeedsTranslation("valid_en")).toBe(false);
    expect(enOverlayNeedsTranslation("intentional_blank")).toBe(false);
    expect(enOverlayNeedsTranslation("manually_translated")).toBe(false);
  });
});

describe("planEnFieldDraftSync", () => {
  it("queues new NL, retains any existing EN (manual wins), prunes deleted", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "block:b1:title": "Nieuwe titel",
        "block:b1:columns.col_1.title": "Kolom 1 gewijzigd",
        "block:b1:columns.col_1.body": "",
      },
      existingDrafts: {
        "block:b1:columns.col_1.title": "Column 1 custom",
        "block:b1:columns.col_1.body": "Text",
        "block:b1:columns.col_2.title": "Column 2",
      },
      existingSources: {
        "block:b1:columns.col_1.title": "Kolom 1",
        "block:b1:columns.col_1.body": "Tekst",
        "block:b1:columns.col_2.title": "Kolom 2",
      },
    });

    // Custom EN kept even though NL changed — Groq must not overwrite.
    expect(plan.retainedDrafts).toEqual({ "block:b1:columns.col_1.title": "Column 1 custom" });
    expect(plan.toTranslate).toEqual({ "block:b1:title": "Nieuwe titel" });
    expect(plan.prunedPaths.sort()).toEqual(
      ["block:b1:columns.col_1.body", "block:b1:columns.col_2.title"].sort(),
    );

    const applied = applyTranslatedEnFields({
      ...plan,
      translated: { "block:b1:title": "New title" },
    });
    expect(applied.enFieldDrafts).toEqual({
      "block:b1:columns.col_1.title": "Column 1 custom",
      "block:b1:title": "New title",
    });
    expect(applied.enFieldDraftSources["block:b1:title"]).toBe("Nieuwe titel");
  });

  it("queues every missing EN path (unchanged NL still translates)", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "block:b1:title": "Gewijzigde titel",
        "block:b1:body": "Ongewijzigde body",
        "block:b2:title": "Ook ongewijzigd",
        "page:meta:title": "Nieuw",
      },
      existingDrafts: {},
      baselineNlFields: {
        "block:b1:title": "Oude titel",
        "block:b1:body": "Ongewijzigde body",
        "block:b2:title": "Ook ongewijzigd",
        "page:meta:title": "",
      },
    });

    expect(plan.toTranslate).toEqual({
      "block:b1:title": "Gewijzigde titel",
      "block:b1:body": "Ongewijzigde body",
      "block:b2:title": "Ook ongewijzigd",
      "page:meta:title": "Nieuw",
    });
  });

  it("re-queues missing EN on every save until drafts exist", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "section:hero:title": "Welkom",
        "section:hero:body": "Tekst",
      },
      existingDrafts: {},
      baselineNlFields: {
        "section:hero:title": "Welkom",
        "section:hero:body": "Tekst",
      },
    });
    expect(plan.toTranslate).toEqual({
      "section:hero:title": "Welkom",
      "section:hero:body": "Tekst",
    });
  });

  it("re-queues NL→EN when a published EN draft was cleared without meta", () => {
    // Legacy clear without override_removed still looks “missing” → auto-fill.
    const plan = planEnFieldDraftSync({
      nlFields: {
        "section:hero:title": "Welkom",
        "section:hero:body": "Tekst",
      },
      existingDrafts: {},
      baselineNlFields: {
        "section:hero:title": "Welkom",
        "section:hero:body": "Tekst",
      },
      baselineEnDrafts: {
        "section:hero:title": "Welcome",
        "section:hero:body": "Text",
      },
    });
    expect(plan.toTranslate).toEqual({
      "section:hero:title": "Welkom",
      "section:hero:body": "Tekst",
    });
  });

  it("queues empty override_removed on Opslaan; keeps intentional_blank skipped", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "section:hero:title": "Welkom",
        "section:hero:body": "Tekst",
        "section:hero:cta": "Meer info",
      },
      existingDrafts: {},
      existingMeta: {
        "section:hero:title": { status: "override_removed" },
        "section:hero:body": { status: "intentional_blank" },
      },
    });
    // Stuck/empty override_removed is translate-eligible; intentional_blank is not.
    expect(plan.toTranslate).toEqual({
      "section:hero:title": "Welkom",
      "section:hero:cta": "Meer info",
    });
    expect(plan.retainedDrafts).toEqual({});
    expect(plan.toTranslate["section:hero:body"]).toBeUndefined();
  });

  it("queues stuck gallery override_removed with empty draft (no re-clear needed)", () => {
    const path = "block:b_ha9mlx32:images.img_q4fpvnop.body";
    const nl = "Schoonmakers voor interieur, vloeren en sanitair.";
    const plan = planEnFieldDraftSync({
      nlFields: { [path]: nl },
      existingDrafts: {},
      existingMeta: { [path]: { status: "override_removed" } },
    });
    expect(plan.toTranslate[path]).toBe(nl);
  });

  it("queues never-translated missing fields on save (no override_removed meta)", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "block:b_ha9mlx32:images.img_ubrnczrs.body":
          "Schoonmakers voor interieur, vloeren en sanitair.",
        "section:hero:title": "Welkom",
      },
      existingDrafts: {},
      existingMeta: {},
    });
    expect(plan.toTranslate).toEqual({
      "block:b_ha9mlx32:images.img_ubrnczrs.body":
        "Schoonmakers voor interieur, vloeren en sanitair.",
      "section:hero:title": "Welkom",
    });
  });

  it("does not re-queue cleared EN when current drafts still have EN", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "section:hero:title": "Welkom",
      },
      existingDrafts: {
        "section:hero:title": "Welcome custom",
      },
      baselineNlFields: {
        "section:hero:title": "Welkom",
      },
      baselineEnDrafts: {
        "section:hero:title": "Welcome",
      },
    });
    expect(plan.retainedDrafts).toEqual({ "section:hero:title": "Welcome custom" });
    expect(plan.toTranslate).toEqual({});
  });

  it("protects every non-empty EN draft even when it is identical to Dutch", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "section:hero:title": "Een blik op wat wij doen",
        "section:hero:body": "Alles voor een schone werkomgeving",
        "block:b1:title": "Echte titel",
      },
      existingDrafts: {
        "section:hero:title": "Een blik op wat wij doen",
        "section:hero:body": "Alles voor een schone werkomgeving",
        "block:b1:title": "Real English kept",
      },
    });
    expect(plan.toTranslate).toEqual({});
    expect(plan.retainedDrafts).toEqual({
      "section:hero:title": "Een blik op wat wij doen",
      "section:hero:body": "Alles voor een schone werkomgeving",
      "block:b1:title": "Real English kept",
    });
  });

  it("rejects Groq results that copy Dutch into EN drafts", () => {
    const applied = applyTranslatedEnFields({
      retainedDrafts: {},
      retainedSources: {},
      toTranslate: {
        "section:hero:title": "Welkom",
        "section:hero:body": "Tekst",
      },
      translated: {
        "section:hero:title": "Welcome",
        "section:hero:body": "Tekst",
      },
    });
    expect(applied.enFieldDrafts).toEqual({ "section:hero:title": "Welcome" });
    expect(applied.enFieldDraftSources["section:hero:title"]).toBe("Welkom");
    expect(applied.enFieldDrafts["section:hero:body"]).toBeUndefined();
  });
});

describe("filterNonEmptyTranslateFields", () => {
  it("drops blank values so empty chunks never hit the provider", () => {
    expect(
      filterNonEmptyTranslateFields({
        a: "Hallo",
        b: "  ",
        c: "",
        d: "Wereld",
      }),
    ).toEqual({ a: "Hallo", d: "Wereld" });
    expect(filterNonEmptyTranslateFields({ a: " ", b: "" })).toEqual({});
  });
});

describe("collectPageNlFieldDraftMap", () => {
  it("includes block and page meta paths", () => {
    const page = {
      id: "page_home",
      kind: "builtin",
      isCustom: false,
      pageKey: "home",
      slug: "/",
      title: "Home",
      description: "Desc",
      inNav: true,
      blocks: [
        {
          id: "blk_cols",
          type: "columns",
          data: {
            title: "Titel",
            columns: [{ id: "c1", title: "Kolom 1", body: "Tekst" }],
          },
        },
      ],
      layout: [],
      layoutVersion: 1,
      sectionContent: {},
      updatedAt: 1,
      version: 1,
    } as unknown as BuiltinCmsPage;

    const map = collectPageNlFieldDraftMap(page);
    expect(map["page:meta:title"]).toBe("Home");
    expect(map["block:blk_cols:title"]).toBe("Titel");
    expect(map["block:blk_cols:columns.c1.title"]).toBe("Kolom 1");
    expect(map["block:blk_cols:columns.c1.body"]).toBe("Tekst");
  });

  it("collects every legal article by stable id without mounted editors", () => {
    const page = {
      id: "page_terms",
      kind: "builtin",
      isCustom: false,
      pageKey: "terms",
      slug: "/algemene-voorwaarden",
      title: "Voorwaarden",
      description: "Voorwaarden van McCoy",
      inNav: false,
      blocks: [
        {
          id: "blk_legal",
          type: "legalArticles",
          data: {
            heading: "Algemene Voorwaarden",
            updatedAt: "2026-08-15",
            articles: [
              {
                id: "article_one",
                heading: "Artikel 1",
                anchor: "artikel-1",
                content: "Eerste inhoud.",
              },
              {
                id: "article_two",
                heading: "Artikel 2",
                anchor: "artikel-2",
                content: "Tweede inhoud.",
              },
            ],
          },
        },
      ],
      layout: [],
      layoutVersion: 1,
      sectionContent: {},
      updatedAt: 1,
      version: 1,
    } as unknown as BuiltinCmsPage;

    const map = collectPageNlFieldDraftMap(page);
    expect(map["block:blk_legal:articles.article_one.heading"]).toBe("Artikel 1");
    expect(map["block:blk_legal:articles.article_one.content"]).toBe("Eerste inhoud.");
    expect(map["block:blk_legal:articles.article_two.heading"]).toBe("Artikel 2");
    expect(map["block:blk_legal:articles.article_two.content"]).toBe("Tweede inhoud.");
    expect(map["block:blk_legal:articles.article_one.anchor"]).toBeUndefined();
    expect(map["block:blk_legal:updatedAt"]).toBeUndefined();
  });
});

describe("gallery / offers / steps path coverage", () => {
  it("collects gallery text, offer copy, and step image alt", () => {
    const paths = collectTranslatableStringPaths({
      title: "Galerij",
      images: [
        {
          id: "g1",
          title: "Project A",
          caption: "Na oplevering",
          body: "Details",
          image: { src: "/a.jpg", alt: "Schoon kantoor" },
        },
      ],
      offers: [
        {
          id: "o1",
          badge: "Actie",
          title: "Pakket",
          description: "Inclusief",
          originalPrice: 100,
          discountPrice: 80,
          image: { src: "/o.jpg", alt: "Aanbieding" },
        },
      ],
      steps: [
        {
          id: "s1",
          title: "Stap 1",
          body: "Uitleg",
          image: { src: "/s.jpg", alt: "Stap foto" },
        },
      ],
    });
    expect(paths.title).toBe("Galerij");
    expect(paths["images.g1.title"]).toBe("Project A");
    expect(paths["images.g1.caption"]).toBe("Na oplevering");
    expect(paths["images.g1.body"]).toBe("Details");
    expect(paths["images.g1.image.alt"]).toBe("Schoon kantoor");
    expect(paths["images.g1.image.src"]).toBeUndefined();
    expect(paths["offers.o1.badge"]).toBe("Actie");
    expect(paths["offers.o1.title"]).toBe("Pakket");
    expect(paths["offers.o1.description"]).toBe("Inclusief");
    expect(paths["offers.o1.image.alt"]).toBe("Aanbieding");
    expect(paths["steps.s1.title"]).toBe("Stap 1");
    expect(paths["steps.s1.body"]).toBe("Uitleg");
    expect(paths["steps.s1.image.alt"]).toBe("Stap foto");
  });
});

describe("chunkRecordByBudget", () => {
  it("splits by item count and character budget", () => {
    const record = {
      a: "x".repeat(100),
      b: "y".repeat(100),
      c: "z".repeat(100),
      d: "w".repeat(100),
    };
    const byItems = chunkRecordByBudget(record, { maxItems: 2, maxChars: 10_000 });
    expect(byItems).toHaveLength(2);
    expect(Object.keys(byItems[0]!)).toEqual(["a", "b"]);

    const byChars = chunkRecordByBudget(record, { maxItems: 10, maxChars: 250 });
    expect(byChars.length).toBeGreaterThan(1);
  });
});

describe("lookupEnFieldDraft + remap — cleared EN must not snap back via alias", () => {
  const benefitsPage = {
    id: "p1",
    kind: "builtin",
    isCustom: false,
    pageKey: "home",
    slug: "/",
    title: "Home",
    description: "Desc",
    inNav: true,
    blocks: [
      {
        id: "blk_ben",
        type: "benefits",
        data: {
          title: "Voordelen",
          items: [{ id: "item_1", text: "Alles voor een efficiënte toiletruimte" }],
        },
      },
    ],
    layout: [],
    layoutVersion: 1,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
  } as unknown as BuiltinCmsPage;

  it("lookup returns alias draft, but override_removed hides it", () => {
    const page = {
      ...benefitsPage,
      enFieldDrafts: {
        "block:blk_ben:items.0.text": "Everything for an efficient toilet group",
      },
      enFieldDraftMeta: {
        "block:blk_ben:items.item_1.text": { status: "override_removed" as const },
      },
    };
    expect(lookupEnFieldDraft(page, "block:blk_ben:items.item_1.text")).toBe("");
    expect(lookupEnFieldDraft(page, "block:blk_ben:items.0.text")).toBe("");
  });

  it("remap does not resurrect alias EN when meta is override_removed", () => {
    const page = {
      ...benefitsPage,
      enFieldDrafts: {
        "block:blk_ben:items.0.text": "Everything for an efficient toilet group",
      },
      enFieldDraftMeta: {
        "block:blk_ben:items.item_1.text": { status: "override_removed" as const },
      },
    };
    const remapped = remapEnFieldDraftsToCanonicalPaths(page);
    expect(remapped.enFieldDrafts["block:blk_ben:items.item_1.text"]).toBeUndefined();
    expect(remapped.enFieldDraftMeta?.["block:blk_ben:items.item_1.text"]?.status).toBe(
      "override_removed",
    );
  });

  it("clear via stable image id hides index-path gallery EN (images.N.body)", () => {
    const galleryPage = {
      id: "p_products",
      kind: "builtin",
      isCustom: false,
      pageKey: "products",
      slug: "/producten",
      title: "Producten",
      description: "Desc",
      inNav: true,
      blocks: [
        {
          id: "b_ha9mlx32",
          type: "gallery",
          data: {
            title: "Galerij",
            images: [
              { id: "img_a", title: "A", body: "NL A" },
              { id: "img_b", title: "B", body: "NL B" },
              {
                id: "img_ubrnczrs",
                title: "C",
                body: "Schoonmakers voor interieur, vloeren en sanitair.",
              },
            ],
          },
        },
      ],
      layout: [],
      layoutVersion: 1,
      sectionContent: {},
      updatedAt: 1,
      version: 1,
      enFieldDrafts: {
        "block:b_ha9mlx32:images.2.body":
          "Cleaners for interiors, floors and sanitary.\nMcCoy also focuses on sustainable c",
      },
    } as unknown as BuiltinCmsPage;

    const indexPath = "block:b_ha9mlx32:images.2.body";
    const stablePath = "block:b_ha9mlx32:images.img_ubrnczrs.body";
    expect(canonicalizeEnFieldDraftPath(galleryPage, indexPath)).toBe(stablePath);

    const { aliases } = collectPageNlFieldDraftCollection(galleryPage);
    const cleared = applyEnFieldDraftEditorPatch({
      drafts: galleryPage.enFieldDrafts,
      patch: { [stablePath]: "" },
      nlFields: collectPageNlFieldDraftMap(galleryPage),
      aliases,
    });
    const afterClear = { ...galleryPage, ...cleared };

    expect(cleared.enFieldDrafts[indexPath]).toBeUndefined();
    expect(cleared.enFieldDrafts[stablePath]).toBeUndefined();
    expect(cleared.enFieldDraftMeta[stablePath]?.status).toBe("override_removed");
    expect(cleared.enFieldDraftMeta[indexPath]?.status).toBe("override_removed");
    expect(lookupEnFieldDraft(afterClear, indexPath)).toBe("");
    expect(lookupEnFieldDraft(afterClear, stablePath)).toBe("");
  });
});
