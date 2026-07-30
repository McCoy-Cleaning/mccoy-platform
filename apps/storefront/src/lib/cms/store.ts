import * as React from "react";
import {
  CMS_SCHEMA_VERSION,
  addLayoutBlock,
  applyDraftToPage,
  createPreviewSnapshot,
  resolvePreviewStatus,
  effectiveOverrides,
  isDraftDirty,
  migrateAndValidate,
  moveLayoutItem,
  normalizeCmsPage,
  removeLayoutBlock,
  syncCustomLayoutFromBlocks,
  toggleFixedSection,
  toggleLayoutItemHidden,
  updateLayoutBlockData,
  validatePublishableCmsPage,
  defaultSiteNavigation,
  effectiveSiteNavigation,
  mergeNavigationPatch,
  parseSiteNavigationResult,
  applyCustomPageNavLink,
  canEnableCustomPageInNav,
  dedupeCustomPageNavLinks,
  removeCustomPageNavLink,
  CUSTOM_NAV_CAP_REASON,
  CMS_SYNC_BROADCAST,
  MAX_EXTRA_CUSTOM_NAV_PAGES,
  isCmsPublishedChromeBroadcast,
  navigationWithResolvedCustomLinks,
  navigationWithoutOrphanInternalLinks,
  purgeLocalCustomPagesNotAllowed,
  type Block,
  type BlockType,
  type BuiltinPageKey,
  type CmsPage,
  type CmsPersistedState,
  type FixedSectionKey,
  type LayoutOperationResult,
  type Page,
  type PageDraft,
  type PageOverrides,
  type PreviewSnapshot,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";

const KEY = "mccoy_cms_v1";
const EVENT = "mccoy-cms-change";

/**
 * B5 — Public storefront must not depend on localStorage for published content.
 * localStorage is only used in authenticated CMS edit/preview bridge mode.
 */
function isCmsEditBridgeMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("_cmsMode") === "edit" || sp.get("_cmsPreview") === "1";
  } catch {
    return false;
  }
}

/** Session-only preview snapshots — never persisted to localStorage. */
const sessionPreviewSnapshots = new Map<string, PreviewSnapshot>();
/** Tracks snapshot version that was last sent to the iframe for stale detection. */
const sessionPreviewVersion = new Map<string, number>();
let previewEpoch = 1;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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

function syncCustomPageIntoNavigation(s: CmsPersistedState, page: CmsPage): void {
  if (!page.isCustom) return;
  const published = s.navigation ?? defaultSiteNavigation();
  s.navigation = applyCustomPageNavLink(published, page);
  if (s.navigationDraft) {
    s.navigationDraft = applyCustomPageNavLink(s.navigationDraft, page);
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
 * Collapse duplicate/orphan custom nav links, drop local custom ghosts, mirror inNav.
 * Idempotent — safe on every edit-bridge localStorage hydrate.
 * Create is forbidden → purge all local custom pages so BEWERKEN nav matches live.
 */
function sanitizeLoadedNavigation(state: CmsPersistedState): {
  state: CmsPersistedState;
  changed: boolean;
} {
  const purged = purgeLocalCustomPagesNotAllowed(state, new Set());
  let working = purged.changed ? ({ ...state, ...purged.state } as CmsPersistedState) : state;

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
    purged.changed ||
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
/** Server-published snapshot for public runtime (B5 / Phase C). */
let publishedServerState: CmsPersistedState | null = null;
/** One-shot purge of ghost custom pages in BEWERKEN localStorage. */
let editBridgePurgeDone = false;
/** Page ids removed via admin chrome sync — must not be resurrected by hydrate pendingCustom. */
const removedPublishedPageIds = new Set<string>();

/**
 * Custom page ids last seen on a successful server hydrate.
 * If a later hydrate omits one of these, treat it as a durable delete — do not keep it
 * as pendingCustom even when chrome sync `removePageIds` was missed.
 */
let lastHydratedServerCustomIds: Set<string> | null = null;

/** Opslaan → file publish race only. Older chrome-only ghosts must not resurrect deleted pages. */
const PENDING_CUSTOM_MAX_AGE_MS = 120_000;

/** True after {@link hydratePublishedCmsState} from the published bundle (not seed). */
let publishedCmsBundleHydrated = false;

/**
 * Hydrate public CMS from the server-published store.
 * Does not write localStorage.
 * Navigation links are resolved from page.inNav so custom pages appear in the navbar.
 * Pending custom pages from an Opslaan chrome sync are kept only briefly (race window).
 * When both server and memory have the same custom page, the newer updatedAt wins for inNav.
 */
export function hydratePublishedCmsState(input: {
  pages: CmsPage[];
  navigation?: SiteNavigationContent;
}): void {
  publishedCmsBundleHydrated = true;
  const serverPages = input.pages.map((p) => normalizeCmsPage(p));
  const current = memoryState ?? publishedServerState;
  const currentById = new Map((current?.pages ?? []).map((p) => [p.id, p] as const));
  const mergedServer = serverPages.map((serverPage) => {
    const local = currentById.get(serverPage.id);
    if (
      local?.isCustom &&
      !local.isDraftOnly &&
      typeof local.updatedAt === "number" &&
      typeof serverPage.updatedAt === "number" &&
      local.updatedAt > serverPage.updatedAt
    ) {
      // Opslaan chrome sync can land before the shared file publish finishes.
      return normalizeCmsPage({
        ...serverPage,
        inNav: local.inNav,
        title: local.title,
        slug: local.slug,
        updatedAt: local.updatedAt,
      });
    }
    return serverPage;
  });
  const serverIds = new Set(mergedServer.map((p) => p.id));
  const serverCustomIds = new Set(
    mergedServer.filter((p) => p.isCustom).map((p) => p.id),
  );
  for (const id of serverIds) removedPublishedPageIds.delete(id);

  // Any custom page previously known on the server but missing now was deleted durably.
  if (lastHydratedServerCustomIds) {
    for (const id of lastHydratedServerCustomIds) {
      if (!serverCustomIds.has(id)) removedPublishedPageIds.add(id);
    }
  }

  const now = Date.now();
  const pendingCustom = (current?.pages ?? []).filter((p) => {
    if (!p.isCustom || p.isDraftOnly || serverIds.has(p.id)) return false;
    if (removedPublishedPageIds.has(p.id)) return false;
    // Durable delete: page was on a prior server snapshot and is gone now.
    if (lastHydratedServerCustomIds?.has(p.id) && !serverCustomIds.has(p.id)) {
      removedPublishedPageIds.add(p.id);
      return false;
    }
    // Chrome-only ghosts (never / no longer on server): drop after short Opslaan race.
    const updatedAt = typeof p.updatedAt === "number" ? p.updatedAt : 0;
    if (now - updatedAt > PENDING_CUSTOM_MAX_AGE_MS) {
      removedPublishedPageIds.add(p.id);
      return false;
    }
    return true;
  });
  const pages = [...mergedServer, ...pendingCustom];
  lastHydratedServerCustomIds = serverCustomIds;
  // Do not reuse in-memory navigation: it keeps deleted custom links and re-backfills
  // them whenever a ghost page is still pending. Durable nav = builtins + server inNav.
  const baseNav = input.navigation ?? defaultSiteNavigation();
  // resolveStorefrontNavLinks drops orphan internal links and backfills inNav pages.
  const next: CmsPersistedState = {
    schemaVersion: CMS_SCHEMA_VERSION,
    pages,
    saved: {},
    draft: {},
    navigation: navigationWithResolvedCustomLinks(baseNav, pages),
    navigationDraft: null,
    previewSnapshots: {},
    version: CMS_SCHEMA_VERSION,
  };
  publishedServerState = next;
  if (!isCmsEditBridgeMode()) {
    memoryState = next;
    cachedSnapshot = null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(EVENT));
    }
  }
}

function mergePublishedPages(
  existing: CmsPage[],
  incoming: CmsPage[] | undefined,
  removePageIds: string[] | undefined,
): CmsPage[] {
  const remove = new Set(removePageIds ?? []);
  for (const id of remove) removedPublishedPageIds.add(id);
  for (const raw of incoming ?? []) {
    removedPublishedPageIds.delete(raw.id);
  }
  const byId = new Map(
    existing.filter((p) => !remove.has(p.id)).map((p) => [p.id, p] as const),
  );
  for (const raw of incoming ?? []) {
    const page = normalizeCmsPage({ ...raw, isDraftOnly: false });
    byId.set(page.id, page);
  }
  return Array.from(byId.values());
}

function applyPublishedChromeToState(
  s: CmsPersistedState,
  input: {
    navigation: SiteNavigationContent;
    pages?: CmsPage[];
    removePageIds?: string[];
  },
): CmsPersistedState {
  // Create is forbidden — never reintroduce custom page stubs from admin chrome sync.
  const incomingPages = (input.pages ?? []).filter((p) => !p.isCustom);
  const pages = mergePublishedPages(s.pages, incomingPages, input.removePageIds);
  const purged = purgeLocalCustomPagesNotAllowed(
    {
      pages,
      draft: s.draft,
      saved: s.saved,
      previewSnapshots: s.previewSnapshots,
      navigation: input.navigation,
      navigationDraft: null,
    },
    new Set(),
  );
  const navigation = navigationWithResolvedCustomLinks(
    purged.state.navigation ?? input.navigation,
    purged.state.pages,
  );
  const next: CmsPersistedState = {
    ...s,
    pages: purged.state.pages,
    navigation,
    navigationDraft: null,
  };
  reconcileCustomInNavFromLinks(next, navigation.links);
  return next;
}

function loadFromDisk(): CmsPersistedState {
  // Public runtime: prefer server published state; never localStorage.
  if (!isCmsEditBridgeMode()) {
    return publishedServerState ?? initial();
  }
  if (typeof window === "undefined") return initial();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return publishedServerState ?? initial();
    const parsed = JSON.parse(raw) as unknown;
    const result = migrateAndValidate(parsed);
    if (!result.ok) {
      console.error("CMS load failed:", result.reason);
      const fallback = publishedServerState ?? initial();
      fallback.corruptPayload = result.corruptPayload;
      return fallback;
    }
    const { state, changed } = sanitizeLoadedNavigation(result.state);
    const ensured = ensureSeedBuiltinPages(state);
    const next = ensured.state;
    if (changed || ensured.changed) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(persistable(next)));
      } catch (e) {
        console.error("CMS nav self-heal persist failed:", e);
      }
    }
    editBridgePurgeDone = true;
    return next;
  } catch (e) {
    console.error("CMS read error:", e);
    return publishedServerState ?? initial();
  }
}

function read(): CmsPersistedState {
  if (typeof window === "undefined") {
    return publishedServerState ?? initial();
  }
  if (!memoryState) memoryState = loadFromDisk();
  // BEWERKEN iframe: force one purge even if memory was warmed before this deploy.
  if (isCmsEditBridgeMode() && !editBridgePurgeDone) {
    editBridgePurgeDone = true;
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
 * Commit state to memory (always).
 * Persist to localStorage only in CMS edit-bridge mode (B5: public never writes localStorage).
 */
function write(state: CmsPersistedState): boolean {
  memoryState = { ...state, navigationDraft: state.navigationDraft ?? null };
  cachedSnapshot = null;
  let persisted = true;
  if (typeof window !== "undefined" && isCmsEditBridgeMode()) {
    persisted = false;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(persistable(memoryState)));
      persisted = true;
    } catch (e) {
      console.error("CMS write failed (localStorage quota?):", e);
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
  return persisted;
}

/** For fire-and-forget mutations that have no Result return path. */
function writeOrAlert(state: CmsPersistedState): boolean {
  const ok = write(state);
  if (!ok) alert(WRITE_FAIL_REASON);
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
  return publishedServerState ?? serverSnapshot;
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
    return { ok: true };
  },
  /** Apply published navigation (+ optional pages) from the admin sync bridge. */
  applyPublishedNavigation(
    navigation: SiteNavigationContent,
  ): { ok: true } | { ok: false; reason: string } {
    return this.applyPublishedChrome({ navigation });
  },
  applyPublishedChrome(input: {
    navigation: SiteNavigationContent;
    pages?: CmsPage[];
    removePageIds?: string[];
  }): { ok: true } | { ok: false; reason: string } {
    const validated = parseSiteNavigationResult(input.navigation);
    if (!validated.ok) return validated;
    const s = read();
    const next = applyPublishedChromeToState(s, {
      navigation: validated.data,
      pages: input.pages,
      removePageIds: input.removePageIds,
    });
    publishedServerState = {
      ...(publishedServerState ?? initial()),
      pages: next.pages,
      navigation: next.navigation,
      navigationDraft: null,
    };
    if (!write(next)) {
      return { ok: false, reason: WRITE_FAIL_REASON };
    }
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
  deletePage(id: string) {
    const s = read();
    const page = s.pages.find((p) => p.id === id);
    if (!page || !page.isCustom) throw new Error("Alleen aangepaste pagina's kunnen verwijderd worden.");
    s.pages = s.pages.filter((p) => p.id !== id);
    delete s.draft[id];
    delete s.saved[id];
    sessionPreviewSnapshots.delete(id);
    markPreviewStale(id);
    const published = s.navigation ?? defaultSiteNavigation();
    s.navigation = removeCustomPageNavLink(published, id);
    if (s.navigationDraft) {
      s.navigationDraft = removeCustomPageNavLink(s.navigationDraft, id);
    }
    writeOrAlert(s);
  },

  /* ============ Layout ops (draft only) ============ */
  moveLayoutItem(pageId: string, itemId: string, direction: "up" | "down") {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, moveLayoutItem(page, itemId, direction));
  },
  addLayoutBlock(pageId: string, type: BlockType, atIndex: number) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    // Dynamic import keeps lucide-backed templates out of the public JS graph.
    // Callers that need sync completion should use the admin CMS store instead.
    void import("./templates").then(({ getTemplate }) => {
      const tpl = getTemplate(type);
      if (!tpl) return;
      const block: Block = { id: uid("b"), type, data: structuredClone(tpl.defaultData) };
      applyLayoutResult(pageId, addLayoutBlock(page, block, atIndex));
    });
    return { ok: true as const };
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
  removeLayoutBlock(pageId: string, blockId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    return applyLayoutResult(pageId, removeLayoutBlock(page, blockId));
  },
  updateLayoutBlock(pageId: string, blockId: string, patch: Record<string, unknown>) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    return applyLayoutResult(pageId, updateLayoutBlockData(page, blockId, patch));
  },

  /**
   * Custom-page block list helpers — draft-gated.
   * @deprecated Prefer layout APIs for builtins; kept for custom page drafts.
   */
  addBlock(pageId: string, type: BlockType, index?: number, _target: "blocks" | "extraBlocks" = "blocks") {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return;
    void import("./templates").then(({ getTemplate }) => {
      const tpl = getTemplate(type);
      if (!tpl) return;
      const block: Block = { id: uid("b"), type, data: structuredClone(tpl.defaultData) };
      if (page.kind === "builtin" && page.pageKey) {
        const at = index ?? page.layout.length;
        applyLayoutResult(pageId, addLayoutBlock(page, block, Math.max(at, 1)));
        return;
      }
      const next = structuredClone(page);
      if (index === undefined || index >= next.blocks.length) next.blocks.push(block);
      else next.blocks.splice(index, 0, block);
      const synced = next.kind === "custom" ? syncCustomLayoutFromBlocks(next) : next;
      synced.updatedAt = Date.now();
      synced.version += 1;
      commitDraftPage(s, pageId, synced);
    });
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
  savePage(pageId: string): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const published = publishedPage(s, pageId);
    if (!published) return { ok: false, reason: "Pagina niet gevonden." };
    const draft = s.draft[pageId];
    const effective = applyDraftToPage(published, draft);
    const validated = validatePublishableCmsPage(effective);
    if (!validated.ok) {
      const msg = validated.issues.map((i) => i.message).join(" ");
      return { ok: false, reason: msg || "Pagina is niet publiceerbaar." };
    }

    if (draft?.overrides) {
      s.saved[pageId] = { ...(s.saved[pageId] || {}), ...draft.overrides };
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
    s.pages = s.pages.map((p) => (p.id === pageId ? nextPage : p));
    delete s.draft[pageId];
    sessionPreviewSnapshots.delete(pageId);
    markPreviewStale(pageId);
    if (nextPage.isCustom) {
      syncCustomPageIntoNavigation(s, nextPage);
    }
    if (!write(s)) return { ok: false, reason: WRITE_FAIL_REASON };
    return { ok: true };
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

let publishedChromeBroadcastInstalled = false;

/** Listen for admin → storefront chrome pushes (iframe sync or same-origin broadcast). */
export function ensurePublishedChromeBroadcastListener(): void {
  if (typeof window === "undefined" || publishedChromeBroadcastInstalled) return;
  if (typeof BroadcastChannel === "undefined") return;
  publishedChromeBroadcastInstalled = true;
  try {
    const bc = new BroadcastChannel(CMS_SYNC_BROADCAST);
    bc.onmessage = (event: MessageEvent) => {
      if (!isCmsPublishedChromeBroadcast(event.data)) return;
      const result = cms.applyPublishedChrome({
        navigation: event.data.navigation,
        pages: event.data.pages,
        removePageIds: event.data.removePageIds,
      });
      if (!result.ok) {
        console.warn("CMS published chrome broadcast rejected:", result.reason);
      }
    };
  } catch {
    publishedChromeBroadcastInstalled = false;
  }
}

if (typeof window !== "undefined") {
  // Broadcast listener is started from PublishedCmsProvider (client effect) —
  // do not attach at module evaluate time on every public page load.
}

export function useCms(): CmsPersistedState {
  const subscribe = React.useCallback((cb: () => void) => {
    const onLocal = () => {
      cachedSnapshot = null;
      cb();
    };
    const onStorage = () => {
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

/** Whether the public store has received a real published bundle (not SEED_PAGES). */
export function isPublishedCmsBundleHydrated(): boolean {
  return publishedCmsBundleHydrated;
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
  void state.version;
  void state.navigation;
  // Public chrome uses published navigation only (drafts stay in the admin editor).
  // Resolve still runs in Navbar; publish path is already sanitized on hydrate/chrome sync.
  return cms.getPublishedNavigation();
}
