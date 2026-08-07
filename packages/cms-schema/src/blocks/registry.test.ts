import { describe, expect, it } from "vitest";
import type { BlockType } from "../types";
import { catalogDefinitions } from "./catalog";
import { DEFAULT_CONTACT_FORM_FIELDS } from "./form-fields";
import {
  ALL_BLOCK_TYPES,
  assertPickerTypesMatchRegistry,
  blockDataRegistry,
  createDefaultBlock,
  parseBlockData,
  PUBLISHABLE_BLOCK_TYPES,
} from "./registry";
import { normalizeSpacerSize } from "./catalog";

/**
 * Explicit BlockType union mirror — kept in sync via the type assertion below.
 * If you add a BlockType, add it here and in the catalog.
 */
const EXPECTED_BLOCK_TYPES = [
  "hero",
  "richText",
  "centered",
  "textImage",
  "columns",
  "benefits",
  "quote",
  "gallery",
  "video",
  "beforeAfter",
  "carousel",
  "steps",
  "comparisonTable",
  "featureGrid",
  "spacer",
  "teamGrid",
  "teamProfile",
  "values",
  "timeline",
  "roadmap",
  "plans",
  "cta",
  "newsletter",
  "contactForm",
  "announcement",
  "popup",
  "portfolio",
  "jobs",
  "latestPosts",
  "partnersMarquee",
  "statsCounters",
  "contactInfoCards",
  "quoteRequestForm",
  "legalArticles",
  "offers",
] as const satisfies readonly BlockType[];

type MissingFromExpected = Exclude<BlockType, (typeof EXPECTED_BLOCK_TYPES)[number]>;
type ExtraInExpected = Exclude<(typeof EXPECTED_BLOCK_TYPES)[number], BlockType>;
type AssertExpectedMatchesUnion =
  MissingFromExpected | ExtraInExpected extends never ? true : {
    missing: MissingFromExpected;
    extra: ExtraInExpected;
  };
const _assertExpectedMatchesUnion: AssertExpectedMatchesUnion = true;
void _assertExpectedMatchesUnion;

describe("block data registry", () => {
  it("ALL_BLOCK_TYPES matches the BlockType union (EXPECTED_BLOCK_TYPES)", () => {
    expect([...ALL_BLOCK_TYPES].sort()).toEqual([...EXPECTED_BLOCK_TYPES].sort());
    expect(ALL_BLOCK_TYPES).toHaveLength(EXPECTED_BLOCK_TYPES.length);
  });

  it("catalog keys match ALL_BLOCK_TYPES", () => {
    expect(Object.keys(catalogDefinitions).sort()).toEqual([...ALL_BLOCK_TYPES].sort());
  });

  it("registers every BlockType with schema, default, normalize, capabilities", () => {
    for (const type of EXPECTED_BLOCK_TYPES) {
      const def = blockDataRegistry[type];
      expect(def.type).toBe(type);
      expect(def.schema).toBeTruthy();
      expect(typeof def.createDefault).toBe("function");
      expect(typeof def.normalize).toBe("function");
      expect(def.capabilities).toBeTruthy();
      expect(typeof def.capabilities.publishable).toBe("boolean");
    }
  });

  it("createDefault parses for every type", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const def = blockDataRegistry[type];
      const raw = def.createDefault();
      const parsed = parseBlockData(type, raw);
      expect(parsed.ok, type).toBe(true);
    }
  });

  it("createDefaultBlock includes dataVersion", () => {
    const block = createDefaultBlock("roadmap");
    expect(block.type).toBe("roadmap");
    expect(block.dataVersion).toBe(1);
    expect(Array.isArray((block.data as { milestones?: unknown }).milestones)).toBe(true);
  });

  it("latestPosts is labeled Uitgelichte artikelen", () => {
    expect(blockDataRegistry.latestPosts.label).toBe("Uitgelichte artikelen");
    const data = blockDataRegistry.latestPosts.createDefault() as { title: string };
    expect(data.title).toBe("Uitgelichte artikelen");
  });

  it("offers is labeled Aanbiedingen", () => {
    expect(blockDataRegistry.offers.label).toBe("Aanbiedingen");
    const data = blockDataRegistry.offers.createDefault() as { title: string };
    expect(data.title).toBe("Aanbiedingen");
  });

  it("newsletter, contactForm, and popup are publishable and duplicable", () => {
    for (const type of ["newsletter", "contactForm", "popup"] as const) {
      expect(blockDataRegistry[type].capabilities.publishable).toBe(true);
      expect(blockDataRegistry[type].capabilities.duplicable).toBe(true);
    }
  });

  it("contactForm normalize strips legacy name/email rows and keeps custom fields", () => {
    const def = blockDataRegistry.contactForm;
    const normalized = def.normalize({
      title: "Contact",
      body: "  Custom intro  ",
      fields: [{ id: "f1", text: "Naam" }, { id: "f2", text: "E-mail" }, { id: "f3", text: "Bericht" }],
    });
    expect((normalized as { body?: string }).body).toBe("  Custom intro  ");
    expect((normalized as { fields: Array<{ type: string; label: string }> }).fields).toEqual([
      expect.objectContaining({ type: "textarea", label: "Bericht" }),
    ]);
    expect(def.normalize({ title: "Contact", fields: [{ id: "f1", text: "Naam" }] })).toEqual(
      expect.objectContaining({
        body: undefined,
        textPlacement: "left",
        fields: DEFAULT_CONTACT_FORM_FIELDS,
      }),
    );
  });

  it("contactForm normalize accepts textPlacement top|left|right", () => {
    const def = blockDataRegistry.contactForm;
    expect(
      (def.normalize({ title: "X", textPlacement: "right", fields: [] }) as { textPlacement: string })
        .textPlacement,
    ).toBe("right");
    expect(
      (def.normalize({ title: "X", textPlacement: "above", fields: [] }) as { textPlacement: string })
        .textPlacement,
    ).toBe("top");
    expect(
      (def.normalize({ title: "X", fields: [] }) as { textPlacement: string }).textPlacement,
    ).toBe("left");
  });

  it("contactForm normalize defaults formColumnsDesktop to 2", () => {
    const def = blockDataRegistry.contactForm;
    expect(
      (def.normalize({ title: "X", fields: [] }) as { formColumnsDesktop: number }).formColumnsDesktop,
    ).toBe(2);
    expect(
      (def.normalize({ title: "X", formColumnsDesktop: 1, fields: [] }) as {
        formColumnsDesktop: number;
      }).formColumnsDesktop,
    ).toBe(1);
  });

  it("assertPickerTypesMatchRegistry accepts PUBLISHABLE_BLOCK_TYPES and rejects gaps", () => {
    expect(() => assertPickerTypesMatchRegistry(PUBLISHABLE_BLOCK_TYPES)).not.toThrow();
    expect(() =>
      assertPickerTypesMatchRegistry(PUBLISHABLE_BLOCK_TYPES.filter((t) => t !== "roadmap")),
    ).toThrow(/missing=\[roadmap\]/);
  });

  it("selectable picker types must equal publishable registry keys (sorted)", () => {
    expect([...PUBLISHABLE_BLOCK_TYPES].sort()).toEqual(
      ALL_BLOCK_TYPES.filter((t) => blockDataRegistry[t].capabilities.publishable).sort(),
    );
    expect(Object.keys(blockDataRegistry).sort()).toEqual([...ALL_BLOCK_TYPES].sort());
    expect(Object.keys(catalogDefinitions).sort()).toEqual([...ALL_BLOCK_TYPES].sort());
  });

  it("normalizeSpacerSize maps legacy tokens and pixels", () => {
    expect(normalizeSpacerSize("sm")).toBe("sm");
    expect(normalizeSpacerSize("xs")).toBe("xs");
    expect(normalizeSpacerSize("xl")).toBe("xl");
    expect(normalizeSpacerSize(24)).toBe("sm");
    expect(normalizeSpacerSize("120px")).toBe("xl");
    expect(normalizeSpacerSize("unknown")).toBe("md");
  });
});
