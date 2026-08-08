import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_FIXED_SECTION_KEYS,
  BUILTIN_CMS_INVENTORY_PAGES,
  FIXED_SECTIONS_BY_PAGE,
  type BuiltinPageKey,
  type LayoutItem,
} from "@mccoy/cms-schema";
import {
  classifyLayoutItem,
  missingFixedRenderersForPage,
  resolveSitePageComposition,
  STOREFRONT_COMPOSITION_OWNERS,
} from "./site-composition";
import { usesStorefrontPresentationAdapter } from "./block-presentation";
import type { Block } from "@mccoy/cms-schema";

const SITE_ROOT = join(process.cwd(), "src/components/site");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsFiles(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

/** Extract `"fixed.key": Component` registrations from pageSectionRenderers source. */
function registeredFixedKeysFromSource(): Map<BuiltinPageKey, Set<string>> {
  const src = readFileSync(join(SITE_ROOT, "pageSectionRenderers.tsx"), "utf8");
  const homeSrc = readFileSync(join(SITE_ROOT, "homeSectionRenderers.tsx"), "utf8");
  const map = new Map<BuiltinPageKey, Set<string>>();
  for (const page of BUILTIN_CMS_INVENTORY_PAGES) {
    map.set(page.pageKey, new Set());
  }
  const pageBlocks = [
    ...src.matchAll(/^\s*(home|about|services|products|contact|vacatures|offerte|privacy|terms):\s*\{([\s\S]*?)^\s*\},?/gm),
  ];
  for (const m of pageBlocks) {
    const pageKey = m[1] as BuiltinPageKey;
    const body = m[2] ?? "";
    const keys = [...body.matchAll(/["']([a-z]+\.[A-Za-z]+)["']\s*:/g)].map((x) => x[1]!);
    const set = map.get(pageKey) ?? new Set();
    for (const k of keys) set.add(k);
    map.set(pageKey, set);
  }
  // homeSectionRenderers is spread into pageSectionRenderers — also parse directly.
  const homeKeys = [...homeSrc.matchAll(/["'](home\.[A-Za-z]+)["']\s*:/g)].map((x) => x[1]!);
  const homeSet = map.get("home") ?? new Set();
  for (const k of homeKeys) homeSet.add(k);
  map.set("home", homeSet);
  return map;
}

describe("R7 storefront composition contract", () => {
  it("classifies layout items by representation class, not BlockType", () => {
    const fixedItem = {
      id: "fixed_home_hero",
      kind: "fixed",
      key: "home.hero",
      hidden: false,
    } as LayoutItem;
    const blockItem = {
      id: "lay_block_1",
      kind: "block",
      blockId: "blk_1",
      hidden: true,
    } as LayoutItem;
    const layout: LayoutItem[] = [fixedItem, blockItem];
    expect(resolveSitePageComposition(layout)).toEqual([
      { kind: "fixed", id: "fixed_home_hero", sectionKey: "home.hero", hidden: false },
      { kind: "block", id: "lay_block_1", blockId: "blk_1", hidden: true },
    ]);
    expect(classifyLayoutItem(fixedItem).kind).toBe("fixed");
    expect(classifyLayoutItem(blockItem).kind).toBe("block");
  });

  it("registers a public fixed renderer for every M5 fixed key", () => {
    const registered = registeredFixedKeysFromSource();
    const missing: string[] = [];
    for (const page of BUILTIN_CMS_INVENTORY_PAGES) {
      const gaps = missingFixedRenderersForPage(
        page.pageKey as BuiltinPageKey,
        registered.get(page.pageKey) ?? [],
      );
      for (const key of gaps) missing.push(`${page.pageKey}:${key}`);
    }
    expect(missing).toEqual([]);
    expect(ALL_FIXED_SECTION_KEYS.length).toBeGreaterThan(0);
    expect(Object.keys(FIXED_SECTIONS_BY_PAGE).length).toBeGreaterThan(0);
  });

  it("does not contain a reusable BlockType switch in composition modules", () => {
    const hotspots = [
      "PageLayoutRenderer.tsx",
      "BlockView.tsx",
      "site-composition.ts",
      "pageSectionRenderers.tsx",
      "homeSectionRenderers.tsx",
      "blockPresentationAdapters.tsx",
    ];
    const forbidden = [
      /case\s+["']textImage["']/,
      /case\s+["']featureGrid["']/,
      /case\s+["']statsCounters["']/,
      /switch\s*\(\s*block\.type\s*\)/,
      /switch\s*\(\s*.*\.type\s+as\s+BlockType/,
    ];
    for (const file of hotspots) {
      const src = readFileSync(join(SITE_ROOT, file), "utf8");
      for (const pattern of forbidden) {
        expect(src, `${file} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("forbids storefront → cms-editor / admin imports under components/site", () => {
    const files = walkTsFiles(SITE_ROOT);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (
        /from\s+["']@mccoy\/cms-editor["']/.test(src) ||
        /from\s+["'][^"']*apps\/admin/.test(src) ||
        /from\s+["']@mccoy\/admin/.test(src)
      ) {
        offenders.push(file.replace(process.cwd(), ""));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("presentation adapters only target Producten/About dual-read presentations", () => {
    const plain: Block = { id: "b1", type: "textImage", data: { title: "x", body: "y" } };
    const intro: Block = {
      id: "b2",
      type: "textImage",
      data: { title: "x", body: "y", presentation: "productsIntro" },
    };
    expect(usesStorefrontPresentationAdapter(plain)).toBe(false);
    expect(usesStorefrontPresentationAdapter(intro)).toBe(true);
  });

  it("documents canonical composition owners", () => {
    expect(STOREFRONT_COMPOSITION_OWNERS.reusableBlocks).toContain("RegisteredBlockView");
    expect(STOREFRONT_COMPOSITION_OWNERS.orchestration).toBe("PageLayoutRenderer");
  });
});
