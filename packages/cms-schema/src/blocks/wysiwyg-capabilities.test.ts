import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertCanvasPathsExistInSchema,
  BLOCK_WYSIWYG_CAPABILITIES,
  getBlockWysiwygCapabilities,
  zodSchemaHasPath,
} from "./wysiwyg-capabilities";
import { ALL_BLOCK_TYPES, getBlockDataDefinition } from "./registry";

describe("BLOCK_WYSIWYG_CAPABILITIES", () => {
  it("has exactly one entry for every ALL_BLOCK_TYPES value", () => {
    const keys = Object.keys(BLOCK_WYSIWYG_CAPABILITIES).sort();
    const types = [...ALL_BLOCK_TYPES].sort();
    expect(keys).toEqual(types);
    expect(keys).toHaveLength(types.length);
    for (const type of ALL_BLOCK_TYPES) {
      expect(getBlockWysiwygCapabilities(type)).toBe(BLOCK_WYSIWYG_CAPABILITIES[type]);
    }
  });

  it("spacer has no canvas fields", () => {
    expect(BLOCK_WYSIWYG_CAPABILITIES.spacer.canvas).toHaveLength(0);
    expect(BLOCK_WYSIWYG_CAPABILITIES.spacer.advancedOnly).toEqual(
      expect.arrayContaining(["size", "divider"]),
    );
  });

  it.each(ALL_BLOCK_TYPES)("%s: no path appears in both canvas and advancedOnly", (type) => {
    const { canvas, advancedOnly } = getBlockWysiwygCapabilities(type);
    const canvasPaths = new Set(canvas.map((f) => f.path));
    const advanced = new Set(advancedOnly);
    for (const path of canvasPaths) {
      expect(advanced.has(path), `${type}: "${path}" in both canvas and advancedOnly`).toBe(
        false,
      );
    }
  });

  it.each(ALL_BLOCK_TYPES)("%s: no duplicate paths inside one capability entry", (type) => {
    const { canvas, advancedOnly } = getBlockWysiwygCapabilities(type);
    const canvasPaths = canvas.map((f) => f.path);
    expect(new Set(canvasPaths).size, `${type} duplicate canvas paths`).toBe(canvasPaths.length);
    expect(new Set(advancedOnly).size, `${type} duplicate advancedOnly paths`).toBe(
      advancedOnly.length,
    );
  });

  it.each(ALL_BLOCK_TYPES)(
    "%s: every canvas and advancedOnly path exists on the block schema",
    (type) => {
      expect(() => assertCanvasPathsExistInSchema(type)).not.toThrow();
    },
  );
});

describe("zodSchemaHasPath", () => {
  const sample = z.object({
    title: z.string(),
    nested: z
      .object({
        accent: z.string().optional(),
      })
      .optional(),
    items: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    ),
  });

  it("resolves top-level, nested, and array-element paths", () => {
    expect(zodSchemaHasPath(sample, "title")).toBe(true);
    expect(zodSchemaHasPath(sample, "nested.accent")).toBe(true);
    expect(zodSchemaHasPath(sample, "items")).toBe(true);
    expect(zodSchemaHasPath(sample, "items.label")).toBe(true);
    expect(zodSchemaHasPath(sample, "headng")).toBe(false);
    expect(zodSchemaHasPath(sample, "items.missing")).toBe(false);
  });

  it("detects typos against a real catalog schema", () => {
    const schema = getBlockDataDefinition("hero").schema;
    expect(zodSchemaHasPath(schema as z.ZodTypeAny, "title")).toBe(true);
    expect(zodSchemaHasPath(schema as z.ZodTypeAny, "headng")).toBe(false);
  });
});
