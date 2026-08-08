/**
 * Stage 6 — CMS store publish / Opslaan / server-sync slice.
 * Coordinates durable server publish with local draft clear and chrome push.
 */
import {
  applyDraftToPage,
  canEnableCustomPageInNav,
  CUSTOM_NAV_CAP_REASON,
  decideOpslaanPublishedLocales,
  dedupeCustomPageNavLinks,
  defaultSiteFooter,
  defaultSiteNavigation,
  effectiveSiteFooter,
  effectiveSiteNavigation,
  ensureEnglishLocaleContentFromDrafts,
  isDraftDirty,
  MAX_EXTRA_CUSTOM_NAV_PAGES,
  mergeFooterPatch,
  mergeNavigationPatch,
  navigationWithoutOrphanInternalLinks,
  normalizeCmsPage,
  opslaanSuccessToastTitle,
  parseSiteFooterResult,
  parseSiteNavigationResult,
  purgeLocalCustomPagesNotAllowed,
  removeCustomPageNavLink,
  toNavChromePageStub,
  validatePublishableCmsPage,
  type CmsPage,
  type CmsPersistedState,
  type SiteFooterContent,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";
import { formatValidateIssuesNl } from "./validation-messages.nl";
import { pushPublishedChromeToStorefront } from "./publish-sync";
import {
  deleteSavedPageFromServer,
  publishSavedPageToServer,
  publishSiteChromeToServer,
  saveConceptPageToServer,
} from "./server-publish";
import {
  adminGetCmsPageStatus,
  adminGetPublishedCmsPages,
  adminListPublishedCustomPageIds,
} from "@/lib/api/cms-publish.functions";
import { pagesForNavCap, publishedPage } from "./store-draft";
import { preparePageEnForOpslaan } from "./store-en";
import {
  markPreviewStale,
  read,
  reconcileCustomInNavFromLinks,
  sanitizeLoadedNavigation,
  sessionPreviewSnapshots,
  syncCustomPageIntoNavigation,
  WRITE_FAIL_REASON,
  write,
  writeOrAlert,
} from "./store-persistence";

export const cmsPublishApi = {
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
  async saveNavigation(): Promise<{ ok: true } | { ok: false; reason: string }> {
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

    // Durable store first — ephemeral iframe/BroadcastChannel sync alone does not survive reload.
    const server = await publishSiteChromeToServer({ navigation: navToSave });
    if (!server.ok) {
      return {
        ok: false,
        reason:
          server.error ||
          "Navigatie kon niet worden opgeslagen op de live site. Probeer opnieuw.",
      };
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
      footer: s.footer ?? defaultSiteFooter(),
      pages: customPages,
    });
    return { ok: true };
  },
  discardNavigationDraft() {
    const s = read();
    writeOrAlert({ ...s, navigationDraft: null });
  },
  getFooter(): SiteFooterContent {
    const s = read();
    return effectiveSiteFooter(s.footer, s.footerDraft);
  },
  getPublishedFooter(): SiteFooterContent {
    return structuredClone(read().footer ?? defaultSiteFooter());
  },
  hasFooterDraft() {
    const s = read();
    return s.footerDraft != null;
  },
  patchFooter(
    patch: Partial<{ [K in keyof SiteFooterContent]: SiteFooterContent[K] | null }>,
  ): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const current = effectiveSiteFooter(s.footer, s.footerDraft);
    const merged = mergeFooterPatch(current, patch);
    const validated = parseSiteFooterResult(merged);
    if (!validated.ok) return validated;
    write({ ...s, footerDraft: validated.data });
    return { ok: true };
  },
  setFooterDraft(next: SiteFooterContent): { ok: true } | { ok: false; reason: string } {
    const validated = parseSiteFooterResult(next);
    if (!validated.ok) return validated;
    const s = read();
    write({ ...s, footerDraft: validated.data });
    return { ok: true };
  },
  async saveFooter(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const s = read();
    const draft = s.footerDraft;
    if (!draft) return { ok: false, reason: "Geen footerconcept om op te slaan." };
    const validated = parseSiteFooterResult(draft);
    if (!validated.ok) return validated;

    const server = await publishSiteChromeToServer({ footer: validated.data });
    if (!server.ok) {
      return {
        ok: false,
        reason:
          server.error ||
          "Footer kon niet worden opgeslagen op de live site. Probeer opnieuw.",
      };
    }

    if (!write({ ...s, footer: validated.data, footerDraft: null })) {
      return { ok: false, reason: WRITE_FAIL_REASON };
    }
    pushPublishedChromeToStorefront({
      navigation: s.navigation ?? defaultSiteNavigation(),
      footer: validated.data,
    });
    return { ok: true };
  },
  discardFooterDraft() {
    const s = read();
    writeOrAlert({ ...s, footerDraft: null });
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
          // Compare by updatedAt — object identity is always unequal after JSON.parse.
          if (remoteFresh !== localFresh || remote.updatedAt !== local.updatedAt) {
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

      // Hydrate durable site chrome when the editor has no unsaved nav/footer draft.
      if (
        next.navigationDraft == null &&
        "navigationJson" in published &&
        typeof published.navigationJson === "string" &&
        published.navigationJson.length > 0
      ) {
        try {
          const parsed = parseSiteNavigationResult(
            JSON.parse(published.navigationJson) as unknown,
          );
          if (parsed.ok) {
            const same =
              JSON.stringify(next.navigation) === JSON.stringify(parsed.data);
            if (!same) {
              next = { ...next, navigation: parsed.data };
              pagesTouched = true;
            }
          }
        } catch {
          /* ignore corrupt durable chrome */
        }
      }
      if (
        next.footerDraft == null &&
        "footerJson" in published &&
        typeof published.footerJson === "string" &&
        published.footerJson.length > 0
      ) {
        try {
          const parsed = parseSiteFooterResult(JSON.parse(published.footerJson) as unknown);
          if (parsed.ok) {
            const same = JSON.stringify(next.footer) === JSON.stringify(parsed.data);
            if (!same) {
              next = { ...next, footer: parsed.data };
              pagesTouched = true;
            }
          }
        } catch {
          /* ignore corrupt durable chrome */
        }
      }
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

    let nextPage = structuredClone(validated.page);
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

    const enPrep = await preparePageEnForOpslaan(nextPage, published);
    nextPage = enPrep.nextPage;
    const { toTranslate, translated, translateWarning, hasEnDraftKeys } = enPrep;

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
};
