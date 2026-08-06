import { describe, expect, it } from "vitest";
import {
  CURRENT_LAYOUT_VERSION,
  buildEditorLayoutRows,
  defaultSectionContent,
  migrateServicesCompositeSplit,
  migrateServicesPageSplit,
  normalizeCmsPage,
  removeFixedLayoutItem,
  type BuiltinCmsPage,
} from "./index";

function servicesPage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    pageKey: "services",
    id: "page_services",
    slug: "/services",
    title: "Diensten",
    description: "",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:services:main", kind: "fixed", key: "services.main", hidden: false },
      { id: "fixed:services:cards", kind: "fixed", key: "services.cards", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "services.main": defaultSectionContent("services.main"),
      "services.cards": defaultSectionContent("services.cards"),
    },
    updatedAt: 1,
    version: 1,
    ...overrides,
  } as BuiltinCmsPage;
}

describe("services composite independence", () => {
  it("moves legacy cards from services.main into services.cards", () => {
    const cards = (defaultSectionContent("services.cards") as { cards: unknown[] }).cards;
    const migrated = migrateServicesCompositeSplit({
      "services.main": {
        eyebrow: "Diensten",
        heading: "Ons aanbod",
        intro: "Intro tekst",
        cards,
      } as never,
    });

    expect(migrated["services.main"]).toMatchObject({
      heading: "Ons aanbod",
      intro: "Intro tekst",
    });
    expect(migrated["services.main"] && "cards" in migrated["services.main"]!).toBe(false);
    expect(migrated["services.cards"]?.cards).toHaveLength(cards.length);
    expect(migrated["services.cards"]?.cards[0]?.id).toBe("svc_regular");
  });

  it("inserts services.cards layout slot only while legacy main.cards exists", () => {
    const cards = (defaultSectionContent("services.cards") as { cards: unknown[] }).cards;
    const layout = [
      { id: "fixed:services:main" as const, kind: "fixed" as const, key: "services.main" as const, hidden: false },
    ];
    const content = {
      "services.main": {
        heading: "Ons aanbod",
        intro: "Intro",
        cards,
      },
    } as never;

    const first = migrateServicesPageSplit(content, layout);
    expect(first.layout.map((i) => (i.kind === "fixed" ? i.key : i.id))).toEqual([
      "services.main",
      "services.cards",
    ]);
    expect(first.content["services.main"] && "cards" in first.content["services.main"]!).toBe(false);

    // Second pass must not re-insert after intentional delete.
    const withoutCards = first.layout.filter(
      (i) => !(i.kind === "fixed" && i.key === "services.cards"),
    );
    const second = migrateServicesPageSplit(first.content, withoutCards);
    expect(second.layout.some((i) => i.kind === "fixed" && i.key === "services.cards")).toBe(false);
  });

  it("removing intro leaves dienstkaarten in layout and preserves card content", () => {
    const page = normalizeCmsPage(servicesPage()) as BuiltinCmsPage;
    const beforeCards = page.sectionContent?.["services.cards"];
    expect(beforeCards?.cards?.length).toBeGreaterThan(0);

    const removed = removeFixedLayoutItem(page, "services.main");
    expect(removed.ok).toBe(true);
    if (!removed.ok || removed.page.kind !== "builtin") return;

    const keys = removed.page.layout.flatMap((i) => (i.kind === "fixed" ? [i.key] : []));
    expect(keys).toEqual(["services.cards"]);
    expect(removed.page.sectionContent?.["services.cards"]).toEqual(beforeCards);
    expect(removed.page.sectionContent?.["services.main"]).toEqual(page.sectionContent?.["services.main"]);

    const rows = buildEditorLayoutRows(removed.page.layout, {
      blockLabel: () => "Sectie",
      minMovableIndex: 0,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("Dienstkaarten");
    expect(rows[0]?.canDelete).toBe(true);
  });

  it("dienstkaarten can be removed independently while intro remains", () => {
    const page = normalizeCmsPage(servicesPage()) as BuiltinCmsPage;
    const removed = removeFixedLayoutItem(page, "services.cards");
    expect(removed.ok).toBe(true);
    if (!removed.ok || removed.page.kind !== "builtin") return;

    const keys = removed.page.layout.flatMap((i) => (i.kind === "fixed" ? [i.key] : []));
    expect(keys).toEqual(["services.main"]);
    expect(removed.page.sectionContent?.["services.cards"]?.cards?.length).toBeGreaterThan(0);
  });
});
