import { describe, expect, it } from "vitest";
import {
  ALL_BLOCK_TYPES,
  PUBLISHABLE_BLOCK_TYPES,
  assertPickerTypesMatchRegistry,
  type BlockType,
} from "@mccoy/cms-schema";
import { blockViewRegistry } from "./blockViewRegistry";

/**
 * Stage 5 parity gates — publishable BlockTypes must be registered in
 * blockViewRegistry. Explicit renderer exemptions require evidence in
 * `docs/refactoring/stage5-registry-inventory.md`.
 */
const RENDERER_EXEMPTIONS: readonly BlockType[] = [];

describe("blockViewRegistry parity (Stage 5)", () => {
  it("has no duplicate registry keys", () => {
    const keys = Object.keys(blockViewRegistry);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only registers known BlockTypes", () => {
    for (const key of Object.keys(blockViewRegistry)) {
      expect(ALL_BLOCK_TYPES).toContain(key);
    }
  });

  it("does not exempt types that are already registered", () => {
    for (const type of RENDERER_EXEMPTIONS) {
      expect(blockViewRegistry[type], `${type} should leave exemptions when registered`).toBeUndefined();
    }
  });

  it("registers every publishable BlockType (minus explicit exemptions)", () => {
    const missing = PUBLISHABLE_BLOCK_TYPES.filter(
      (t) => !blockViewRegistry[t] && !RENDERER_EXEMPTIONS.includes(t),
    );
    expect(missing, `Unregistered publishable views: ${missing.join(", ")}`).toEqual([]);
  });

  it("every registered entry is a function component", () => {
    for (const [type, View] of Object.entries(blockViewRegistry)) {
      expect(typeof View, `${type} view`).toBe("function");
    }
  });

  it("template/picker publishable set stays aligned with schema", () => {
    expect(() => assertPickerTypesMatchRegistry(PUBLISHABLE_BLOCK_TYPES)).not.toThrow();
  });
});
