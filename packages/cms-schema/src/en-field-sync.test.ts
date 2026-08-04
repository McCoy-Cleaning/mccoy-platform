import { describe, expect, it } from "vitest";
import {
  applyTranslatedEnFields,
  chunkRecordByBudget,
  collectPageNlFieldDraftMap,
  collectTranslatableStringPaths,
  filterNonEmptyTranslateFields,
  planEnFieldDraftSync,
} from "./en-field-sync";
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
      "columns.0.title": "Kolom 1",
      "columns.0.body": "Tekst",
      "columns.1.title": "Kolom 2",
      "columns.1.body": "Tekst",
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

describe("planEnFieldDraftSync", () => {
  it("queues new NL, retains any existing EN (manual wins), prunes deleted", () => {
    const plan = planEnFieldDraftSync({
      nlFields: {
        "block:b1:title": "Nieuwe titel",
        "block:b1:columns.0.title": "Kolom 1 gewijzigd",
        "block:b1:columns.0.body": "",
      },
      existingDrafts: {
        "block:b1:columns.0.title": "Column 1 custom",
        "block:b1:columns.0.body": "Text",
        "block:b1:columns.1.title": "Column 2",
      },
      existingSources: {
        "block:b1:columns.0.title": "Kolom 1",
        "block:b1:columns.0.body": "Tekst",
        "block:b1:columns.1.title": "Kolom 2",
      },
    });

    // Custom EN kept even though NL changed — Groq must not overwrite.
    expect(plan.retainedDrafts).toEqual({ "block:b1:columns.0.title": "Column 1 custom" });
    expect(plan.toTranslate).toEqual({ "block:b1:title": "Nieuwe titel" });
    expect(plan.prunedPaths.sort()).toEqual(
      ["block:b1:columns.0.body", "block:b1:columns.1.title"].sort(),
    );

    const applied = applyTranslatedEnFields({
      ...plan,
      translated: { "block:b1:title": "New title" },
    });
    expect(applied.enFieldDrafts).toEqual({
      "block:b1:columns.0.title": "Column 1 custom",
      "block:b1:title": "New title",
    });
    expect(applied.enFieldDraftSources["block:b1:title"]).toBe("Nieuwe titel");
  });

  it("scopes AI translate to NL paths changed since baseline only", () => {
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
      "page:meta:title": "Nieuw",
    });
    expect(plan.toTranslate["block:b1:body"]).toBeUndefined();
    expect(plan.toTranslate["block:b2:title"]).toBeUndefined();
  });

  it("does not re-queue unchanged missing EN on every save", () => {
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
    expect(plan.toTranslate).toEqual({});
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
    expect(map["block:blk_cols:columns.0.title"]).toBe("Kolom 1");
    expect(map["block:blk_cols:columns.0.body"]).toBe("Tekst");
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
    expect(paths["images.0.title"]).toBe("Project A");
    expect(paths["images.0.caption"]).toBe("Na oplevering");
    expect(paths["images.0.body"]).toBe("Details");
    expect(paths["images.0.image.alt"]).toBe("Schoon kantoor");
    expect(paths["images.0.image.src"]).toBeUndefined();
    expect(paths["offers.0.badge"]).toBe("Actie");
    expect(paths["offers.0.title"]).toBe("Pakket");
    expect(paths["offers.0.description"]).toBe("Inclusief");
    expect(paths["offers.0.image.alt"]).toBe("Aanbieding");
    expect(paths["steps.0.title"]).toBe("Stap 1");
    expect(paths["steps.0.body"]).toBe("Uitleg");
    expect(paths["steps.0.image.alt"]).toBe("Stap foto");
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
