import { describe, expect, it } from "vitest";
import { defaultSiteNavigation } from "./navigation";
import {
  CMS_PAGE_CREATE_FORBIDDEN_REASON,
  MAX_EXTRA_CUSTOM_NAV_PAGES,
  applyCustomPageNavLink,
  canCreateCustomPage,
  canEnableCustomPageInNav,
  countExtraCustomInNavPages,
  customPageIsInNavigation,
  customPageNavLinkId,
  navigationWithResolvedCustomLinks,
  filterOrphanInternalNavLinks,
  isReferentiesNavGhost,
  purgeLocalCustomPagesNotAllowed,
  removeCustomPageNavLink,
  resolveStorefrontNavLinks,
} from "./nav-custom-pages";

function customPage(
  id: string,
  opts: { title?: string; inNav?: boolean; isDraftOnly?: boolean; slug?: string } = {},
) {
  return {
    id,
    title: opts.title ?? id,
    slug: opts.slug ?? `/${id}`,
    inNav: opts.inNav ?? false,
    isCustom: true as const,
    isDraftOnly: opts.isDraftOnly,
  };
}

describe("custom page creation", () => {
  it("forbids creating new custom pages regardless of count", () => {
    expect(canCreateCustomPage(0)).toEqual({
      ok: false,
      reason: CMS_PAGE_CREATE_FORBIDDEN_REASON,
    });
    expect(canCreateCustomPage(2)).toEqual({
      ok: false,
      reason: CMS_PAGE_CREATE_FORBIDDEN_REASON,
    });
  });
});

describe("custom page navigation sync", () => {
  it("adds and updates a nav link when inNav is true", () => {
    const nav = defaultSiteNavigation();
    const page = customPage("page_a", { title: "Duurzaamheid", inNav: true });
    const withLink = applyCustomPageNavLink(nav, page);
    expect(withLink.links).toHaveLength(nav.links.length + 1);
    expect(withLink.links.at(-1)).toEqual({
      id: customPageNavLinkId("page_a"),
      label: "Duurzaamheid",
      link: { type: "internal", pageId: "page_a" },
    });

    const renamed = applyCustomPageNavLink(withLink, {
      ...page,
      title: "Duurzaam werken",
    });
    expect(renamed.links.at(-1)?.label).toBe("Duurzaam werken");
    expect(renamed.links).toHaveLength(withLink.links.length);
  });

  it("removes the nav link when inNav is false", () => {
    const nav = applyCustomPageNavLink(
      defaultSiteNavigation(),
      customPage("page_a", { inNav: true }),
    );
    const cleared = applyCustomPageNavLink(nav, customPage("page_a", { inNav: false }));
    expect(cleared.links).toHaveLength(defaultSiteNavigation().links.length);
    expect(findId(cleared.links, "page_a")).toBeUndefined();
  });

  it("enforces the max of 3 extra custom in-nav pages", () => {
    const pages = [
      customPage("a", { inNav: true }),
      customPage("b", { inNav: true }),
      customPage("c", { inNav: true }),
      customPage("d", { inNav: false }),
    ];
    expect(countExtraCustomInNavPages(pages)).toBe(MAX_EXTRA_CUSTOM_NAV_PAGES);
    expect(canEnableCustomPageInNav(pages, "d").ok).toBe(false);
    expect(canEnableCustomPageInNav(pages, "a").ok).toBe(true);
  });

  it("does not break when more than 3 extras already exist — only blocks growth", () => {
    const pages = [
      customPage("a", { inNav: true }),
      customPage("b", { inNav: true }),
      customPage("c", { inNav: true }),
      customPage("d", { inNav: true }),
      customPage("e", { inNav: false }),
    ];
    expect(countExtraCustomInNavPages(pages)).toBe(4);
    expect(canEnableCustomPageInNav(pages, "a").ok).toBe(true);
    expect(canEnableCustomPageInNav(pages, "e").ok).toBe(false);
  });

  it("resolveStorefrontNavLinks backfills legacy inNav pages missing from links", () => {
    const nav = defaultSiteNavigation();
    const pages = [customPage("legacy", { title: "Legacy", inNav: true })];
    const resolved = resolveStorefrontNavLinks(nav, pages);
    expect(resolved).toHaveLength(nav.links.length + 1);
    expect(resolved.at(-1)?.label).toBe("Legacy");
  });

  it("navigationWithResolvedCustomLinks keeps CTAs and merges in-nav pages", () => {
    const nav = defaultSiteNavigation();
    const pages = [customPage("ref", { title: "Referenties", inNav: true })];
    const resolved = navigationWithResolvedCustomLinks(nav, pages);
    expect(resolved.jobsCta?.label).toBe(nav.jobsCta?.label);
    expect(resolved.links.some((l) => l.label === "Referenties")).toBe(true);
  });

  it("resolveStorefrontNavLinks does not duplicate links already present", () => {
    const page = customPage("page_a", { title: "Extra", inNav: true });
    const nav = applyCustomPageNavLink(defaultSiteNavigation(), page);
    const resolved = resolveStorefrontNavLinks(nav, [page]);
    expect(resolved).toHaveLength(nav.links.length);
  });

  it("dedupeCustomPageNavLinks / resolve collapses duplicate custom page links", () => {
    const page = customPage("ref", { title: "Referenties", inNav: true });
    const base = applyCustomPageNavLink(defaultSiteNavigation(), page);
    const polluted: typeof base = {
      ...base,
      links: [
        ...base.links,
        { id: "dup_1", label: "Referenties", link: { type: "internal", pageId: "ref" } },
        { id: "dup_2", label: "Referenties", link: { type: "internal", pageId: "ref" } },
      ],
    };
    const resolved = resolveStorefrontNavLinks(polluted, [page]);
    const refLinks = resolved.filter(
      (l) => l.link.type === "internal" && l.link.pageId === "ref",
    );
    expect(refLinks).toHaveLength(1);
  });

  it("resolve collapses distinct pageIds that share the same slug path", () => {
    const pages = [
      customPage("ref_a", { title: "Referenties", inNav: true, slug: "/referenties" }),
      customPage("ref_b", { title: "Referenties", inNav: true, slug: "/referenties" }),
      customPage("ref_c", { title: "Referenties", inNav: true, slug: "/referenties" }),
    ];
    const polluted = {
      ...defaultSiteNavigation(),
      links: [
        ...defaultSiteNavigation().links,
        { id: "a", label: "Referenties", link: { type: "internal" as const, pageId: "ref_a" } },
        { id: "b", label: "Referenties", link: { type: "internal" as const, pageId: "ref_b" } },
        { id: "c", label: "Referenties", link: { type: "internal" as const, pageId: "ref_c" } },
      ],
    };
    const resolved = resolveStorefrontNavLinks(polluted, pages);
    const refLinks = resolved.filter((l) => l.label === "Referenties");
    expect(refLinks).toHaveLength(1);
    expect(refLinks[0]?.link).toEqual({ type: "internal", pageId: "ref_a" });
  });

  it("backfill does not add a second link for an already-covered slug", () => {
    const pages = [
      customPage("ref_a", { title: "Referenties", inNav: true, slug: "/referenties" }),
      customPage("ref_b", { title: "Referenties", inNav: true, slug: "/referenties" }),
    ];
    const nav = applyCustomPageNavLink(defaultSiteNavigation(), pages[0]!);
    const resolved = resolveStorefrontNavLinks(nav, pages);
    expect(resolved.filter((l) => l.label === "Referenties")).toHaveLength(1);
  });

  it("applyCustomPageNavLink replaces duplicates with a single link", () => {
    const page = customPage("ref", { title: "Referenties", inNav: true });
    const polluted = {
      ...defaultSiteNavigation(),
      links: [
        ...defaultSiteNavigation().links,
        { id: "a", label: "A", link: { type: "internal" as const, pageId: "ref" } },
        { id: "b", label: "B", link: { type: "internal" as const, pageId: "ref" } },
      ],
    };
    const cleaned = applyCustomPageNavLink(polluted, page);
    const refLinks = cleaned.links.filter(
      (l) => l.link.type === "internal" && l.link.pageId === "ref",
    );
    expect(refLinks).toHaveLength(1);
    expect(refLinks[0]?.label).toBe("Referenties");
  });

  it("removeCustomPageNavLink clears both id and pageId matches", () => {
    const nav = applyCustomPageNavLink(
      defaultSiteNavigation(),
      customPage("page_a", { inNav: true }),
    );
    const cleared = removeCustomPageNavLink(nav, "page_a");
    expect(cleared.links.some((l) => l.id === customPageNavLinkId("page_a"))).toBe(false);
  });

  it("filterOrphanInternalNavLinks drops links whose pageId is missing", () => {
    const nav = applyCustomPageNavLink(
      defaultSiteNavigation(),
      customPage("page_gone", { title: "Referenties", inNav: true }),
    );
    const kept = filterOrphanInternalNavLinks(nav.links, []);
    expect(kept.some((l) => l.label === "Referenties")).toBe(false);
    expect(kept).toHaveLength(defaultSiteNavigation().links.length);

    const withPage = filterOrphanInternalNavLinks(nav.links, [
      customPage("page_gone", { title: "Referenties", inNav: true }),
    ]);
    expect(withPage.some((l) => l.label === "Referenties")).toBe(true);
  });

  it("resolveStorefrontNavLinks drops orphan internal links even if still in navigation", () => {
    const nav = applyCustomPageNavLink(
      defaultSiteNavigation(),
      customPage("page_gone", { title: "Referenties", inNav: true }),
    );
    const resolved = resolveStorefrontNavLinks(nav, []);
    expect(resolved.some((l) => l.label === "Referenties")).toBe(false);
    expect(
      resolved.some((l) => l.link.type === "internal" && l.link.pageId === "page_gone"),
    ).toBe(false);
  });

  it("delete in-nav custom page: links no longer contain it and resolve does not backfill", () => {
    const page = customPage("page_gone", { title: "Verwijderd", inNav: true });
    let nav = applyCustomPageNavLink(defaultSiteNavigation(), page);
    expect(
      nav.links.some((l) => l.link.type === "internal" && l.link.pageId === "page_gone"),
    ).toBe(true);

    nav = removeCustomPageNavLink(nav, page.id);
    const remainingPages: ReturnType<typeof customPage>[] = [];

    expect(
      nav.links.some((l) => l.link.type === "internal" && l.link.pageId === "page_gone"),
    ).toBe(false);
    expect(
      resolveStorefrontNavLinks(nav, remainingPages).some(
        (l) => l.link.type === "internal" && l.link.pageId === "page_gone",
      ),
    ).toBe(false);
    expect(customPageIsInNavigation(nav, "page_gone")).toBe(false);
  });

  it("storefront-readable nav after delete: remove link then resolve against remaining pages", () => {
    // Mirrors admin deletePage → pushPublishedChrome({ navigation, removePageIds })
    // then storefront resolveStorefrontNavLinks(navigation, pages).
    const page = customPage("page_9vp114sa", { title: "Referenties", inNav: true });
    const other = customPage("page_other", { title: "Duurzaamheid", inNav: true });
    let navigation = applyCustomPageNavLink(defaultSiteNavigation(), page);
    navigation = applyCustomPageNavLink(navigation, other);

    navigation = removeCustomPageNavLink(navigation, page.id);
    const pagesAfterDelete = [other];
    const storefrontLinks = resolveStorefrontNavLinks(navigation, pagesAfterDelete);

    expect(storefrontLinks.some((l) => l.label === "Referenties")).toBe(false);
    expect(storefrontLinks.some((l) => l.label === "Duurzaamheid")).toBe(true);
    expect(
      filterOrphanInternalNavLinks(navigation.links, pagesAfterDelete).some(
        (l) => l.label === "Referenties",
      ),
    ).toBe(false);
  });

  it("enable inNav → links contain custom page; disable → removed", () => {
    const pageOn = customPage("ref", { title: "Referenties", inNav: true });
    const pageOff = { ...pageOn, inNav: false };
    let nav = defaultSiteNavigation();
    nav = applyCustomPageNavLink(nav, pageOn);
    expect(nav.links.some((l) => l.link.type === "internal" && l.link.pageId === "ref")).toBe(
      true,
    );
    expect(resolveStorefrontNavLinks(nav, [pageOn]).some((l) => l.label === "Referenties")).toBe(
      true,
    );
    nav = applyCustomPageNavLink(nav, pageOff);
    expect(nav.links.some((l) => l.link.type === "internal" && l.link.pageId === "ref")).toBe(
      false,
    );
    expect(resolveStorefrontNavLinks(nav, [pageOff]).some((l) => l.label === "Referenties")).toBe(
      false,
    );
  });

  it("customPageIsInNavigation mirrors navigation.links", () => {
    const page = customPage("ref", { title: "Referenties", inNav: true });
    const withLink = applyCustomPageNavLink(defaultSiteNavigation(), page);
    expect(customPageIsInNavigation(withLink, "ref")).toBe(true);
    expect(customPageIsInNavigation(defaultSiteNavigation(), "ref")).toBe(false);
  });

  it("purgeLocalCustomPagesNotAllowed drops Referenties ghosts and empty-allowlist customs", () => {
    const page = customPage("page_lj7", { title: "Referenties", inNav: true, slug: "/referenties" });
    const other = customPage("page_other", { title: "Other", inNav: true, slug: "/other" });
    const nav = applyCustomPageNavLink(
      applyCustomPageNavLink(defaultSiteNavigation(), page),
      other,
    );
    const state = {
      pages: [page, other],
      draft: { page_lj7: { inNav: true } },
      saved: {},
      navigation: nav,
      navigationDraft: null,
    };
    const purged = purgeLocalCustomPagesNotAllowed(state, new Set());
    expect(purged.changed).toBe(true);
    expect(purged.state.pages.some((p) => p.isCustom)).toBe(false);
    expect(purged.state.navigation?.links.some((l) => l.label === "Referenties")).toBe(false);
    expect(purged.removedIds).toEqual(expect.arrayContaining(["page_lj7", "page_other"]));
  });

  it("isReferentiesNavGhost matches labels and slugs", () => {
    expect(isReferentiesNavGhost({ title: "Referenties", slug: "/x" })).toBe(true);
    expect(isReferentiesNavGhost({ title: "Home", slug: "/referenties" })).toBe(true);
    expect(isReferentiesNavGhost({ title: "Home", slug: "/about" })).toBe(false);
  });
});

function findId(links: { id: string; link: { type: string; pageId?: string } }[], pageId: string) {
  return links.find((l) => l.id === customPageNavLinkId(pageId) || l.link.pageId === pageId);
}
