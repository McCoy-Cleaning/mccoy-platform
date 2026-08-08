/**
 * Stage 6 — CMS store persistence slice.
 * Owns localStorage KEY/EVENT, seed builtins, load/read/write, and session preview maps.
 */
import {
  CMS_SCHEMA_VERSION,
  defaultSiteFooter,
  defaultSiteNavigation,
  migrateAndValidate,
  normalizeCmsPage,
  applyCustomPageNavLink,
  navigationWithResolvedCustomLinks,
  toNavChromePageStub,
  type BuiltinPageKey,
  type CmsPage,
  type CmsPersistedState,
  type Page,
  type PreviewSnapshot,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";
import { pushPublishedChromeToStorefront } from "./publish-sync";

export const KEY = "mccoy_cms_v1";
export const EVENT = "mccoy-cms-change";

/** Session-only preview snapshots — never persisted to localStorage. */
export const sessionPreviewSnapshots = new Map<string, PreviewSnapshot>();
/** Tracks snapshot version that was last sent to the iframe for stale detection. */
export const sessionPreviewVersion = new Map<string, number>();
export let previewEpoch = 1;

export function bumpPreviewEpoch(): number {
  previewEpoch += 1;
  return previewEpoch;
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
export function syncCustomPageIntoNavigation(
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
export function reconcileCustomInNavFromLinks(
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
export function sanitizeLoadedNavigation(state: CmsPersistedState): {
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
    footer: working.footer ?? defaultSiteFooter(),
    footerDraft: working.footerDraft ?? null,
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

export function initial(): CmsPersistedState {
  return {
    schemaVersion: CMS_SCHEMA_VERSION,
    pages: SEED_PAGES,
    saved: {},
    draft: {},
    navigation: defaultSiteNavigation(),
    navigationDraft: null,
    footer: defaultSiteFooter(),
    footerDraft: null,
    previewSnapshots: {},
    version: CMS_SCHEMA_VERSION,
  };
}

/** In-memory source of truth for the current tab — survives localStorage quota failures. */
let memoryState: CmsPersistedState | null = null;
/** Ensures open tabs self-heal after deploy without requiring a full storage clear. */
let localCustomPurgeDone = false;
let cachedSnapshot: CmsPersistedState | null = null;

export function persistable(state: CmsPersistedState): CmsPersistedState {
  return {
    schemaVersion: state.schemaVersion,
    pages: state.pages,
    saved: state.saved,
    draft: state.draft,
    navigation: state.navigation,
    navigationDraft: state.navigationDraft ?? null,
    footer: state.footer ?? defaultSiteFooter(),
    footerDraft: state.footerDraft ?? null,
    previewSnapshots: {},
    version: state.version,
    migrationRecovery: state.migrationRecovery,
  };
}

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

export function read(): CmsPersistedState {
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

export const WRITE_FAIL_REASON =
  "Kon niet opslaan — mogelijk te veel afbeeldingen. Verwijder wat en probeer opnieuw.";

/**
 * Commit state to memory (always) and localStorage (best-effort).
 * Always notifies subscribers so drafts enable Opslaan even when persist fails.
 * Returns false only when localStorage persist failed — callers must not claim durable success.
 */
export function write(state: CmsPersistedState): boolean {
  // Shallow clone so useSyncExternalStore always sees a new snapshot identity,
  // even when callers mutate the object returned by read() in place.
  memoryState = {
    ...state,
    navigationDraft: state.navigationDraft ?? null,
    footer: state.footer ?? defaultSiteFooter(),
    footerDraft: state.footerDraft ?? null,
  };
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
export function writeOrAlert(state: CmsPersistedState): boolean {
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

export function markPreviewStale(pageId: string) {
  sessionPreviewVersion.delete(pageId);
}

export function getSnapshot(): CmsPersistedState {
  if (cachedSnapshot === null) cachedSnapshot = read();
  return cachedSnapshot;
}

const serverSnapshot = initial();
export function getServerSnapshot(): CmsPersistedState {
  return serverSnapshot;
}

export function invalidateSnapshotCache(): void {
  cachedSnapshot = null;
}

export function clearMemoryState(): void {
  memoryState = null;
}

export function clearSessionPreviews(): void {
  sessionPreviewSnapshots.clear();
  sessionPreviewVersion.clear();
}
