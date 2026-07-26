import { describe, expect, it } from "vitest";
import {
  applyTranslatedEnFields,
  collectPageNlFieldDraftMap,
  collectTranslatableStringPaths,
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
