import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLISHABLE_BLOCK_TYPES, createDefaultBlock } from "@mccoy/cms-schema";
import { blockViewRegistry } from "./blockViewRegistry";
import { RegisteredBlockView } from "./RegisteredBlockView";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const here = dirname(fileURLToPath(import.meta.url));

describe("RegisteredBlockView orchestration (Stage 5)", () => {
  it("contains no publishable switch case arms", () => {
    const src = readFileSync(join(here, "RegisteredBlockView.tsx"), "utf8");
    expect(src).not.toMatch(/switch\s*\(\s*type\s*\)/);
    for (const type of PUBLISHABLE_BLOCK_TYPES) {
      expect(src).not.toContain(`case "${type}"`);
    }
  });

  it("never hits fallback for default publishable blocks", () => {
    for (const type of PUBLISHABLE_BLOCK_TYPES) {
      expect(blockViewRegistry[type], type).toBeTypeOf("function");
      const html = renderToStaticMarkup(
        React.createElement(RegisteredBlockView, {
          block: createDefaultBlock(type),
          adminMode: true,
        }),
      );
      expect(html, type).not.toContain("Geen renderer voor");
      expect(html, type).not.toContain("unknown_type");
    }
  });
});
