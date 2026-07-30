import { describe, expect, it } from "vitest";
import {
  CURRENT_LAYOUT_VERSION,
  addFixedLayoutItem,
  addLayoutBlock,
  moveLayoutItem,
  parseMigrateNormalizePage,
  removeFixedLayoutItem,
  removeLayoutBlock,
  setLayoutItemContentAlign,
  resolveLayoutItemContentAlign,
  toggleFixedSection,
  toggleLayoutItemHidden,
  validatePublishableCmsPage,
  type Block,
  type CmsPage,
} from "./index";

function block(id: string, type = "richText"): Block {
  return { id, type: type as Block["type"], data: { html: `<p>${id}</p>` } };
}

function homeSeed(overrides: Partial<{ extraBlocks: Block[]; layout: unknown; layoutVersion: number }> = {}) {
  return {
    id: "page_home",
    slug: "/",
    title: "Home",
    description: "desc",
    isCustom: false,
    inNav: true,
    blocks: [],
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

describe("extraBlocks → layout migration", () => {
  it("migrates no extras to default fixed layout", () => {
    const page = parseMigrateNormalizePage(homeSeed());
    expect(page).not.toBeNull();
    expect(page!.kind).toBe("builtin");
    if (page!.kind !== "builtin") return;
    expect(page!.pageKey).toBe("home");
    expect(page!.layoutVersion).toBe(CURRENT_LAYOUT_VERSION);
    expect(page!.layout[0]).toMatchObject({ kind: "fixed", key: "home.hero", hidden: false });
    expect(page!.layout.map((i) => (i.kind === "fixed" ? i.key : i.blockId))).toEqual([
      "home.hero",
      "home.partners",
      "home.stats",
      "home.workGallery",
    ]);
    expect(page!.extraBlocks).toBeUndefined();
  });

  it("appends one extra block after fixed sections", () => {
    const page = parseMigrateNormalizePage(homeSeed({ extraBlocks: [block("b1")] }));
    expect(page!.blocks.map((b) => b.id)).toContain("b1");
    expect(page!.layout.at(-1)).toMatchObject({ kind: "block", blockId: "b1" });
    expect(page!.layout[0]).toMatchObject({ key: "home.hero" });
  });

  it("appends many extras and is idempotent", () => {
    const raw = homeSeed({ extraBlocks: [block("b1"), block("b2"), block("b3")] });
    const once = parseMigrateNormalizePage(raw)!;
    const twice = parseMigrateNormalizePage({
      ...once,
      extraBlocks: [block("b1"), block("b2"), block("b3")],
    })!;
    expect(once.layout.filter((i) => i.kind === "block")).toHaveLength(3);
    expect(twice.layout.filter((i) => i.kind === "block")).toHaveLength(3);
    expect(twice.blocks.map((b) => b.id)).toEqual(["b1", "b2", "b3"]);
  });

  it("skips duplicate extra block ids", () => {
    const page = parseMigrateNormalizePage(
      homeSeed({
        blocks: [block("b1")],
        extraBlocks: [block("b1"), block("b2")],
      } as never),
    )!;
    expect(page.blocks.filter((b) => b.id === "b1")).toHaveLength(1);
    expect(page.layout.filter((i) => i.kind === "block" && i.blockId === "b1")).toHaveLength(1);
  });
});

describe("layoutVersion reconciliation", () => {
  it("reconciles only when layoutVersion is older", () => {
    const page = parseMigrateNormalizePage(
      homeSeed({
        layout: [
          { id: "fixed:home:hero", kind: "fixed", key: "home.hero", hidden: false },
          { id: "fixed:home:partners", kind: "fixed", key: "home.partners", hidden: true },
        ],
        layoutVersion: 0,
      }),
    )!;
    const keys = page.layout.flatMap((i) => (i.kind === "fixed" ? [i.key] : []));
    expect(keys).toContain("home.stats");
    expect(keys).toContain("home.workGallery");
    const partners = page.layout.find((i) => i.kind === "fixed" && i.key === "home.partners");
    expect(partners && partners.kind === "fixed" && partners.hidden).toBe(true);
  });

  it("preserves intentional absence of optional fixed sections at current version", () => {
    const page = parseMigrateNormalizePage(
      homeSeed({
        layout: [
          { id: "fixed:home:partners", kind: "fixed", key: "home.partners", hidden: false },
        ],
        layoutVersion: CURRENT_LAYOUT_VERSION,
      }),
    )!;
    const keys = page.layout.flatMap((i) => (i.kind === "fixed" ? [i.key] : []));
    // home.workGallery is required and always re-attached.
    expect(keys).toEqual(["home.partners", "home.workGallery"]);
    expect(validatePublishableCmsPage(page).ok).toBe(true);
  });
});

describe("layout operations", () => {
  it("allows insert at index 0 when first is unlocked", () => {
    const page = parseMigrateNormalizePage(homeSeed())!;
    const result = addLayoutBlock(page, block("new"), 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.layout[0]).toMatchObject({ kind: "block", blockId: "new" });
  });

  it("allows insert after hero", () => {
    const page = parseMigrateNormalizePage(homeSeed())!;
    const result = addLayoutBlock(page, block("new"), 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.layout[1]).toMatchObject({ kind: "block", blockId: "new" });
    expect(result.page.layout[0]).toMatchObject({ key: "home.hero" });
  });

  it("about.main is movable and hideable", () => {
    const about = parseMigrateNormalizePage({
      id: "page_about",
      slug: "/about",
      title: "About",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    expect(about.layout[0]).toMatchObject({ key: "about.main" });
    const withBlock = addLayoutBlock(about, block("x"), 1);
    expect(withBlock.ok).toBe(true);
    if (!withBlock.ok) return;
    const moved = moveLayoutItem(withBlock.page, withBlock.page.layout[0]!.id, "down");
    expect(moved.ok).toBe(true);
    expect(toggleFixedSection(about, "about.main").ok).toBe(true);
  });

  it("NO_OP when moving past bounds", () => {
    const page = parseMigrateNormalizePage(homeSeed())!;
    const last = page.layout[page.layout.length - 1]!;
    expect(moveLayoutItem(page, last.id, "down")).toEqual({ ok: false, code: "NO_OP" });
  });

  it("toggle hide works for CMS blocks", () => {
    const page = parseMigrateNormalizePage(homeSeed({ extraBlocks: [block("b1")] }))!;
    const layoutItem = page.layout.find((i) => i.kind === "block" && i.blockId === "b1");
    expect(layoutItem).toBeTruthy();
    const result = toggleLayoutItemHidden(page, layoutItem!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hidden = result.page.layout.find((i) => i.kind === "block" && i.blockId === "b1");
    expect(hidden && hidden.kind === "block" && hidden.hidden).toBe(true);
  });

  it("allows hiding hero", () => {
    const page = parseMigrateNormalizePage(homeSeed())!;
    const result = toggleFixedSection(page, "home.hero");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hero = result.page.layout.find((i) => i.kind === "fixed" && i.key === "home.hero");
    expect(hero && hero.kind === "fixed" && hero.hidden).toBe(true);
    expect(validatePublishableCmsPage(result.page).ok).toBe(true);
  });

  it("removes and restores fixed sections while preserving sectionContent", () => {
    const page = parseMigrateNormalizePage(homeSeed())! as CmsPage;
    if (page.kind !== "builtin") return;
    const beforeContent = page.sectionContent?.["home.stats"];
    const removed = removeFixedLayoutItem(page, "home.stats");
    expect(removed.ok).toBe(true);
    if (!removed.ok || removed.page.kind !== "builtin") return;
    expect(removed.page.layout.some((i) => i.kind === "fixed" && i.key === "home.stats")).toBe(false);
    expect(removed.page.sectionContent?.["home.stats"]).toEqual(beforeContent);

    const restored = addFixedLayoutItem(removed.page, "home.stats");
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.page.layout.some((i) => i.kind === "fixed" && i.key === "home.stats")).toBe(true);
  });

  it("sets contentAlign on constrained sections and rejects full-width", () => {
    const page = parseMigrateNormalizePage(homeSeed({ extraBlocks: [block("b1")] }))!;
    const partners = page.layout.find((i) => i.kind === "fixed" && i.key === "home.partners")!;
    const hero = page.layout.find((i) => i.kind === "fixed" && i.key === "home.hero")!;
    const blockItem = page.layout.find((i) => i.kind === "block" && i.blockId === "b1")!;

    expect(resolveLayoutItemContentAlign(partners)).toBe("center");
    expect(setLayoutItemContentAlign(page, partners.id, "left").ok).toBe(true);
    const left = setLayoutItemContentAlign(page, partners.id, "left");
    expect(left.ok && resolveLayoutItemContentAlign(left.page.layout.find((i) => i.id === partners.id)!)).toBe(
      "left",
    );
    expect(setLayoutItemContentAlign(page, blockItem.id, "right").ok).toBe(true);
    const centered = setLayoutItemContentAlign(page, partners.id, "center");
    expect(centered.ok).toBe(true);
    if (centered.ok) {
      const item = centered.page.layout.find((i) => i.id === partners.id)!;
      expect(item.contentAlign).toBeUndefined();
      expect(resolveLayoutItemContentAlign(item)).toBe("center");
    }
    expect(setLayoutItemContentAlign(page, hero.id, "left")).toEqual({
      ok: false,
      code: "NOT_ALIGNABLE",
    });
  });

  it("persists contentAlign and block hidden through migrate", () => {
    const seeded = parseMigrateNormalizePage(homeSeed({ extraBlocks: [block("b1")] }))!;
    const partners = seeded.layout.find((i) => i.kind === "fixed" && i.key === "home.partners")!;
    const blockItem = seeded.layout.find((i) => i.kind === "block" && i.blockId === "b1")!;
    const aligned = setLayoutItemContentAlign(seeded, partners.id, "right");
    expect(aligned.ok).toBe(true);
    if (!aligned.ok) return;
    const hidden = toggleLayoutItemHidden(aligned.page, blockItem.id);
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;

    const roundTrip = parseMigrateNormalizePage(hidden.page as never)!;
    const p2 = roundTrip.layout.find((i) => i.kind === "fixed" && i.key === "home.partners");
    const b2 = roundTrip.layout.find((i) => i.kind === "block" && i.blockId === "b1");
    expect(p2 && p2.kind === "fixed" && p2.contentAlign).toBe("right");
    expect(b2 && b2.kind === "block" && b2.hidden).toBe(true);
  });

  it("vacatures page policy blocks a second jobs block and removal", () => {
    const page = parseMigrateNormalizePage({
      id: "page_vacatures",
      slug: "/vacatures",
      title: "Vacatures",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    expect(page.blocks.filter((b) => b.type === "jobs")).toHaveLength(1);
    const jobsBlock = page.blocks.find((b) => b.type === "jobs")!;
    expect(jobsBlock.dataVersion).toBe(3);
    const jobsLayout = page.layout.find(
      (i) => i.kind === "block" && i.blockId === jobsBlock.id,
    );
    expect(jobsLayout && jobsLayout.kind === "block" && jobsLayout.hidden).toBe(true);
    expect(addLayoutBlock(page, block("jobs2", "jobs"), page.layout.length)).toEqual({
      ok: false,
      code: "POLICY_BLOCKED",
    });
    expect(removeLayoutBlock(page, jobsBlock.id)).toEqual({
      ok: false,
      code: "POLICY_BLOCKED",
    });
    // Fixed chrome can still be removed; jobs block policy is independent.
    expect(removeFixedLayoutItem(page, "vacatures.main").ok).toBe(true);
  });

  it("contact page has intro, info, and required form sections", () => {
    const page = parseMigrateNormalizePage({
      id: "page_contact",
      slug: "/contact",
      title: "Contact",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const keys = page.layout.flatMap((i) => (i.kind === "fixed" ? [i.key] : []));
    expect(keys).toEqual(["contact.main", "contact.info", "contact.form"]);
    expect(removeFixedLayoutItem(page, "contact.form")).toEqual({
      ok: false,
      code: "NOT_REMOVABLE",
    });
    expect(removeFixedLayoutItem(page, "contact.info")).toEqual({
      ok: false,
      code: "NOT_REMOVABLE",
    });
    expect(toggleLayoutItemHidden(page, "fixed:contact:form").ok).toBe(true);
    expect(removeFixedLayoutItem(page, "contact.main").ok).toBe(true);
  });

  it("offerte page has intro, info, and required form sections", () => {
    const page = parseMigrateNormalizePage({
      id: "page_offerte",
      slug: "/offerte",
      title: "Offerte",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const keys = page.layout.flatMap((i) => (i.kind === "fixed" ? [i.key] : []));
    expect(keys).toEqual(["offerte.main", "offerte.info", "offerte.form"]);
    expect(removeFixedLayoutItem(page, "offerte.form")).toEqual({
      ok: false,
      code: "NOT_REMOVABLE",
    });
    expect(removeFixedLayoutItem(page, "offerte.info")).toEqual({
      ok: false,
      code: "NOT_REMOVABLE",
    });
    expect(toggleLayoutItemHidden(page, "fixed:offerte:form").ok).toBe(true);
    expect(removeFixedLayoutItem(page, "offerte.main").ok).toBe(true);
  });

  it("vacatures jobs listing hide migration is one-shot (admin unhide sticks)", () => {
    const page = parseMigrateNormalizePage({
      id: "page_vacatures",
      slug: "/vacatures",
      title: "Vacatures",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const jobsBlock = page.blocks.find((b) => b.type === "jobs")!;
    const layoutId = page.layout.find(
      (i) => i.kind === "block" && i.blockId === jobsBlock.id,
    )!.id;
    const shown = toggleLayoutItemHidden(page, layoutId);
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    const again = parseMigrateNormalizePage(shown.page as never)!;
    const item = again.layout.find((i) => i.kind === "block" && i.blockId === jobsBlock.id);
    // Visible sections may omit `hidden` (undefined) or set it false after migrate.
    expect(item && item.kind === "block" && item.hidden).not.toBe(true);
  });

  it("strips removed fullImage blocks from legacy pages", () => {
    const page = parseMigrateNormalizePage({
      ...homeSeed(),
      blocks: [
        {
          id: "b_full",
          type: "fullImage",
          data: { caption: "gone" },
        },
        {
          id: "b_text",
          type: "richText",
          data: { title: "Keep", body: "ok" },
        },
      ],
      layout: [
        { id: "l1", kind: "block", blockId: "b_full" },
        { id: "l2", kind: "block", blockId: "b_text" },
      ],
      layoutVersion: CURRENT_LAYOUT_VERSION,
    });
    expect(page).toBeTruthy();
    expect(page!.blocks.some((b) => (b.type as string) === "fullImage")).toBe(false);
    expect(page!.blocks.some((b) => b.id === "b_text")).toBe(true);
    expect(page!.layout.some((i) => i.kind === "block" && i.blockId === "b_full")).toBe(false);
  });

  it("re-attaches required home.workGallery when missing from layout", () => {
    const page = parseMigrateNormalizePage({
      ...homeSeed(),
      layout: [
        { id: "fixed_home.hero", kind: "fixed", key: "home.hero" },
        { id: "fixed_home.partners", kind: "fixed", key: "home.partners" },
        { id: "fixed_home.stats", kind: "fixed", key: "home.stats" },
      ],
      layoutVersion: CURRENT_LAYOUT_VERSION,
    });
    expect(page).toBeTruthy();
    expect(page!.layout.some((i) => i.kind === "fixed" && i.key === "home.workGallery")).toBe(
      true,
    );
  });
});
