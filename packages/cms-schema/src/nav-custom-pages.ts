import type { CmsPage } from "./types";
import { BUILTIN_ROUTE_PATHS } from "./links";
import type { SiteNavigationContent, SiteNavLink } from "./navigation";

/**
 * @deprecated Creating custom CMS pages is disabled. Kept for any legacy callers;
 * prefer {@link CMS_PAGE_CREATE_FORBIDDEN_REASON} / {@link canCreateCustomPage}.
 */
export const MAX_CUSTOM_PAGES = 0;

/** Server + client: creating new CMS pages (builtin or custom) is not allowed. */
export const CMS_PAGE_CREATE_FORBIDDEN_REASON =
  "Nieuwe pagina's aanmaken is niet toegestaan. Bewerk alleen bestaande pagina's.";

/** @deprecated Use {@link CMS_PAGE_CREATE_FORBIDDEN_REASON}. */
export const CUSTOM_PAGES_CAP_REASON = CMS_PAGE_CREATE_FORBIDDEN_REASON;

/** Extra custom pages allowed in the main navbar beyond the built-in set. */
export const MAX_EXTRA_CUSTOM_NAV_PAGES = 3;

export const CUSTOM_NAV_CAP_REASON =
  `Je kunt maximaal ${MAX_EXTRA_CUSTOM_NAV_PAGES} extra pagina's in de navigatie tonen.`;

/**
 * Creating custom pages is permanently disabled.
 * Existing custom pages remain editable; only new creation is rejected.
 */
export function canCreateCustomPage(
  _existingCustomCount?: number,
): { ok: false; reason: string } {
  return { ok: false, reason: CMS_PAGE_CREATE_FORBIDDEN_REASON };
}

/** True when a local custom page looks like the deleted Referenties ghost (any pageId). */
export function isReferentiesNavGhost(
  page: Pick<CmsPage, "title" | "slug"> | null | undefined,
): boolean {
  if (!page) return false;
  const slug = normalizeNavPath(page.slug)?.toLowerCase() ?? "";
  const title = (page.title || "").trim().toLowerCase();
  return (
    slug === "/referenties" ||
    slug === "/references" ||
    slug.includes("referent") ||
    title === "referenties" ||
    title === "references" ||
    title.includes("referent")
  );
}

/**
 * Remove local custom pages that are not in `allowedCustomIds`.
 * Pass an empty set to drop every local custom page (create is forbidden; durable store has none).
 * Also strips matching nav links, drafts, and referenties-labeled leftovers.
 */
export function purgeLocalCustomPagesNotAllowed<
  TPage extends Pick<CmsPage, "id" | "title" | "slug" | "inNav" | "isCustom">,
>(
  state: {
    pages: TPage[];
    draft: Record<string, { page?: TPage; inNav?: boolean } | undefined>;
    saved: Record<string, unknown>;
    previewSnapshots?: Record<string, unknown>;
    navigation?: SiteNavigationContent;
    navigationDraft?: SiteNavigationContent | null;
  },
  allowedCustomIds: ReadonlySet<string>,
): {
  state: typeof state;
  removedIds: string[];
  changed: boolean;
} {
  const toRemove = new Set(
    state.pages.filter((p) => p.isCustom && !allowedCustomIds.has(p.id)).map((p) => p.id),
  );
  // Always kill Referenties-named ghosts even if somehow allowlisted under a stale id.
  for (const p of state.pages) {
    if (p.isCustom && isReferentiesNavGhost(p)) toRemove.add(p.id);
  }

  let navigation = state.navigation;
  let navigationDraft = state.navigationDraft ?? null;
  let pages = state.pages;
  let changed = false;

  if (toRemove.size > 0) {
    changed = true;
    pages = state.pages.filter((p) => !toRemove.has(p.id));
    for (const id of toRemove) {
      delete state.draft[id];
      delete state.saved[id];
      if (state.previewSnapshots) delete state.previewSnapshots[id];
      if (navigation) navigation = removeCustomPageNavLink(navigation, id);
      if (navigationDraft) navigationDraft = removeCustomPageNavLink(navigationDraft, id);
    }
  }

  const pagesForFilter = pages;
  if (navigation) {
    const cleaned = navigationWithoutOrphanInternalLinks(navigation, pagesForFilter);
    const withoutGhostLabels = {
      ...cleaned,
      links: cleaned.links.filter((l) => !isReferentiesNavGhost({ title: l.label, slug: "" })),
    };
    if (JSON.stringify(withoutGhostLabels.links) !== JSON.stringify(navigation.links)) {
      navigation = withoutGhostLabels;
      changed = true;
    }
  }
  if (navigationDraft) {
    const cleaned = navigationWithoutOrphanInternalLinks(navigationDraft, pagesForFilter);
    const withoutGhostLabels = {
      ...cleaned,
      links: cleaned.links.filter((l) => !isReferentiesNavGhost({ title: l.label, slug: "" })),
    };
    if (JSON.stringify(withoutGhostLabels.links) !== JSON.stringify(navigationDraft.links)) {
      navigationDraft = withoutGhostLabels;
      changed = true;
    }
  }

  return {
    state: {
      ...state,
      pages,
      navigation,
      navigationDraft,
    },
    removedIds: [...toRemove],
    changed,
  };
}

export function customPageNavLinkId(pageId: string): string {
  return `custom_${pageId}`;
}

export function isInternalCustomPageLink(
  link: SiteNavLink["link"],
  pageId?: string,
): link is { type: "internal"; pageId: string; openInNewTab?: boolean } {
  if (link.type !== "internal") return false;
  if (pageId !== undefined) return link.pageId === pageId;
  return true;
}

export function findCustomPageNavLinkIndex(links: SiteNavLink[], pageId: string): number {
  return links.findIndex(
    (l) => l.id === customPageNavLinkId(pageId) || isInternalCustomPageLink(l.link, pageId),
  );
}

export function countExtraCustomNavLinks(
  links: SiteNavLink[],
  customPageIds: ReadonlySet<string>,
): number {
  return links.filter(
    (l) => isInternalCustomPageLink(l.link) && customPageIds.has(l.link.pageId),
  ).length;
}

type NavPageRef = Pick<CmsPage, "id" | "title" | "inNav" | "isCustom" | "isDraftOnly"> & {
  /** Used to collapse duplicate custom nav entries that share a path. */
  slug?: string;
};

/** Normalize a CMS slug/path for nav destination comparisons. */
export function normalizeNavPath(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash === "/") return "/";
  return withSlash.replace(/\/+$/, "") || "/";
}

function navLinkDestinationPath(
  link: SiteNavLink,
  slugById: ReadonlyMap<string, string>,
): string | null {
  if (link.link.type === "internal_route") {
    return normalizeNavPath(BUILTIN_ROUTE_PATHS[link.link.route]);
  }
  if (isInternalCustomPageLink(link.link)) {
    return slugById.get(link.link.pageId) ?? null;
  }
  if (link.link.type === "external") {
    return link.link.url.trim() || null;
  }
  return null;
}

/** Count custom pages currently marked in-nav (optionally excluding one page). */
export function countExtraCustomInNavPages(
  pages: readonly NavPageRef[],
  excludePageId?: string,
): number {
  return pages.filter(
    (p) => p.isCustom && p.inNav && (!excludePageId || p.id !== excludePageId),
  ).length;
}

/**
 * Whether enabling in-nav for this custom page is allowed.
 * Pages already in nav may stay; over-cap existing sets are left intact but cannot grow.
 */
export function canEnableCustomPageInNav(
  pages: readonly NavPageRef[],
  pageId: string,
): { ok: true } | { ok: false; reason: string } {
  const page = pages.find((p) => p.id === pageId);
  if (!page?.isCustom) return { ok: true };
  if (page.inNav) return { ok: true };
  if (countExtraCustomInNavPages(pages, pageId) >= MAX_EXTRA_CUSTOM_NAV_PAGES) {
    return { ok: false, reason: CUSTOM_NAV_CAP_REASON };
  }
  return { ok: true };
}

/**
 * Keep at most one internal nav link per custom pageId (first wins).
 * When `pages` is provided, also collapse distinct pageIds that resolve to the
 * same slug/path (stale localStorage ghosts from repeated create/delete cycles).
 */
export function dedupeCustomPageNavLinks(
  links: readonly SiteNavLink[],
  pages?: readonly { id: string; slug?: string }[],
): SiteNavLink[] {
  const slugById = new Map<string, string>();
  for (const p of pages ?? []) {
    const path = normalizeNavPath(p.slug);
    if (path) slugById.set(p.id, path);
  }
  const seenPageIds = new Set<string>();
  const seenPaths = new Set<string>();
  const out: SiteNavLink[] = [];
  for (const link of links) {
    if (isInternalCustomPageLink(link.link)) {
      if (seenPageIds.has(link.link.pageId)) continue;
      const path = slugById.get(link.link.pageId) ?? null;
      if (path && seenPaths.has(path)) continue;
      seenPageIds.add(link.link.pageId);
      if (path) seenPaths.add(path);
    } else {
      const path = navLinkDestinationPath(link, slugById);
      if (path && seenPaths.has(path)) continue;
      if (path) seenPaths.add(path);
    }
    out.push(link);
  }
  return out;
}

/** Add, update label, or remove the navigation link for a custom page based on `inNav`. */
export function applyCustomPageNavLink(
  navigation: SiteNavigationContent,
  page: NavPageRef,
): SiteNavigationContent {
  if (!page.isCustom) return navigation;

  const links = dedupeCustomPageNavLinks([...navigation.links]);
  const idx = findCustomPageNavLinkIndex(links, page.id);

  if (!page.inNav) {
    if (idx >= 0) links.splice(idx, 1);
    return { ...navigation, links };
  }

  const nextLink: SiteNavLink = {
    id: customPageNavLinkId(page.id),
    label: page.title,
    link: { type: "internal", pageId: page.id },
  };

  if (idx >= 0) links[idx] = nextLink;
  else links.push(nextLink);

  return { ...navigation, links };
}

export function removeCustomPageNavLink(
  navigation: SiteNavigationContent,
  pageId: string,
): SiteNavigationContent {
  const links = navigation.links.filter(
    (l) => l.id !== customPageNavLinkId(pageId) && !isInternalCustomPageLink(l.link, pageId),
  );
  if (links.length === navigation.links.length) return navigation;
  return { ...navigation, links };
}

/**
 * Drop internal nav links whose `pageId` is not present in the current page list.
 * Built-in `internal_route` / external links are kept. Prevents deleted custom pages
 * from lingering in admin localStorage or storefront memory after chrome sync races.
 */
export function filterOrphanInternalNavLinks(
  links: readonly SiteNavLink[],
  pages: readonly NavPageRef[],
): SiteNavLink[] {
  const pageIds = new Set(pages.map((p) => p.id));
  return links.filter((l) => {
    if (!isInternalCustomPageLink(l.link)) return true;
    return pageIds.has(l.link.pageId);
  });
}

/** Remove orphan internal page links from a full navigation object. */
export function navigationWithoutOrphanInternalLinks(
  navigation: SiteNavigationContent,
  pages: readonly NavPageRef[],
): SiteNavigationContent {
  const links = filterOrphanInternalNavLinks(navigation.links, pages);
  if (links.length === navigation.links.length) return navigation;
  return { ...navigation, links };
}

/**
 * Storefront / preview: use navigation.links as source of truth, drop orphans whose
 * page no longer exists, collapse same-pageId / same-path duplicates, and backfill
 * published custom pages that still only have `inNav: true` (pre-sync data).
 * Backfill skips destinations already represented (prevents triple Referenties from
 * ghost localStorage pages sharing `/referenties`).
 */
export function resolveStorefrontNavLinks(
  navigation: SiteNavigationContent,
  pages: readonly NavPageRef[],
): SiteNavLink[] {
  const links = dedupeCustomPageNavLinks(
    filterOrphanInternalNavLinks(navigation.links, pages),
    pages,
  );
  const linked = new Set(
    links
      .map((l) => (isInternalCustomPageLink(l.link) ? l.link.pageId : null))
      .filter((id): id is string => !!id),
  );
  const slugById = new Map<string, string>();
  for (const p of pages) {
    const path = normalizeNavPath(p.slug);
    if (path) slugById.set(p.id, path);
  }
  const seenPaths = new Set<string>();
  for (const l of links) {
    const path = navLinkDestinationPath(l, slugById);
    if (path) seenPaths.add(path);
  }

  for (const p of pages) {
    if (!p.isCustom || p.isDraftOnly || !p.inNav) continue;
    if (linked.has(p.id)) continue;
    const path = normalizeNavPath(p.slug);
    if (path && seenPaths.has(path)) continue;
    links.push({
      id: customPageNavLinkId(p.id),
      label: p.title,
      link: { type: "internal", pageId: p.id },
    });
    linked.add(p.id);
    if (path) seenPaths.add(path);
  }

  return links;
}

/** Apply `resolveStorefrontNavLinks` onto a full navigation object (hydrate / chrome). */
export function navigationWithResolvedCustomLinks(
  navigation: SiteNavigationContent,
  pages: readonly NavPageRef[],
): SiteNavigationContent {
  return {
    ...navigation,
    links: resolveStorefrontNavLinks(navigation, pages),
  };
}

/** Whether a custom page id is actually present in published navigation links. */
export function customPageIsInNavigation(
  navigation: SiteNavigationContent,
  pageId: string,
): boolean {
  return findCustomPageNavLinkIndex(navigation.links, pageId) >= 0;
}

/**
 * Lightweight page stub for admin → storefront chrome sync.
 * Full page payloads (blocks / images) blow past postMessage / BroadcastChannel limits.
 */
export function toNavChromePageStub(page: CmsPage): CmsPage {
  const stub = structuredClone(page);
  stub.blocks = [];
  stub.sectionContent = {};
  stub.isDraftOnly = false;
  return stub;
}
