import { describe, expect, it } from "vitest";
import {
  applyDraftToPage,
  isDraftDirty,
  moveLayoutItem,
  parseMigrateNormalizePage,
  toggleFixedSection,
  validatePublishableCmsPage,
  type PageDraft,
} from "./index";

describe("draft gate + content survival", () => {
  it("layout move in draft does not change published page until save semantics", () => {
    const published = parseMigrateNormalizePage({
      id: "page_home",
      slug: "/",
      title: "Home",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const moved = moveLayoutItem(
      published,
      published.layout.find((i) => i.kind === "fixed" && i.key === "home.stats")!.id,
      "down",
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    const draft: PageDraft = { overrides: { "stats.title": "25+ jaar" }, page: moved.page };
    expect(isDraftDirty(draft)).toBe(true);

    const effective = applyDraftToPage(published, draft);
    expect(effective.layout.map((i) => (i.kind === "fixed" ? i.key : i.blockId))).not.toEqual(
      published.layout.map((i) => (i.kind === "fixed" ? i.key : i.blockId)),
    );
    // Published clone untouched
    expect(published.layout[0]).toMatchObject({ key: "home.hero" });
    // Overrides stay independent of layout
    expect(draft.overrides["stats.title"]).toBe("25+ jaar");
  });

  it("hide survives in draft page and remains publishable", () => {
    const page = parseMigrateNormalizePage({
      id: "page_home",
      slug: "/",
      title: "Home",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const hidden = toggleFixedSection(page, "home.partners");
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    const publishable = validatePublishableCmsPage(hidden.page);
    expect(publishable.ok).toBe(true);
    const partners = hidden.page.layout.find((i) => i.kind === "fixed" && i.key === "home.partners");
    expect(partners && partners.kind === "fixed" && partners.hidden).toBe(true);
  });

  it("discard path: applyDraftToPage without draft returns published layout", () => {
    const page = parseMigrateNormalizePage({
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
    const effective = applyDraftToPage(page, undefined);
    expect(effective.layout[0]).toMatchObject({ key: "about.main" });
  });
});
