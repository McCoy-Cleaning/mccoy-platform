import { describe, expect, it } from "vitest";
import { CURRENT_LAYOUT_VERSION } from "./sections";
import { defaultFixedLayout } from "./layout";
import { defaultSectionContent } from "./content";
import type { BuiltinCmsPage, CustomCmsPage, PageDraft } from "./types";
import { normalizeCmsPage } from "./pipeline";
import { applyDraftToPage } from "./draft";
import { buildEditorLayoutRows, countEditorSections } from "./composite-sections";
import {
  countCmsPageEditorSections,
  createLocalDraftEnvelope,
  hashCmsPageContent,
  localDraftEnvelopeFromPageDraft,
  resolveCmsEditorSession,
  resolveCmsPageForDisplay,
  shouldRestoreLocalDraft,
  summarizeCmsPageStructure,
} from "./editor-session";
import {
  productsMigrationBlockId,
  resolveProductsBlocksLayout,
} from "./migration/products-blocks";

/** Mirrors Admin Secties Totaal: rows from display-resolved layout. */
function sectiesTotalFromDisplay(page: BuiltinCmsPage | CustomCmsPage): number {
  const display = resolveCmsPageForDisplay(page, "nl");
  return buildEditorLayoutRows(display.layout, {
    blockLabel: () => "Sectie",
    minMovableIndex: 0,
  }).length;
}

function productsPublished(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  const main = {
    ...(defaultSectionContent("products.main") as object),
    heading: "PUBLISHED Assortiment heading",
    intro: "Published intro that must match Admin when no draft exists.",
  };
  const info = {
    ...(defaultSectionContent("products.info") as object),
    heading: "PUBLISHED cards heading",
  };
  return normalizeCmsPage({
    kind: "builtin",
    isCustom: false,
    id: "page_products",
    pageKey: "products",
    slug: "/products",
    title: "Producten",
    description: "Producten",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
      { id: "fixed:products:info", kind: "fixed", key: "products.info", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "products.main": main,
      "products.info": info,
    } as BuiltinCmsPage["sectionContent"],
    updatedAt: 1_700_000_000_000,
    version: 3,
    productsBlocksMigration: { version: 1, status: "not_started" },
    ...overrides,
  }) as BuiltinCmsPage;
}

function productsLocalSeedStale(): BuiltinCmsPage {
  // Stale admin localStorage seed — different copy, newer updatedAt (RC2 timestamp trap).
  const main = {
    ...(defaultSectionContent("products.main") as object),
    heading: "LOCAL SEED heading — must NOT win without a draft",
    intro: "Local seed intro",
  };
  return normalizeCmsPage({
    kind: "builtin",
    isCustom: false,
    id: "page_products",
    pageKey: "products",
    slug: "/products",
    title: "Producten",
    description: "Producten",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
      { id: "fixed:products:info", kind: "fixed", key: "products.info", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "products.main": main,
      "products.info": defaultSectionContent("products.info"),
    } as BuiltinCmsPage["sectionContent"],
    updatedAt: Date.now(),
    version: 1,
    productsBlocksMigration: { version: 1, status: "not_started" },
  }) as BuiltinCmsPage;
}

/**
 * Simulates the pre-repair Admin path: ensure migrates local seed into a dirty draft
 * before reconcile can hydrate published. This is the Producten A≠B bug.
 */
function legacyAdminEnsureCreatesDraftFromLocal(
  local: BuiltinCmsPage,
): { publishedKept: BuiltinCmsPage; draft: PageDraft } {
  const resolved = resolveProductsBlocksLayout(local);
  return {
    publishedKept: local,
    draft: { overrides: {}, page: structuredClone(resolved.page) },
  };
}

describe("CMS admin ↔ storefront consistency", () => {
  it("no-draft: Admin session display fingerprint equals storefront resolve of published", () => {
    const published = productsPublished();
    const storefrontDisplay = resolveCmsPageForDisplay(published, "nl");

    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: published,
      localDraft: null,
      savedDraftPage: null,
    });

    expect(session.statusLabel).toBe("live");
    expect(session.source).toBe("published");
    expect(session.dirty).toBe(false);
    expect(session.page).not.toBeNull();
    expect(session.displayPage).not.toBeNull();

    const adminFp = hashCmsPageContent(session.displayPage!);
    const storefrontFp = hashCmsPageContent(storefrontDisplay);
    expect(adminFp).toBe(storefrontFp);

    // Structural sections must match (Intro + Assortiment presentations).
    const adminSum = summarizeCmsPageStructure(session.displayPage!);
    const pubSum = summarizeCmsPageStructure(storefrontDisplay);
    expect(adminSum.layoutKinds).toEqual(pubSum.layoutKinds);
    expect(adminSum.contentHash).toBe(pubSum.contentHash);
  });

  it("REGRESSION: legacy ensure-from-local-seed must not be treated as Live published parity", () => {
    const published = productsPublished();
    const local = productsLocalSeedStale();
    const legacy = legacyAdminEnsureCreatesDraftFromLocal(local);

    // Pre-repair behavior: admin editable = apply draft of migrated seed onto local seed.
    const adminEditable = applyDraftToPage(legacy.publishedKept, legacy.draft);
    const storefrontDisplay = resolveCmsPageForDisplay(published, "nl");

    const adminFp = hashCmsPageContent(resolveCmsPageForDisplay(adminEditable, "nl"));
    const storefrontFp = hashCmsPageContent(storefrontDisplay);

    // Demonstrates the bug: Admin B ≠ published A with no intentional user edit.
    expect(adminFp).not.toBe(storefrontFp);

    // Shared session with published hydrated + no local envelope → must restore parity.
    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: published,
      localDraft: null,
    });
    expect(hashCmsPageContent(session.displayPage!)).toBe(storefrontFp);
    expect(session.statusLabel).toBe("live");
  });

  it("local unsaved: restores dirty envelope and labels Niet-opgeslagen hersteld", () => {
    const published = productsPublished();
    const edited = structuredClone(published);
    if (edited.kind === "builtin") {
      const main = {
        ...(edited.sectionContent["products.main"] as object),
        heading: "Local unsaved edit",
      };
      edited.sectionContent = {
        ...edited.sectionContent,
        "products.main": main as BuiltinCmsPage["sectionContent"]["products.main"],
      };
    }
    const envelope = createLocalDraftEnvelope({
      pageId: "page_products",
      baselinePage: published,
      draft: { overrides: {}, page: edited },
      restoredFromStorage: true,
    });
    expect(envelope.dirty).toBe(true);

    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: published,
      localDraft: envelope,
    });
    expect(session.statusLabel).toBe("local_restored");
    expect(session.statusCopyNl).toBe("Niet-opgeslagen hersteld");
    expect(session.restoredLocalDraft).toBe(true);
    expect(session.source).toBe("local_unsaved");
  });

  it("saved draft: Concept when server concept differs from published", () => {
    const published = productsPublished();
    const concept = structuredClone(published) as BuiltinCmsPage;
    if (concept.kind === "builtin") {
      const main = {
        ...(concept.sectionContent["products.main"] as object),
        heading: "CONCEPT-ONLY heading",
      };
      concept.sectionContent = {
        ...concept.sectionContent,
        "products.main": main as BuiltinCmsPage["sectionContent"]["products.main"],
      };
    }

    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: published,
      localDraft: null,
      savedDraftPage: concept,
    });
    expect(session.statusLabel).toBe("concept");
    expect(session.source).toBe("saved_draft");
    expect(session.hasSavedDraft).toBe(true);
  });

  it("stale conflict: server newer than local baseline → conflict", () => {
    const published = productsPublished({ version: 3, updatedAt: 100 });
    const edited = structuredClone(published);
    edited.title = "Local edit on old baseline";
    const envelope = createLocalDraftEnvelope({
      pageId: "page_products",
      baselinePage: productsPublished({ version: 2, updatedAt: 50 }),
      draft: { overrides: {}, page: edited },
    });

    const newerServer = productsPublished({
      version: 4,
      updatedAt: 200,
      title: "Server moved on",
    });

    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: newerServer,
      localDraft: envelope,
    });
    expect(session.conflict).toBe(true);
    expect(session.statusLabel).toBe("conflict");
    expect(session.statusCopyNl).toBe("Conflict");
  });

  it("load failure: never invents a default page", () => {
    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: null,
      localDraft: null,
      loadError: "Durable CMS store unavailable",
    });
    expect(session.statusLabel).toBe("load_error");
    expect(session.page).toBeNull();
    expect(session.displayPage).toBeNull();
    expect(session.loadError).toContain("Durable");
  });

  it("never restores dirty:false or hash===baseline envelopes", () => {
    const published = productsPublished();
    const empty = createLocalDraftEnvelope({
      pageId: "page_products",
      baselinePage: published,
      draft: { overrides: {} },
    });
    expect(empty.dirty).toBe(false);

    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: published,
      localDraft: empty,
    });
    expect(session.statusLabel).toBe("live");
    expect(session.restoredLocalDraft).toBe(false);
  });

  it("REGRESSION: overview section count uses display resolve (not raw fixed+blocks leftovers)", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");

    // Start from a healthy migrated Intro+Assortiment page, then re-attach
    // superseded fixed slots + a duplicate Intro so raw layout counts as 5.
    const migrated = resolveProductsBlocksLayout(productsPublished()).page;
    const rawDualRead: BuiltinCmsPage = {
      ...migrated,
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
        migratedAt: "2026-01-01T00:00:00.000Z",
      },
      blocks: [
        ...migrated.blocks,
        {
          id: "dup_intro",
          type: "textImage",
          data: { presentation: "productsIntro", title: "Duplicate intro", body: "x" },
        },
      ],
      layout: [
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
        { id: "fixed:products:info", kind: "fixed", key: "products.info", hidden: false },
        { id: `block:${mainId}`, kind: "block", blockId: mainId },
        { id: `block:${infoId}`, kind: "block", blockId: infoId },
        { id: "block:dup_intro", kind: "block", blockId: "dup_intro" },
      ],
    };

    expect(countEditorSections(rawDualRead.layout)).toBe(5);

    const display = resolveCmsPageForDisplay(rawDualRead, "nl");
    const overviewCount = countCmsPageEditorSections(rawDualRead);
    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: rawDualRead,
      localDraft: null,
    });

    expect(overviewCount).toBe(2);
    expect(overviewCount).toBe(countEditorSections(display.layout));
    expect(overviewCount).toBe(countCmsPageEditorSections(session.page!));
    expect(overviewCount).toBe(countEditorSections(session.displayPage!.layout));
    expect(session.displayPage!.layout).toHaveLength(2);
  });

  it("does not restore legacy drafts without editorMeta (Producten auto-ensure leftovers)", () => {
    const published = productsPublished();
    const legacy = legacyAdminEnsureCreatesDraftFromLocal(productsLocalSeedStale());
    const envelope = localDraftEnvelopeFromPageDraft(
      "page_products",
      legacy.draft,
      published,
    );
    expect(envelope?.hasEditorMeta).toBe(false);
    expect(shouldRestoreLocalDraft(envelope, published).restore).toBe(false);

    const session = resolveCmsEditorSession({
      pageId: "page_products",
      publishedPage: published,
      localDraft: envelope,
    });
    expect(session.statusLabel).toBe("live");
    expect(session.source).toBe("published");
    expect(countCmsPageEditorSections(session.page!)).toBe(
      countCmsPageEditorSections(published),
    );
  });

  it("overview count === Secties Totaal for products, services, home, about, custom", () => {
    const products = resolveProductsBlocksLayout(productsPublished()).page;
    const services = normalizeCmsPage({
      kind: "builtin",
      isCustom: false,
      id: "page_services",
      pageKey: "services",
      slug: "/services",
      title: "Diensten",
      description: "Diensten",
      inNav: true,
      blocks: [],
      layout: defaultFixedLayout("services"),
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "services.main": defaultSectionContent("services.main"),
        "services.cards": defaultSectionContent("services.cards"),
      } as BuiltinCmsPage["sectionContent"],
      updatedAt: 1,
      version: 1,
    }) as BuiltinCmsPage;
    const home = normalizeCmsPage({
      kind: "builtin",
      isCustom: false,
      id: "page_home",
      pageKey: "home",
      slug: "/",
      title: "Home",
      description: "Home",
      inNav: true,
      blocks: [],
      layout: defaultFixedLayout("home"),
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "home.hero": defaultSectionContent("home.hero"),
        "home.partners": defaultSectionContent("home.partners"),
        "home.stats": defaultSectionContent("home.stats"),
        "home.workGallery": defaultSectionContent("home.workGallery"),
      } as BuiltinCmsPage["sectionContent"],
      updatedAt: 1,
      version: 1,
    }) as BuiltinCmsPage;
    const about = normalizeCmsPage({
      kind: "builtin",
      isCustom: false,
      id: "page_about",
      pageKey: "about",
      slug: "/over-ons",
      title: "Over ons",
      description: "Over ons",
      inNav: true,
      blocks: [],
      layout: defaultFixedLayout("about"),
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "about.main": defaultSectionContent("about.main"),
      } as BuiltinCmsPage["sectionContent"],
      updatedAt: 1,
      version: 1,
    }) as BuiltinCmsPage;
    const custom = normalizeCmsPage({
      kind: "custom",
      isCustom: true,
      id: "page_custom_1",
      slug: "/custom",
      title: "Custom",
      description: "Custom",
      inNav: false,
      blocks: [
        { id: "b1", type: "hero", data: { title: "A" } },
        { id: "b2", type: "cta", data: { title: "B" } },
      ],
      layout: [
        { id: "lay_b1", kind: "block", blockId: "b1" },
        { id: "lay_b2", kind: "block", blockId: "b2" },
      ],
      layoutVersion: CURRENT_LAYOUT_VERSION,
      updatedAt: 1,
      version: 1,
    } as CustomCmsPage) as CustomCmsPage;

    for (const page of [products, services, home, about, custom]) {
      const session = resolveCmsEditorSession({
        pageId: page.id,
        publishedPage: page,
        localDraft: null,
      });
      const overview = countCmsPageEditorSections(session.page!);
      const secties = sectiesTotalFromDisplay(session.page!);
      expect(overview).toBe(secties);
      expect(overview).toBe(countCmsPageEditorSections(session.displayPage!));
      expect(overview).toBe(countEditorSections(session.displayPage!.layout));
      // Raw layout alone can disagree (Producten dual-read); display must win.
      expect(overview).toBe(sectiesTotalFromDisplay(page));
    }

    expect(countCmsPageEditorSections(services)).toBe(2);
    expect(countCmsPageEditorSections(home)).toBe(4);
    expect(countCmsPageEditorSections(about)).toBe(4); // composite parts
    expect(countCmsPageEditorSections(custom)).toBe(2);
    expect(countCmsPageEditorSections(products)).toBe(2);
  });
});
