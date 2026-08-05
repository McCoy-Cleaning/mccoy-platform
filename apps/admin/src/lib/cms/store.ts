import * as React from "react";
import { formatValidateIssuesNl } from "./validation-messages.nl";
import {
  CMS_SCHEMA_VERSION,
  addLayoutBlock,
  applyDraftToPage,
  createPreviewSnapshot,
  effectiveOverrides,
  isDraftDirty,
  migrateAndValidate,
  minInsertIndex,
  moveLayoutItem,
  normalizeCmsPage,
  removeLayoutBlock,
  removeFixedLayoutItem,
  addFixedLayoutItem,
  setLayoutItemContentAlign,
  duplicateLayoutBlock,
  mergeSectionPatch,
  getSectionContent,
  SECTION_CONTENT_SCHEMAS,
  syncCustomLayoutFromBlocks,
  toggleFixedSection,
  toggleLayoutItemHidden,
  updateLayoutBlockData,
  validatePublishableCmsPage,
  createDefaultBlock,
  parseBlockData,
  resolveProductsBlocksLayout,
  forceProductsIntroAssortmentPair,
  cloneJobsDataWithNewIds,
  normalizeJobs,
  createItemId,
  resolvePreviewStatus,
  defaultSiteNavigation,
  effectiveSiteNavigation,
  mergeNavigationPatch,
  parseSiteNavigationResult,
  applyCustomPageNavLink,
  canEnableCustomPageInNav,
  dedupeCustomPageNavLinks,
  navigationWithResolvedCustomLinks,
  navigationWithoutOrphanInternalLinks,
  purgeLocalCustomPagesNotAllowed,
  removeCustomPageNavLink,
  toNavChromePageStub,
  CUSTOM_NAV_CAP_REASON,
  MAX_EXTRA_CUSTOM_NAV_PAGES,
  applyTranslatedEnFields,
  collectPageNlFieldDraftMap,
  collectPageNlFieldDraftCollection,
  chunkRecordByBudget,
  ensureEnglishLocaleContentFromDrafts,
  filterNonEmptyTranslateFields,
  planEnFieldDraftSync,
  remapEnFieldDraftsToCanonicalPaths,
  scanTranslationCoverage,
  selectTranslateMissingFromPage,
  enPublishBlockedByCoverage,
  applyEnFieldDraftEditorPatch,
  createTranslationSourceHash,
  decideOpslaanPublishedLocales,
  opslaanSuccessToastTitle,
  type Block,
  type BlockType,
  type BuiltinPageKey,
  type CmsPage,
  type CmsPersistedState,
  type ContentAlign,
  type FixedSectionKey,
  type LayoutOperationResult,
  type Page,
  type PageDraft,
  type PageOverrides,
  type PageSectionContent,
  type PreviewSnapshot,
  type SiteNavigationContent,
  type TranslationFieldMetadata,
} from "@mccoy/cms-schema";
import { pushPublishedChromeToStorefront } from "./publish-sync";
import { deleteSavedPageFromServer, publishSavedPageToServer, saveConceptPageToServer } from "./server-publish";
import {
  adminGetCmsPageStatus,
  adminGetPublishedCmsPages,
  adminListPublishedCustomPageIds,
} from "@/lib/api/cms-publish.functions";
import { translateNlToEn } from "@/lib/api/content-ai.functions";
import { getTemplate, getTemplateById } from "./templates";

const KEY = "mccoy_cms_v1";
const EVENT = "mccoy-cms-change";

/** Session-only preview snapshots — never persisted to localStorage. */
const sessionPreviewSnapshots = new Map<string, PreviewSnapshot>();
/** Tracks snapshot version that was last sent to the iframe for stale detection. */
const sessionPreviewVersion = new Map<string, number>();
let previewEpoch = 1;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Regenerate `id` fields on nested arrays when duplicating a section. */
function regenerateNestedIds(data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(next)) {
    if (!Array.isArray(value)) continue;
    next[key] = value.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const row = { ...(entry as Record<string, unknown>) };
      if (typeof row.id === "string") row.id = createItemId("item");
      return row;
    });
  }
  return next;
}

function emptyBuiltin(input: {
  id: string;
  slug: string;
  title: string;
  description: string;
  inNav: boolean;
  pageKey: BuiltinPageKey | null;
  updatedAt?: number;
}): Page {
  return normalizeCmsPage({
    kind: "builtin",
    isCustom: false,
    pageKey: input.pageKey,
    id: input.id,
    slug: input.slug,
    title: input.title,
    description: input.description,
    inNav: input.inNav,
    blocks: [],
    layout: [],
    layoutVersion: 0,
    sectionContent: {},
    updatedAt: input.updatedAt ?? Date.now(),
    version: 1,
  });
}

/** Keep published (+ draft) navigation links in sync with a custom page’s inNav flag. */
function syncCustomPageIntoNavigation(
  s: CmsPersistedState,
  page: CmsPage,
  opts?: { push?: boolean },
): void {
  if (!page.isCustom) return;
  const published = s.navigation ?? defaultSiteNavigation();
  s.navigation = applyCustomPageNavLink(published, page);
  if (s.navigationDraft) {
    s.navigationDraft = applyCustomPageNavLink(s.navigationDraft, page);
  }
  if (opts?.push) {
    pushPublishedChromeToStorefront({
      navigation: s.navigation,
      pages: [toNavChromePageStub(page)],
    });
  }
}

/** Mirror navigation.links → custom page.inNav (and draft mirrors). */
function reconcileCustomInNavFromLinks(
  s: CmsPersistedState,
  links: SiteNavigationContent["links"],
): void {
  const customIds = new Set(s.pages.filter((p) => p.isCustom).map((p) => p.id));
  const linkedCustom = new Set(
    links
      .filter((l) => l.link.type === "internal" && customIds.has(l.link.pageId))
      .map((l) => (l.link.type === "internal" ? l.link.pageId : "")),
  );
  s.pages = s.pages.map((p) => {
    if (!p.isCustom) return p;
    const inNav = linkedCustom.has(p.id);
    if (p.inNav === inNav) return p;
    return { ...p, inNav, updatedAt: Date.now() };
  });
  for (const [pid, d] of Object.entries(s.draft)) {
    if (d.page?.isCustom) {
      d.page = { ...d.page, inNav: linkedCustom.has(pid) };
    }
    if (d.inNav !== undefined) {
      d.inNav = linkedCustom.has(pid);
    }
  }
}

/**
 * Collapse duplicate/orphan custom nav links and mirror inNav.
 * Idempotent — safe to run on every localStorage hydrate.
 * Custom-page allowlisting/purge happens only in reconcileLocalCustomPagesWithServer
 * (needs the durable store allowlist — empty allowlist here wiped seeded customs).
 */
function sanitizeLoadedNavigation(state: CmsPersistedState): {
  state: CmsPersistedState;
  changed: boolean;
} {
  const working = state;

  const published = working.navigation ?? defaultSiteNavigation();
  const navigation = navigationWithResolvedCustomLinks(published, working.pages);
  const navigationDraft = working.navigationDraft
    ? navigationWithResolvedCustomLinks(working.navigationDraft, working.pages)
    : null;
  const next: CmsPersistedState = {
    ...working,
    navigation,
    navigationDraft,
  };
  reconcileCustomInNavFromLinks(next, navigation.links);
  const changed =
    JSON.stringify(published.links) !== JSON.stringify(navigation.links) ||
    JSON.stringify(working.navigationDraft?.links ?? null) !==
      JSON.stringify(navigationDraft?.links ?? null) ||
    JSON.stringify(working.pages.map((p) => [p.id, p.inNav])) !==
      JSON.stringify(next.pages.map((p) => [p.id, p.inNav]));
  return { state: next, changed };
}

function pagesForNavCap(s: CmsPersistedState): CmsPage[] {
  return s.pages.map((p) => editablePage(s, p.id) ?? p);
}

const SEED_PAGES: Page[] = [
  emptyBuiltin({
    id: "page_home",
    slug: "/",
    title: "Home",
    description: "McCoy Cleaning — professioneel schoonmaakbedrijf in Twente.",
    inNav: true,
    pageKey: "home",
  }),
  emptyBuiltin({
    id: "page_about",
    slug: "/about",
    title: "Over ons",
    description: "Over McCoy Cleaning — ons verhaal, team en waarden.",
    inNav: true,
    pageKey: "about",
  }),
  emptyBuiltin({
    id: "page_services",
    slug: "/services",
    title: "Diensten",
    description: "Ons volledige aanbod aan schoonmaakdiensten.",
    inNav: true,
    pageKey: "services",
  }),
  emptyBuiltin({
    id: "page_products",
    slug: "/products",
    title: "Producten",
    description: "McCoy Products — hygiënepapier, zepen en meer.",
    inNav: true,
    pageKey: "products",
  }),
  emptyBuiltin({
    id: "page_contact",
    slug: "/contact",
    title: "Contact",
    description: "Neem contact op met McCoy Cleaning.",
    inNav: true,
    pageKey: "contact",
  }),
  emptyBuiltin({
    id: "page_vacatures",
    slug: "/vacatures",
    title: "Vacatures",
    description: "Werken bij McCoy Cleaning.",
    inNav: true,
    pageKey: "vacatures",
  }),
  emptyBuiltin({
    id: "page_offerte",
    slug: "/offerte",
    title: "Offerte",
    description: "Vraag een offerte aan bij McCoy Cleaning.",
    inNav: true,
    pageKey: "offerte",
  }),
  emptyBuiltin({
    id: "page_privacy",
    slug: "/privacy",
    title: "Privacyverklaring",
    description: "Privacyverklaring van McCoy Cleaning B.V.",
    inNav: false,
    pageKey: "privacy",
  }),
  emptyBuiltin({
    id: "page_terms",
    slug: "/terms",
    title: "Algemene voorwaarden",
    description: "Algemene voorwaarden van McCoy Schoonmaak en Reiniging.",
    inNav: false,
    pageKey: "terms",
  }),
];

/** Insert any newly seeded builtins that older localStorage snapshots lack. */
function ensureSeedBuiltinPages(state: CmsPersistedState): { state: CmsPersistedState; changed: boolean } {
  const ids = new Set(state.pages.map((p) => p.id));
  const missing = SEED_PAGES.filter((p) => !ids.has(p.id));
  if (missing.length === 0) return { state, changed: false };
  return { state: { ...state, pages: [...state.pages, ...missing] }, changed: true };
}

function initial(): CmsPersistedState {
  return {
    schemaVersion: CMS_SCHEMA_VERSION,
    pages: SEED_PAGES,
    saved: {},
    draft: {},
    navigation: defaultSiteNavigation(),
    navigationDraft: null,
    previewSnapshots: {},
    version: CMS_SCHEMA_VERSION,
  };
}

/** In-memory source of truth for the current tab — survives localStorage quota failures. */
let memoryState: CmsPersistedState | null = null;
/** Ensures open tabs self-heal after deploy without requiring a full storage clear. */
let localCustomPurgeDone = false;

function loadFromDisk(): CmsPersistedState {
  if (typeof window === "undefined") return initial();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      // Persist the seeded builtin catalogue immediately, not just in memory.
      // Otherwise any other same-tab code that does a naive
      // read-modify-write on this key before the CMS store's own state is
      // first mutated (e.g. E2E fixture setup) sees `raw === null`, assumes
      // an empty store, and clobbers the builtin pages entirely.
      const seeded = initial();
      try {
        window.localStorage.setItem(KEY, JSON.stringify(persistable(seeded)));
      } catch (e) {
        console.error("CMS initial seed persist failed:", e);
      }
      return seeded;
    }
    const parsed = JSON.parse(raw) as unknown;
    const result = migrateAndValidate(parsed);
    if (!result.ok) {
      console.error("CMS load failed:", result.reason);
      const fallback = initial();
      fallback.corruptPayload = result.corruptPayload;
      return fallback;
    }
    const { state, changed } = sanitizeLoadedNavigation(result.state);
    const ensured = ensureSeedBuiltinPages(state);
    const next = ensured.state;
    const shouldPersist = changed || ensured.changed;
    // Self-heal polluted navigation.links (e.g. triple Referenties) without asking
    // the operator to clear localStorage.
    if (shouldPersist) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(persistable(next)));
      } catch (e) {
        console.error("CMS nav self-heal persist failed:", e);
      }
    }
    localCustomPurgeDone = true;
    return next;
  } catch (e) {
    console.error("CMS read error:", e);
    return initial();
  }
}

function read(): CmsPersistedState {
  if (typeof window === "undefined") return initial();
  if (!memoryState) memoryState = loadFromDisk();
  if (!localCustomPurgeDone) {
    localCustomPurgeDone = true;
    const { state, changed } = sanitizeLoadedNavigation(memoryState);
    if (changed) {
      memoryState = state;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(persistable(state)));
      } catch (e) {
        console.error("CMS nav self-heal persist failed:", e);
      }
      window.dispatchEvent(new Event(EVENT));
    }
  }
  return memoryState;
}

function persistable(state: CmsPersistedState): CmsPersistedState {
  return {
    schemaVersion: state.schemaVersion,
    pages: state.pages,
    saved: state.saved,
    draft: state.draft,
    navigation: state.navigation,
    navigationDraft: state.navigationDraft ?? null,
    previewSnapshots: {},
    version: state.version,
    migrationRecovery: state.migrationRecovery,
  };
}

const WRITE_FAIL_REASON =
  "Kon niet opslaan — mogelijk te veel afbeeldingen. Verwijder wat en probeer opnieuw.";

/**
 * Commit state to memory (always) and localStorage (best-effort).
 * Always notifies subscribers so drafts enable Opslaan even when persist fails.
 * Returns false only when localStorage persist failed — callers must not claim durable success.
 */
function write(state: CmsPersistedState): boolean {
  // Shallow clone so useSyncExternalStore always sees a new snapshot identity,
  // even when callers mutate the object returned by read() in place.
  memoryState = { ...state, navigationDraft: state.navigationDraft ?? null };
  cachedSnapshot = null;
  let persisted = false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(persistable(memoryState)));
    persisted = true;
  } catch (e) {
    console.error("CMS write failed (localStorage quota?):", e);
  }
  window.dispatchEvent(new Event(EVENT));
  return persisted;
}

/** For fire-and-forget mutations that have no Result return path. */
function writeOrAlert(state: CmsPersistedState): boolean {
  const ok = write(state);
  if (!ok) {
    void import("@/lib/notify-toast").then(({ notifyToast }) => {
      notifyToast({
        kind: "error",
        title: "Opslaan mislukt",
        description: WRITE_FAIL_REASON,
        dedupeKey: "cms-write-fail",
      });
    });
  }
  return ok;
}

function markPreviewStale(pageId: string) {
  sessionPreviewVersion.delete(pageId);
}

let cachedSnapshot: CmsPersistedState | null = null;
function getSnapshot(): CmsPersistedState {
  if (cachedSnapshot === null) cachedSnapshot = read();
  return cachedSnapshot;
}
const serverSnapshot = initial();
function getServerSnapshot(): CmsPersistedState {
  return serverSnapshot;
}

function getOrInitDraft(s: CmsPersistedState, pageId: string): PageDraft {
  if (!s.draft[pageId]) s.draft[pageId] = { overrides: {} };
  if (!s.draft[pageId].overrides) s.draft[pageId].overrides = {};
  return s.draft[pageId];
}

function publishedPage(s: CmsPersistedState, pageId: string): CmsPage | undefined {
  return s.pages.find((p) => p.id === pageId);
}

function editablePage(s: CmsPersistedState, pageId: string): CmsPage | undefined {
  const page = publishedPage(s, pageId);
  if (!page) return undefined;
  return applyDraftToPage(page, s.draft[pageId]);
}

function commitDraftPage(s: CmsPersistedState, pageId: string, nextPage: CmsPage) {
  const prev = s.draft[pageId] ?? { overrides: {} };
  // New draft object reference so React effects (edit-bridge bump) re-run.
  s.draft = {
    ...s.draft,
    [pageId]: {
      ...prev,
      overrides: { ...(prev.overrides ?? {}) },
      page: structuredClone(nextPage),
    },
  };
  markPreviewStale(pageId);
  writeOrAlert({ ...s, draft: s.draft });
}

function applyLayoutResult(pageId: string, result: LayoutOperationResult): LayoutOperationResult {
  if (!result.ok) return result;
  const s = read();
  if (!publishedPage(s, pageId)) return { ok: false, code: "UNKNOWN_SECTION" };
  commitDraftPage(s, pageId, result.page);
  return result;
}

export type PagePreviewStatus = "locked" | "outdated" | "up_to_date";

export const cms = {
  getState: read,
  getPage(id: string) {
    return read().pages.find((p) => p.id === id);
  },
  /** Published page with draft layout/meta applied — use in editors. */
  getEditablePage(id: string) {
    return editablePage(read(), id);
  },
  getNavigation(): SiteNavigationContent {
    const s = read();
    return effectiveSiteNavigation(s.navigation, s.navigationDraft);
  },
  getPublishedNavigation(): SiteNavigationContent {
    return structuredClone(read().navigation ?? defaultSiteNavigation());
  },
  hasNavigationDraft() {
    const s = read();
    return s.navigationDraft != null;
  },
  patchNavigation(
    patch: Partial<{ [K in keyof SiteNavigationContent]: SiteNavigationContent[K] | null }>,
  ): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const current = effectiveSiteNavigation(s.navigation, s.navigationDraft);
    const merged = mergeNavigationPatch(current, patch);
    const validated = parseSiteNavigationResult(merged);
    if (!validated.ok) return validated;
    // Clone so memory/React get a new reference (in-place mutate would skip re-render).
    // write() always updates memory + notifies; persist failure is reported on Opslaan.
    write({ ...s, navigationDraft: validated.data });
    return { ok: true };
  },
  setNavigationDraft(next: SiteNavigationContent): { ok: true } | { ok: false; reason: string } {
    const validated = parseSiteNavigationResult(next);
    if (!validated.ok) return validated;
    const s = read();
    write({ ...s, navigationDraft: validated.data });
    return { ok: true };
  },
  saveNavigation(): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const draft = s.navigationDraft;
    if (!draft) return { ok: false, reason: "Geen navigatieconcept om op te slaan." };
    const validated = parseSiteNavigationResult(draft);
    if (!validated.ok) return validated;

    // Collapse accidental duplicate custom-page links before publish.
    const navToSave = {
      ...validated.data,
      links: dedupeCustomPageNavLinks(validated.data.links, s.pages),
    };

    const customIds = new Set(s.pages.filter((p) => p.isCustom).map((p) => p.id));
    const customLinkCount = navToSave.links.filter(
      (l) => l.link.type === "internal" && customIds.has(l.link.pageId),
    ).length;
    const publishedCustomCount = (s.navigation ?? defaultSiteNavigation()).links.filter(
      (l) => l.link.type === "internal" && customIds.has(l.link.pageId),
    ).length;
    if (customLinkCount > MAX_EXTRA_CUSTOM_NAV_PAGES && customLinkCount > publishedCustomCount) {
      return { ok: false, reason: CUSTOM_NAV_CAP_REASON };
    }

    reconcileCustomInNavFromLinks(s, navToSave.links);
    if (!write({ ...s, navigation: navToSave, navigationDraft: null })) {
      return { ok: false, reason: WRITE_FAIL_REASON };
    }
    const customPages = s.pages
      .filter((p) => p.isCustom && !p.isDraftOnly)
      .map((p) => toNavChromePageStub(p));
    pushPublishedChromeToStorefront({
      navigation: navToSave,
      pages: customPages,
    });
    return { ok: true };
  },
  discardNavigationDraft() {
    const s = read();
    writeOrAlert({ ...s, navigationDraft: null });
  },
  updatePage(id: string, patch: Partial<CmsPage>): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const current = editablePage(s, id);
    if (!current) return { ok: false, reason: "Pagina niet gevonden." };
    const next = { ...current, ...patch, updatedAt: Date.now(), version: (current.version ?? 1) + 1 } as CmsPage;
    if (next.isCustom && next.inNav && !current.inNav) {
      const forCap = pagesForNavCap(s).map((p) => (p.id === id ? { ...p, inNav: false } : p));
      const check = canEnableCustomPageInNav(forCap, id);
      if (!check.ok) return check;
    }
    commitDraftPage(s, id, next);
    return { ok: true };
  },
  /** UI helper: whether “Toon in navigatie” can be enabled for this page. */
  canEnableInNav(pageId: string): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const forCap = pagesForNavCap(s);
    const page = forCap.find((p) => p.id === pageId);
    if (!page) return { ok: false, reason: "Pagina niet gevonden." };
    if (page.inNav) return { ok: true };
    return canEnableCustomPageInNav(
      forCap.map((p) => (p.id === pageId ? { ...p, inNav: false } : p)),
      pageId,
    );
  },
  getCustomInNavCount(): number {
    return pagesForNavCap(read()).filter((p) => p.isCustom && p.inNav).length;
  },
  getMaxExtraCustomNavPages(): number {
    return MAX_EXTRA_CUSTOM_NAV_PAGES;
  },
  /**
   * Drop local custom pages (and their nav links) that no longer exist in the durable store.
   * Also hydrates builtin page layout/sectionContent from the published store when the
   * local editor has no dirty draft — so Secties shows live text/images.
   * Fixes ghosts like Referenties after a Supabase/table delete that skipped admin deletePage.
   */
  async reconcileLocalCustomPagesWithServer(): Promise<{
    ok: true;
    removedIds: string[];
  } | { ok: false; reason: string }> {
    const listed = await adminListPublishedCustomPageIds();
    if (!listed.ok || !("customPageIds" in listed)) {
      // Server/auth unavailable: keep local customs. Deleting them here made seeded
      // custom pages disappear whenever the list endpoint failed on first paint.
      return { ok: true, removedIds: [] };
    }
    const allowed = new Set(listed.customPageIds);
    const state = read();
    const purged = purgeLocalCustomPagesNotAllowed(state, allowed);
    let next = purged.changed
      ? ({ ...state, ...purged.state } as CmsPersistedState)
      : state;

    // Hydrate published payloads into local pages that have no dirty draft.
    // Also import remote custom pages that are not yet in localStorage (e.g. E2E seed).
    let pagesTouched = false;
    const published = await adminGetPublishedCmsPages();
    if (published.ok && "pagesJson" in published && typeof published.pagesJson === "string") {
      let remotePages: CmsPage[] = [];
      try {
        remotePages = JSON.parse(published.pagesJson) as CmsPage[];
      } catch {
        remotePages = [];
      }
      const byId = new Map<string, CmsPage>();
      for (const raw of remotePages) {
        try {
          const page = normalizeCmsPage(raw);
          byId.set(page.id, page);
        } catch {
          /* skip corrupt remote payload */
        }
      }
      const localIds = new Set(next.pages.map((p) => p.id));
      const importedCustoms = [...byId.values()].filter(
        (remote) => remote.isCustom && !localIds.has(remote.id) && allowed.has(remote.id),
      );
      const nextDraft = { ...next.draft };
      const mergedPages = [
        ...next.pages.map((local) => {
          const remote = byId.get(local.id);
          if (!remote) return local;
          const localFresh =
            typeof local.updatedAt === "number" ? local.updatedAt : 0;
          const remoteFresh =
            typeof remote.updatedAt === "number" ? remote.updatedAt : 0;
          const dirty = isDraftDirty(nextDraft[local.id]);

          // Newer published server copy always wins (multi-admin last write).
          if (remoteFresh > localFresh) {
            if (dirty) delete nextDraft[local.id];
            pagesTouched = true;
            return remote;
          }
          // Keep local unsaved work when timestamps are equal or local is newer.
          if (dirty) return local;
          if (remote !== local) {
            pagesTouched = true;
            return remote;
          }
          return local;
        }),
        ...importedCustoms,
      ];
      if (importedCustoms.length > 0) pagesTouched = true;
      next = {
        ...next,
        pages: mergedPages,
        draft: nextDraft,
      };
    }

    const { state: sanitized, changed: navChanged } = sanitizeLoadedNavigation(next);
    if (!purged.changed && !navChanged && !pagesTouched && sanitized === state) {
      return { ok: true, removedIds: [] };
    }
    if (!write(sanitized)) {
      return { ok: false, reason: WRITE_FAIL_REASON };
    }
    if (purged.changed) {
      pushPublishedChromeToStorefront({
        navigation: sanitized.navigation ?? defaultSiteNavigation(),
        removePageIds: purged.removedIds,
      });
    }
    return { ok: true, removedIds: purged.removedIds };
  },
  deletePage(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const s = read();
    const page = s.pages.find((p) => p.id === id);
    if (!page || !page.isCustom) {
      return Promise.resolve({
        ok: false,
        reason: "Alleen aangepaste pagina's kunnen verwijderd worden.",
      });
    }

    const run = async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
      // Durable store first — otherwise storefront hydrate backfills nav via inNav.
      const server = await deleteSavedPageFromServer(id);
      if (!server.ok) {
        return {
          ok: false,
          reason:
            server.error ||
            "Pagina kon niet volledig worden verwijderd van de live site. Probeer opnieuw.",
        };
      }

      const state = read();
      const stillThere = state.pages.find((p) => p.id === id);
      if (!stillThere || !stillThere.isCustom) {
        // Another tab may have removed it; still push chrome cleanup.
        const published = state.navigation ?? defaultSiteNavigation();
        const navigation = navigationWithoutOrphanInternalLinks(
          removeCustomPageNavLink(published, id),
          state.pages,
        );
        const navigationDraft = state.navigationDraft
          ? navigationWithoutOrphanInternalLinks(
              removeCustomPageNavLink(state.navigationDraft, id),
              state.pages,
            )
          : state.navigationDraft;
        if (!write({ ...state, navigation, navigationDraft: navigationDraft ?? null })) {
          return { ok: false, reason: WRITE_FAIL_REASON };
        }
        pushPublishedChromeToStorefront({ navigation, removePageIds: [id] });
        return { ok: true };
      }

      state.pages = state.pages.filter((p) => p.id !== id);
      delete state.draft[id];
      delete state.saved[id];
      if (state.previewSnapshots) delete state.previewSnapshots[id];
      sessionPreviewSnapshots.delete(id);
      markPreviewStale(id);
      const published = state.navigation ?? defaultSiteNavigation();
      state.navigation = navigationWithoutOrphanInternalLinks(
        removeCustomPageNavLink(published, id),
        state.pages,
      );
      if (state.navigationDraft) {
        state.navigationDraft = navigationWithoutOrphanInternalLinks(
          removeCustomPageNavLink(state.navigationDraft, id),
          state.pages,
        );
      }
      if (!write(state)) {
        return {
          ok: false,
          reason:
            "Pagina is van de live site verwijderd, maar lokaal opslaan mislukte. Vernieuw de pagina.",
        };
      }
      // Push cleaned navigation + removePageIds so storefront memory drops the link
      // even before the next durable hydrate. Durable truth is the server page delete above.
      pushPublishedChromeToStorefront({
        navigation: state.navigation,
        removePageIds: [id],
      });
      return { ok: true };
    };

    return run();
  },

  /**
   * Producten fixed→blocks: resolve once and persist draft when changed.
   * Storefront must never call this (admin is the persistence authority).
   */
  ensureProductsBlocksMigration(pageId: string): {
    changed: boolean;
    report: ReturnType<typeof resolveProductsBlocksLayout>["report"] | null;
  } {
    const page = editablePage(read(), pageId);
    if (!page || page.kind !== "builtin" || page.pageKey !== "products") {
      return { changed: false, report: null };
    }
    const summarize = (p: typeof page) =>
      p.layout.map((item) => {
        if (item.kind === "fixed") return `fixed:${item.key}`;
        const block = p.blocks.find((b) => b.id === item.blockId);
        const data =
          block?.data && typeof block.data === "object"
            ? (block.data as Record<string, unknown>)
            : {};
        return `${block?.type ?? "missing"}:${String(data.presentation ?? "none")}`;
      });
    const resolved = resolveProductsBlocksLayout(page);
    // Nuclear guarantee: resolve alone was observed returning unchanged layouts while
    // claiming restore. Force exact Intro + Assortiment pair for non-empty Producten.
    const forced = forceProductsIntroAssortmentPair(resolved.page);
    const nextPage = forced.page;
    const beforePresentations = summarize(page);
    const afterPresentations = summarize(nextPage);
    const beforeHasIntro = beforePresentations.some((p) => p.includes(":productsIntro"));
    const beforeHasAssortment = beforePresentations.some((p) =>
      p.includes(":productsAssortment"),
    );
    const afterHasIntro = afterPresentations.some((p) => p.includes(":productsIntro"));
    const afterHasAssortment = afterPresentations.some((p) =>
      p.includes(":productsAssortment"),
    );
    const pairComplete = afterHasIntro && afterHasAssortment;
    const pairWasIncomplete = !(beforeHasIntro && beforeHasAssortment);
    const willPersist =
      forced.changed ||
      (resolved.changed &&
        JSON.stringify({
          layout: page.layout,
          blocks: page.blocks,
          migration: page.productsBlocksMigration ?? null,
        }) !==
          JSON.stringify({
            layout: nextPage.layout,
            blocks: nextPage.blocks,
            migration: nextPage.productsBlocksMigration ?? null,
          })) ||
      (pairWasIncomplete && pairComplete);
    if (!willPersist) {
      return {
        changed: false,
        report: {
          ...resolved.report,
          warnings: [...resolved.report.warnings, ...forced.warnings],
        },
      };
    }
    commitDraftPage(read(), pageId, nextPage);
    return {
      changed: true,
      report: {
        ...resolved.report,
        warnings: [...resolved.report.warnings, ...forced.warnings],
      },
    };
  },

  /* ============ Layout ops (draft only) ============ */
  moveLayoutItem(pageId: string, itemId: string, direction: "up" | "down") {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, moveLayoutItem(page, itemId, direction));
  },
  addLayoutBlock(
    pageId: string,
    type: BlockType,
    atIndex: number,
    opts?: { templateId?: string },
  ) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    const tpl = opts?.templateId ? getTemplateById(opts.templateId) : getTemplate(type);
    if (!tpl || tpl.type !== type) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    const block = createDefaultBlock(type);
    const parsed = parseBlockData(type, tpl.defaultData);
    if (parsed.ok) {
      block.data = parsed.data as Block["data"];
      block.dataVersion = parsed.dataVersion;
    }
    block.id = uid("b");
    return applyLayoutResult(pageId, addLayoutBlock(page, block, atIndex));
  },
  toggleFixedSection(pageId: string, fixedKey: FixedSectionKey) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, toggleFixedSection(page, fixedKey));
  },
  toggleLayoutItemHidden(pageId: string, layoutItemId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, toggleLayoutItemHidden(page, layoutItemId));
  },
  removeFixedLayoutItem(pageId: string, fixedKey: FixedSectionKey) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, removeFixedLayoutItem(page, fixedKey));
  },
  addFixedLayoutItem(pageId: string, fixedKey: FixedSectionKey, atIndex?: number) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, addFixedLayoutItem(page, fixedKey, atIndex));
  },
  setLayoutItemContentAlign(pageId: string, layoutItemId: string, align: ContentAlign) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, setLayoutItemContentAlign(page, layoutItemId, align));
  },
  removeLayoutBlock(pageId: string, blockId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    const result = removeLayoutBlock(page, blockId);
    if (!result.ok) return applyLayoutResult(pageId, result);
    // Drop EN drafts for the removed block so they cannot resurrect on publish.
    const next = structuredClone(result.page);
    const prefix = `block:${blockId}:`;
    if (next.enFieldDrafts) {
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(next.enFieldDrafts)) {
        if (!key.startsWith(prefix)) cleaned[key] = value;
      }
      next.enFieldDrafts = cleaned;
    }
    if (next.enFieldDraftSources) {
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(next.enFieldDraftSources)) {
        if (!key.startsWith(prefix)) cleaned[key] = value;
      }
      next.enFieldDraftSources = cleaned;
    }
    if (next.enFieldDraftMeta) {
      const cleaned: NonNullable<CmsPage["enFieldDraftMeta"]> = {};
      for (const [key, value] of Object.entries(next.enFieldDraftMeta)) {
        if (!key.startsWith(prefix)) cleaned[key] = value;
      }
      next.enFieldDraftMeta = Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    return applyLayoutResult(pageId, { ok: true, page: next });
  },
  duplicateLayoutBlock(pageId: string, blockId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    return applyLayoutResult(
      pageId,
      duplicateLayoutBlock(page, blockId, (source) => {
        const newId = uid("b");
        let data = structuredClone(source.data);
        if (source.type === "jobs") {
          data = cloneJobsDataWithNewIds(normalizeJobs(data)) as unknown as Record<string, unknown>;
        } else {
          // Regenerate common nested `id` fields on array items.
          data = regenerateNestedIds(data);
        }
        return {
          ...source,
          id: newId,
          data,
        };
      }),
    );
  },
  updateLayoutBlock(pageId: string, blockId: string, patch: Record<string, unknown>) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    return applyLayoutResult(pageId, updateLayoutBlockData(page, blockId, patch));
  },

  /** Phase E MVP — set/merge English field drafts (does not publish). */
  setEnFieldDrafts(pageId: string, patch: Record<string, string>) {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return;
    const next = structuredClone(page);
    const { fields: nlNow, aliases } = collectPageNlFieldDraftCollection(next);
    const patched = applyEnFieldDraftEditorPatch({
      drafts: next.enFieldDrafts,
      sources: next.enFieldDraftSources,
      meta: next.enFieldDraftMeta,
      patch,
      nlFields: nlNow,
      aliases,
    });
    next.enFieldDrafts = patched.enFieldDrafts;
    next.enFieldDraftSources = patched.enFieldDraftSources;
    next.enFieldDraftMeta =
      Object.keys(patched.enFieldDraftMeta).length > 0 ? patched.enFieldDraftMeta : undefined;
    next.updatedAt = Date.now();
    next.version += 1;
    // Editing EN drafts must not unpublish a live EN locale — publication and
    // freshness are separate. Mark published EN as stale until Opslaan republishes.
    const merged = patched.enFieldDrafts;
    if (Object.keys(merged).length > 0 || Object.keys(patch).length > 0) {
      const prevEn = next.localeStates?.en;
      const keepPublication =
        prevEn?.publicationState && prevEn.publicationState !== "missing"
          ? prevEn.publicationState
          : ("draft" as const);
      next.localeStates = {
        ...(next.localeStates ?? { nl: { publicationState: "published", freshness: "current" } }),
        nl: next.localeStates?.nl ?? { publicationState: "published", freshness: "current" },
        en: {
          publicationState: keepPublication,
          freshness: keepPublication === "published" ? "stale" : (prevEn?.freshness ?? "unknown"),
        },
      };
    }
    commitDraftPage(s, pageId, next);
  },

  /**
   * Translate only missing/blank EN fields (never overwrites manual or intentional_blank).
   * Persists into enFieldDrafts as drafts — does not publish.
   */
  async translateMissingEnFields(
    pageId: string,
    includeStates: Array<"missing" | "blank" | "stale" | "override_removed"> = [
      "missing",
      "blank",
      "override_removed",
    ],
  ): Promise<
    | { ok: true; translated: number; skipped: number; warning?: string }
    | { ok: false; reason: string }
  > {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return { ok: false, reason: "Pagina niet gevonden." };

    const remapped = remapEnFieldDraftsToCanonicalPaths(page);
    const working: CmsPage = {
      ...page,
      enFieldDrafts: remapped.enFieldDrafts,
      enFieldDraftSources: remapped.enFieldDraftSources,
      enFieldDraftMeta: remapped.enFieldDraftMeta ?? page.enFieldDraftMeta,
    };

    const selected = selectTranslateMissingFromPage(working, includeStates);
    if (selected.length === 0) {
      return { ok: true, translated: 0, skipped: 0 };
    }

    const toTranslate: Record<string, string> = {};
    for (const field of selected) toTranslate[field.path] = field.sourceValue;

    const translated: Record<string, string> = {};
    let warning: string | undefined;
    for (const chunk of chunkRecordByBudget(toTranslate, { maxItems: 8, maxChars: 3500 })) {
      const fields = filterNonEmptyTranslateFields(chunk);
      if (Object.keys(fields).length === 0) continue;
      try {
        const res = await translateNlToEn({
          data: { fields, maxCharsPerField: 2000 },
        });
        if (!res.ok) {
          warning = res.error;
          continue;
        }
        Object.assign(translated, res.result.fields);
      } catch (error) {
        warning = error instanceof Error ? error.message : "Onbekende fout";
      }
    }

    const next = structuredClone(working);
    const drafts = { ...(next.enFieldDrafts ?? {}) };
    const sources = { ...(next.enFieldDraftSources ?? {}) };
    const meta: Record<string, TranslationFieldMetadata> = {
      ...(next.enFieldDraftMeta ?? {}),
    };
    let applied = 0;
    for (const field of selected) {
      // Never overwrite intentional_blank / manually_translated.
      // override_removed may be refilled by an explicit “vertaal ontbrekende”.
      const existingMeta = meta[field.path]?.status;
      if (existingMeta === "intentional_blank" || existingMeta === "manually_translated") {
        continue;
      }
      const en = translated[field.path]?.trim();
      if (!en || en === field.sourceValue.trim()) continue;
      drafts[field.path] = en;
      sources[field.path] = field.sourceValue;
      meta[field.path] = {
        status: "machine_translated",
        sourceHash: createTranslationSourceHash(field.sourceValue),
        translatedAt: new Date().toISOString(),
        provider: "groq",
      };
      applied += 1;
    }
    next.enFieldDrafts = drafts;
    next.enFieldDraftSources = sources;
    next.enFieldDraftMeta = meta;
    next.updatedAt = Date.now();
    next.version += 1;
    commitDraftPage(s, pageId, next);
    return {
      ok: true,
      translated: applied,
      skipped: selected.length - applied,
      warning,
    };
  },

  /** Field-level EN coverage for the editable page (editor UI). */
  getTranslationCoverage(pageId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return null;
    const remapped = remapEnFieldDraftsToCanonicalPaths(page);
    return scanTranslationCoverage({
      page: {
        ...page,
        enFieldDrafts: remapped.enFieldDrafts,
        enFieldDraftSources: remapped.enFieldDraftSources,
        enFieldDraftMeta: remapped.enFieldDraftMeta ?? page.enFieldDraftMeta,
      },
    });
  },

  /**
   * Custom-page block list helpers — draft-gated.
   * @deprecated Prefer layout APIs for builtins; kept for custom PageEditor.
   */
  addBlock(
    pageId: string,
    type: BlockType,
    index?: number,
    _target: "blocks" | "extraBlocks" = "blocks",
    opts?: { templateId?: string },
  ) {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return;
    const tpl = opts?.templateId ? getTemplateById(opts.templateId) : getTemplate(type);
    if (!tpl || tpl.type !== type) return;
    const block = createDefaultBlock(type);
    const parsed = parseBlockData(type, tpl.defaultData);
    if (parsed.ok) {
      block.data = parsed.data as Block["data"];
      block.dataVersion = parsed.dataVersion;
    }
    block.id = uid("b");
    if (page.kind === "builtin" && page.pageKey) {
      const at = index ?? page.layout.length;
      const min = minInsertIndex(page.pageKey);
      applyLayoutResult(pageId, addLayoutBlock(page, block, Math.max(at, min)));
      return;
    }
    const next = structuredClone(page);
    if (index === undefined || index >= next.blocks.length) next.blocks.push(block);
    else next.blocks.splice(index, 0, block);
    const synced = next.kind === "custom" ? syncCustomLayoutFromBlocks(next) : next;
    synced.updatedAt = Date.now();
    synced.version += 1;
    commitDraftPage(s, pageId, synced);
  },
  updateBlock(pageId: string, blockId: string, patch: Record<string, unknown>, _target: "blocks" | "extraBlocks" = "blocks") {
    const page = editablePage(read(), pageId);
    if (!page) return;
    applyLayoutResult(pageId, updateLayoutBlockData(page, blockId, patch));
  },
  deleteBlock(pageId: string, blockId: string, _target: "blocks" | "extraBlocks" = "blocks") {
    const page = editablePage(read(), pageId);
    if (!page) return;
    if (page.kind === "custom") {
      const next = structuredClone(page);
      next.blocks = next.blocks.filter((b) => b.id !== blockId);
      commitDraftPage(read(), pageId, syncCustomLayoutFromBlocks(next));
      return;
    }
    applyLayoutResult(pageId, removeLayoutBlock(page, blockId));
  },
  moveBlock(pageId: string, blockId: string, dir: -1 | 1, _target: "blocks" | "extraBlocks" = "blocks") {
    const page = editablePage(read(), pageId);
    if (!page) return;
    const item = page.layout.find((i) => i.kind === "block" && i.blockId === blockId);
    if (!item) {
      // Custom pages may still reorder via blocks array
      if (page.kind === "custom") {
        const idx = page.blocks.findIndex((b) => b.id === blockId);
        const nextIdx = idx + dir;
        if (idx < 0 || nextIdx < 0 || nextIdx >= page.blocks.length) return;
        const next = structuredClone(page);
        const arr = next.blocks.slice();
        [arr[idx], arr[nextIdx]] = [arr[nextIdx]!, arr[idx]!];
        next.blocks = arr;
        commitDraftPage(read(), pageId, syncCustomLayoutFromBlocks(next));
      }
      return;
    }
    applyLayoutResult(pageId, moveLayoutItem(page, item.id, dir === -1 ? "up" : "down"));
  },
  reset() {
    sessionPreviewSnapshots.clear();
    sessionPreviewVersion.clear();
    memoryState = null;
    writeOrAlert(initial());
  },

  /* ============ Overrides (draft / saved) ============ */
  getDraft(pageId: string): PageOverrides {
    const s = read();
    return effectiveOverrides(s.saved[pageId], s.draft[pageId]);
  },
  getSaved(pageId: string): PageOverrides {
    return { ...(read().saved[pageId] || {}) };
  },
  getPageDraft(pageId: string): PageDraft | undefined {
    return read().draft[pageId];
  },
  /**
   * Patch typed fixed-section content on the editor draft.
   * Parent is source of truth — iframe must not invent section documents.
   */
  patchSectionContent(
    pageId: string,
    sectionKey: FixedSectionKey,
    patch: Record<string, unknown>,
  ): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page || page.kind !== "builtin") {
      return { ok: false, reason: "Alleen vaste pagina's ondersteunen sectie-inhoud." };
    }
    const current = getSectionContent(page, sectionKey) as Record<string, unknown>;
    const merged = mergeSectionPatch(current, patch);
    const parsed = SECTION_CONTENT_SCHEMAS[sectionKey].safeParse(merged);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
      return { ok: false, reason: `Ongeldige inhoud voor ${sectionKey}${path}.` };
    }
    const validated = parsed.data;
    const next = structuredClone(page);
    next.sectionContent = {
      ...(next.sectionContent ?? {}),
      [sectionKey]: validated,
    } as PageSectionContent;
    next.updatedAt = Date.now();
    next.version += 1;
    commitDraftPage(s, pageId, next);

    // Structured sectionContent is now source of truth — drop flat legacy keys so
    // they cannot shadow future reads via migrateLegacyHeroOverrides.
    if (sectionKey === "home.hero") {
      const draft = s.draft[pageId];
      if (draft?.overrides) {
        for (const key of [
          "hero.kicker",
          "hero.title",
          "hero.titleAccent",
          "hero.sub",
          "hero.image",
          "hero.ctaSecondary",
        ] as const) {
          delete draft.overrides[key];
        }
      }
      if (s.saved[pageId]) {
        for (const key of [
          "hero.kicker",
          "hero.title",
          "hero.titleAccent",
          "hero.sub",
          "hero.image",
          "hero.ctaSecondary",
        ] as const) {
          delete s.saved[pageId]![key];
        }
      }
      if (!write(s)) return { ok: false, reason: WRITE_FAIL_REASON };
    }
    return { ok: true };
  },
  setDraft(pageId: string, key: string, value: string) {
    const s = read();
    const d = getOrInitDraft(s, pageId);
    d.overrides[key] = value;
    markPreviewStale(pageId);
    writeOrAlert(s);
  },
  hasDraft(pageId: string) {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (page?.isDraftOnly) return true;
    return isDraftDirty(s.draft[pageId]);
  },
  /**
   * Soft-draft persist: durable concept on the server without publishing.
   * Keeps the local draft so the editor still shows "Concept — nog niet live".
   */
  async saveConcept(
    pageId: string,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const s = read();
    const published = publishedPage(s, pageId);
    if (!published) return { ok: false, reason: "Pagina niet gevonden." };
    const draft = s.draft[pageId];
    if (!draft && !published.isDraftOnly) {
      return { ok: false, reason: "Geen conceptwijzigingen om op te slaan." };
    }
    const effective = normalizeCmsPage(applyDraftToPage(published, draft));
    const saved = await saveConceptPageToServer(effective);
    if (!saved.ok) {
      return {
        ok: false,
        reason:
          saved.error ||
          "Concept opslaan mislukte. Lokale wijzigingen blijven behouden — probeer opnieuw.",
      };
    }
    return { ok: true };
  },
  async savePage(
    pageId: string,
  ): Promise<
    | { ok: true; warning?: string; message?: string; publishedLocales?: Array<"nl" | "en"> }
    | { ok: false; reason: string }
  > {
    const s = read();
    const published = publishedPage(s, pageId);
    if (!published) return { ok: false, reason: "Pagina niet gevonden." };
    const draft = s.draft[pageId];
    const effective = applyDraftToPage(published, draft);
    const validated = validatePublishableCmsPage(effective);
    if (!validated.ok) {
      const msg = formatValidateIssuesNl(validated.issues).join(" ");
      return { ok: false, reason: msg || "Pagina is niet publiceerbaar." };
    }

    const nextPage = structuredClone(validated.page);
    nextPage.updatedAt = Date.now();
    nextPage.version = (published.version ?? 1) + 1;
    if (nextPage.isDraftOnly) {
      nextPage.isDraftOnly = false;
    }
    if (nextPage.isCustom && nextPage.inNav) {
      const forCap = pagesForNavCap(s).map((p) =>
        p.id === pageId ? { ...nextPage, inNav: false, isDraftOnly: false } : p,
      );
      const check = canEnableCustomPageInNav(forCap, pageId);
      if (!check.ok) {
        return { ok: false, reason: check.reason };
      }
    }

    // Canonicalize legacy index/colon draft keys onto stable-id discovery paths.
    const remapped = remapEnFieldDraftsToCanonicalPaths(nextPage);
    nextPage.enFieldDrafts = remapped.enFieldDrafts;
    nextPage.enFieldDraftSources = remapped.enFieldDraftSources;
    if (remapped.enFieldDraftMeta) {
      nextPage.enFieldDraftMeta = remapped.enFieldDraftMeta;
    }

    // Auto-sync EN drafts: missing/blank/source_echo/empty override_removed → Groq.
    // Valid distinct EN and intentional_blank / manually_translated are retained.
    const baselineNlFields = collectPageNlFieldDraftMap(published);
    const nlFields = collectPageNlFieldDraftMap(nextPage);
    const plan = planEnFieldDraftSync({
      nlFields,
      existingDrafts: nextPage.enFieldDrafts,
      existingSources: nextPage.enFieldDraftSources,
      existingMeta: nextPage.enFieldDraftMeta,
      baselineNlFields,
      baselineEnDrafts: published.enFieldDrafts,
    });

    const translated: Record<string, string> = {};
    let translateWarning: string | undefined;
    const toTranslate = filterNonEmptyTranslateFields(plan.toTranslate);
    if (Object.keys(toTranslate).length > 0) {
      // Budget-aware chunks reduce Groq json_validate_failed from truncated JSON.
      for (const chunk of chunkRecordByBudget(toTranslate, { maxItems: 8, maxChars: 3500 })) {
        const fields = filterNonEmptyTranslateFields(chunk);
        if (Object.keys(fields).length === 0) continue;
        try {
          const res = await translateNlToEn({
            data: { fields, maxCharsPerField: 2000 },
          });
          if (!res.ok) {
            // Keep successful prior chunks; continue so later fields may still translate.
            translateWarning = res.error;
            continue;
          }
          Object.assign(translated, res.result.fields);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Onbekende fout";
          translateWarning = message;
          continue;
        }
      }
    }

    const synced = applyTranslatedEnFields({
      retainedDrafts: plan.retainedDrafts,
      retainedSources: plan.retainedSources,
      toTranslate,
      translated,
    });
    nextPage.enFieldDrafts = synced.enFieldDrafts;
    nextPage.enFieldDraftSources = synced.enFieldDraftSources;

    // Mark successfully auto-filled paths as machine_translated (durable meta).
    const appliedPaths = Object.keys(toTranslate).filter((p) => synced.enFieldDrafts[p]?.trim());
    if (appliedPaths.length > 0) {
      const meta = { ...(nextPage.enFieldDraftMeta ?? {}) };
      for (const path of appliedPaths) {
        const nl = toTranslate[path] ?? "";
        meta[path] = {
          status: "machine_translated",
          sourceHash: createTranslationSourceHash(nl),
          translatedAt: new Date().toISOString(),
          provider: "groq",
        };
      }
      nextPage.enFieldDraftMeta = meta;
    }
    const rejectedAsDutch = Object.keys(toTranslate).filter((p) => {
      const en = translated[p]?.trim();
      return en && !synced.enFieldDrafts[p]?.trim();
    }).length;
    const missingAfterApply = Object.keys(toTranslate).filter(
      (p) => !synced.enFieldDrafts[p]?.trim(),
    ).length;
    if (Object.keys(toTranslate).length > 0 && missingAfterApply > 0 && !translateWarning) {
      translateWarning =
        rejectedAsDutch > 0
          ? `AI gaf ${rejectedAsDutch} veld(en) terug die gelijk bleven aan NL (afgewezen).`
          : `${missingAfterApply} veld(en) niet vertaald.`;
    }

    // Keep localeContent.en SEO bag available whenever EN drafts exist (publish gate).
    const hasEnDraftKeys = Object.keys(synced.enFieldDrafts).length > 0;
    if (hasEnDraftKeys || nextPage.localeContent?.en) {
      Object.assign(nextPage, ensureEnglishLocaleContentFromDrafts(nextPage));
    }

    // Durable publish first — never clear the local draft until the live store accepts it.
    // Include EN when already live (republish overlays) OR when EN drafts exist so first
    // go-live happens on Opslaan without a separate Publiceer EN click.
    let serverEnPublished = false;
    try {
      const status = await adminGetCmsPageStatus({ data: { pageId } });
      if (status.ok) {
        serverEnPublished = status.localeStates?.en?.publicationState === "published";
      }
    } catch {
      /* local-only / offline — fall back to editor state */
    }
    const localEnPublished = nextPage.localeStates?.en?.publicationState === "published";
    const publishedLocales = decideOpslaanPublishedLocales({
      localEnPublished,
      serverEnPublished,
      hasEnDraftKeys,
    });
    const shouldPublishEn = publishedLocales.includes("en");
    if (shouldPublishEn) {
      Object.assign(nextPage, ensureEnglishLocaleContentFromDrafts(nextPage));
      nextPage.localeStates = {
        ...(nextPage.localeStates ?? {
          nl: { publicationState: "published", freshness: "current" },
        }),
        nl: nextPage.localeStates?.nl ?? {
          publicationState: "published",
          freshness: "current",
        },
        en: { publicationState: "published", freshness: "current" },
      };
    }
    const pub = await publishSavedPageToServer(nextPage, publishedLocales);
    if (!pub.ok) {
      return {
        ok: false,
        reason:
          pub.error ||
          "Publicatie naar de live site mislukte. Concept behouden — probeer opnieuw.",
      };
    }

    if (draft?.overrides) {
      s.saved[pageId] = { ...(s.saved[pageId] || {}), ...draft.overrides };
    }
    s.pages = s.pages.map((p) => (p.id === pageId ? nextPage : p));
    delete s.draft[pageId];
    sessionPreviewSnapshots.delete(pageId);
    markPreviewStale(pageId);
    if (nextPage.isCustom) {
      syncCustomPageIntoNavigation(s, nextPage, { push: true });
    } else {
      // Builtin publish: push full page into open storefront tabs so live content
      // updates without waiting for a hard refresh / snapshot TTL.
      pushPublishedChromeToStorefront({
        navigation: s.navigation ?? defaultSiteNavigation(),
        pages: [nextPage],
      });
    }
    if (!write(s)) return { ok: false, reason: WRITE_FAIL_REASON };
    const successMessage = opslaanSuccessToastTitle(publishedLocales);
    if (translateWarning) {
      const missing = Object.keys(toTranslate).filter((k) => !translated[k]?.trim()).length;
      return {
        ok: true,
        publishedLocales,
        message: successMessage,
        warning:
          missing > 0
            ? `Opgeslagen. Automatische EN-vertaling mislukte (${translateWarning}). Vul ontbrekende EN-velden handmatig in — bestaande handmatige EN blijft behouden.`
            : undefined,
      };
    }
    return { ok: true, publishedLocales, message: successMessage };
  },
  discardDraft(pageId: string) {
    const s = read();
    delete s.draft[pageId];
    sessionPreviewSnapshots.delete(pageId);
    markPreviewStale(pageId);
    const page = s.pages.find((p) => p.id === pageId);
    if (page?.isDraftOnly) {
      s.pages = s.pages.filter((p) => p.id !== pageId);
    }
    writeOrAlert(s);
  },

  /* ============ Preview snapshot (session + postMessage) ============ */
  capturePreviewSnapshot(pageId: string): PreviewSnapshot | null {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return null;
    const draft = s.draft[pageId];
    const effectivePage = applyDraftToPage(page, draft);
    const overrides = effectiveOverrides(s.saved[pageId], draft);
    previewEpoch += 1;
    const snap = createPreviewSnapshot(pageId, effectivePage, overrides, previewEpoch);
    sessionPreviewSnapshots.set(pageId, snap);
    sessionPreviewVersion.set(pageId, snap.version);
    window.dispatchEvent(new Event(EVENT));
    return snap;
  },
  getSessionPreviewSnapshot(pageId: string): PreviewSnapshot | null {
    return sessionPreviewSnapshots.get(pageId) ?? null;
  },
  clearPreviewSnapshot(pageId: string) {
    sessionPreviewSnapshots.delete(pageId);
    markPreviewStale(pageId);
    window.dispatchEvent(new Event(EVENT));
  },
  getPreviewStatus(pageId: string): PagePreviewStatus {
    return resolvePreviewStatus(
      sessionPreviewSnapshots.get(pageId) ?? null,
      sessionPreviewVersion.get(pageId),
    ) as PagePreviewStatus;
  },
};

export function useCms(): CmsPersistedState {
  const subscribe = React.useCallback((cb: () => void) => {
    const onLocal = () => {
      cachedSnapshot = null;
      cb();
    };
    const onStorage = () => {
      // Another tab changed disk — drop memory so we reload.
      cachedSnapshot = null;
      memoryState = null;
      cb();
    };
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function usePreviewStatus(pageId: string): PagePreviewStatus {
  const state = useCms();
  void state.version;
  void state.draft[pageId];
  return cms.getPreviewStatus(pageId);
}

export function useEditablePage(pageId: string): CmsPage | undefined {
  const state = useCms();
  void state.version;
  void state.draft[pageId];
  return cms.getEditablePage(pageId);
}

export function useSiteNavigation(): SiteNavigationContent {
  const state = useCms();
  return effectiveSiteNavigation(state.navigation, state.navigationDraft ?? null);
}
