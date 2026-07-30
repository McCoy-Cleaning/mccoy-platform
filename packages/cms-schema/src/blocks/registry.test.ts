import { describe, expect, it } from "vitest";
import type { BlockType } from "../types";
import { catalogDefinitions } from "./catalog";
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

  it("newsletter, contactForm, and popup are publishable and duplicable", () => {
    for (const type of ["newsletter", "contactForm", "popup"] as const) {
      expect(blockDataRegistry[type].capabilities.publishable).toBe(true);
      expect(blockDataRegistry[type].capabilities.duplicable).toBe(true);
    }
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
