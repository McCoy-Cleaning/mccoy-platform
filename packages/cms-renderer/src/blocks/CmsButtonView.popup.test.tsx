import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clearPopupBlockView, getPopupBlockView } from "./popupBlockRenderer";

describe("CmsButtonView popup bridge", () => {
  it("does not import RegisteredBlockView (breaks registry cycle)", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "CmsButtonView.tsx"), "utf8");
    expect(src).not.toMatch(/from\s+["']\.\/RegisteredBlockView["']/);
    expect(src).not.toMatch(/import\s*\(\s*["']\.\/RegisteredBlockView["']\s*\)/);
    expect(src).toMatch(/getPopupBlockView/);
  });

  it("primitives barrel does not re-export CmsButtonView", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "primitives.tsx"), "utf8");
    expect(src).not.toMatch(/from\s+["']\.\/CmsButtonView["']/);
    expect(src).not.toMatch(/export\s+\{[^}]*CmsButtonView/);
    expect(src).not.toMatch(/export\s+\*\s+from\s+["']\.\/CmsButtonView["']/);
  });

  it("keeps package entry + RegisteredBlockView as side effects (anti tree-shake)", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(dir, "../../package.json"), "utf8")) as {
      sideEffects: string[] | boolean;
    };
    expect(Array.isArray(pkg.sideEffects)).toBe(true);
    expect(pkg.sideEffects).toEqual(
      expect.arrayContaining([
        "./src/index.tsx",
        "./src/blocks/RegisteredBlockView.tsx",
      ]),
    );
  });

  it("registers the popup content view when RegisteredBlockView loads", async () => {
    clearPopupBlockView();
    expect(getPopupBlockView()).toBeNull();
    await import("./RegisteredBlockView");
    expect(getPopupBlockView()).not.toBeNull();
  });
});
