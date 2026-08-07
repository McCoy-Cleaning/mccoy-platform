import { describe, expect, it } from "vitest";
import { defaultSiteFooter, defaultSiteNavigation } from "@mccoy/cms-schema";
import { createFileCmsStore } from "./file-store";
import { builtinCmsSeedPages } from "./seeds";
import { resolvePublicCmsRequest } from "./resolve";

describe("file cms store publish + resolve", () => {
  it("publishes NL, 302s pending EN, never serves Dutch under EN URL", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());

    const home = await store.getActivePublishedRevision("page_home");
    expect(home).not.toBeNull();
    expect(home!.payload.localeStates?.nl.publicationState).toBe("published");

    const nl = await resolvePublicCmsRequest({ pathname: "/", store });
    expect(nl.kind).toBe("snapshot");
    if (nl.kind === "snapshot") {
      expect(nl.snapshot.locale).toBe("nl");
      expect(nl.snapshot.content.seo.title.length).toBeGreaterThan(0);
    }

    const pendingEn = await resolvePublicCmsRequest({ pathname: "/en", store });
    expect(pendingEn.kind).toBe("redirect");
    if (pendingEn.kind === "redirect") {
      expect(pendingEn.statusCode).toBe(302);
      expect(pendingEn.toPath).toBe("/");
    }

    // Publish EN
    const page = home!.payload;
    const withEn = {
      ...page,
      paths: { nl: "/", en: "/" },
      localeContent: {
        ...page.localeContent!,
        en: {
          navigationLabel: "Home",
          pageTitle: "Home EN",
          seo: { title: "EN Home", description: "English home" },
        },
      },
      localeStates: {
        nl: { publicationState: "published" as const, freshness: "current" as const },
        en: { publicationState: "published" as const, freshness: "current" as const },
      },
    };
    const site = await store.getSite();
    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: withEn,
      publishedLocales: ["nl", "en"],
    });

    const en = await resolvePublicCmsRequest({ pathname: "/en", store });
    expect(en.kind).toBe("snapshot");
    if (en.kind === "snapshot") {
      expect(en.snapshot.locale).toBe("en");
      expect(en.snapshot.content.seo.title).toBe("EN Home");
      expect(en.snapshot.path).toBe("/en");
    }

    const outbox = await store.listUnprocessedOutbox();
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0]!.payload.pageId).toBe("page_home");
  });

  it("publishes EN with enFieldDrafts and applies overlays on /en", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const home = await store.getActivePublishedRevision("page_home");
    expect(home).not.toBeNull();
    const site = await store.getSite();
    const page = home!.payload;
    const withEn = {
      ...page,
      sectionContent: {
        ...(page.kind === "builtin" ? page.sectionContent : {}),
        "home.hero": {
          heading: "NL hero",
          body: "NL body",
        },
      },
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero from drafts",
        "page:meta:title": "EN Home",
        "page:meta:description": "EN desc",
      },
      paths: { nl: "/", en: "/" },
      localeContent: {
        ...page.localeContent!,
        en: {
          navigationLabel: "Home",
          pageTitle: "EN Home",
          seo: { title: "EN Home", description: "EN desc" },
        },
      },
      localeStates: {
        nl: { publicationState: "published" as const, freshness: "current" as const },
        en: { publicationState: "published" as const, freshness: "current" as const },
      },
    };
    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: withEn as typeof page,
      publishedLocales: ["nl", "en"],
    });

    const en = await resolvePublicCmsRequest({ pathname: "/en", store });
    expect(en.kind).toBe("snapshot");
    if (en.kind !== "snapshot") return;
    expect(en.snapshot.page.enFieldDrafts?.["section:home.hero:heading"]).toBe(
      "EN hero from drafts",
    );
    const hero =
      en.snapshot.page.kind === "builtin"
        ? en.snapshot.page.sectionContent["home.hero"]
        : undefined;
    expect(hero).toMatchObject({ heading: "EN hero from drafts", body: "NL body" });
  });

  it("first EN publish with drafts (Opslaan path) serves /en overlays", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const home = await store.getActivePublishedRevision("page_home");
    const site = await store.getSite();
    const page = home!.payload;

    // NL-only baseline (EN draft / missing) — mirrors first Opslaan before EN go-live.
    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: {
        ...page,
        localeStates: {
          nl: { publicationState: "published" as const, freshness: "current" as const },
          en: { publicationState: "draft" as const, freshness: "unknown" as const },
        },
      } as typeof page,
      publishedLocales: ["nl"],
    });

    const pending = await resolvePublicCmsRequest({ pathname: "/en", store });
    expect(pending.kind).toBe("redirect");

    // Opslaan with EN drafts → publishedLocales includes en (decideOpslaanPublishedLocales).
    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: {
        ...page,
        sectionContent: {
          ...(page.kind === "builtin" ? page.sectionContent : {}),
          "home.hero": {
            heading: "NL hero",
            body: "NL body",
          },
        },
        enFieldDrafts: {
          "section:home.hero:heading": "EN hero from Opslaan",
          "section:home.hero:body": "Anything is possible with English copy",
          "page:meta:title": "EN Home",
          "page:meta:description": "EN desc",
        },
        localeContent: {
          ...page.localeContent!,
          en: {
            navigationLabel: "Home",
            pageTitle: "EN Home",
            seo: { title: "EN Home", description: "EN desc" },
          },
        },
        localeStates: {
          nl: { publicationState: "published" as const, freshness: "current" as const },
          en: { publicationState: "published" as const, freshness: "current" as const },
        },
      } as typeof page,
      publishedLocales: ["nl", "en"],
    });

    const en = await resolvePublicCmsRequest({ pathname: "/en", store });
    expect(en.kind).toBe("snapshot");
    if (en.kind !== "snapshot") return;
    expect(en.snapshot.page.localeStates?.en?.publicationState).toBe("published");
    expect(en.snapshot.page.enFieldDrafts?.["section:home.hero:body"]).toBe(
      "Anything is possible with English copy",
    );
    const hero =
      en.snapshot.page.kind === "builtin"
        ? en.snapshot.page.sectionContent["home.hero"]
        : undefined;
    expect(hero).toMatchObject({
      heading: "EN hero from Opslaan",
      body: "Anything is possible with English copy",
    });
  });

  it("NL-only Opslaan does not demote an already-published EN locale", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const home = await store.getActivePublishedRevision("page_home");
    const site = await store.getSite();
    const page = home!.payload;
    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: {
        ...page,
        enFieldDrafts: { "section:home.hero:heading": "EN hero" },
        localeContent: {
          ...page.localeContent!,
          en: {
            navigationLabel: "Home",
            pageTitle: "EN Home",
            seo: { title: "EN Home", description: "EN desc" },
          },
        },
        localeStates: {
          nl: { publicationState: "published" as const, freshness: "current" as const },
          en: { publicationState: "published" as const, freshness: "current" as const },
        },
      } as typeof page,
      publishedLocales: ["nl", "en"],
    });

    // Simulate stale editor payload that still says EN is draft (failed local sync).
    await store.publishPage({
      siteId: site.id,
      pageId: "page_home",
      payload: {
        ...page,
        enFieldDrafts: { "section:home.hero:heading": "EN hero refreshed" },
        localeContent: {
          ...page.localeContent!,
          en: {
            navigationLabel: "Home",
            pageTitle: "EN Home",
            seo: { title: "EN Home", description: "EN desc" },
          },
        },
        localeStates: {
          nl: { publicationState: "published" as const, freshness: "current" as const },
          en: { publicationState: "draft" as const, freshness: "unknown" as const },
        },
      } as typeof page,
      publishedLocales: ["nl"],
    });

    const en = await resolvePublicCmsRequest({ pathname: "/en", store });
    expect(en.kind).toBe("snapshot");
    if (en.kind !== "snapshot") return;
    expect(en.snapshot.page.localeStates?.en?.publicationState).toBe("published");
    expect(en.snapshot.page.enFieldDrafts?.["section:home.hero:heading"]).toBe(
      "EN hero refreshed",
    );
  });

  it("rejects stale draft saves", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const page = await store.getPage("page_home");
    expect(page).not.toBeNull();
    const draft = await store.getDraftPayload("page_home");
    expect(draft).not.toBeNull();
    const expected = page!.draftRevisionNumber;

    await store.saveDraft({
      pageId: "page_home",
      expectedRevisionNumber: expected,
      changes: {},
      payload: draft!,
    });

    await expect(
      store.saveDraft({
        pageId: "page_home",
        expectedRevisionNumber: expected,
        changes: {},
        payload: draft!,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("repairs page rows that exist without an active published revision", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    const site = await store.getSite();
    await store.upsertPage({
      siteId: site.id,
      page: builtinCmsSeedPages().find((p) => p.id === "page_home")!,
      stableKey: "page_home",
    });
    const before = await store.getPage("page_home");
    expect(before?.activePublishedRevisionId).toBeNull();

    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());

    const home = await store.getActivePublishedRevision("page_home");
    expect(home).not.toBeNull();
    const nl = await resolvePublicCmsRequest({ pathname: "/", store });
    expect(nl.kind).toBe("snapshot");
  });

  it("deletes custom in-nav page and purges locale/redirect/revision artifacts", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const site = await store.getSite();

    const custom = {
      kind: "custom" as const,
      isCustom: true as const,
      id: "page_refs",
      slug: "/referenties",
      title: "Referenties",
      description: "Klantcases",
      inNav: true,
      blocks: [],
      layout: [],
      layoutVersion: 0,
      updatedAt: Date.now(),
      version: 1,
      paths: { nl: "/referenties", en: "/references" },
      localeContent: {
        nl: {
          navigationLabel: "Referenties",
          pageTitle: "Referenties",
          seo: { title: "Referenties", description: "NL" },
        },
        en: {
          navigationLabel: "References",
          pageTitle: "References",
          seo: { title: "References", description: "EN" },
        },
      },
      localeStates: {
        nl: { publicationState: "published" as const, freshness: "current" as const },
        en: { publicationState: "published" as const, freshness: "current" as const },
      },
      redirects: [
        {
          id: "redir_old",
          locale: "nl" as const,
          fromPath: "/oude-refs",
          toPath: "/referenties",
          statusCode: 301 as const,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    await store.upsertPage({ siteId: site.id, page: custom, stableKey: custom.id });
    await store.publishPage({
      siteId: site.id,
      pageId: custom.id,
      payload: custom,
      publishedLocales: ["nl", "en"],
    });

    expect(await store.getActivePublishedRevision("page_refs")).not.toBeNull();
    const localesBefore = await store.listPublishedLocaleStates();
    expect(localesBefore.some((l) => l.pageId === "page_refs")).toBe(true);

    const deleted = await store.deletePage({ siteId: site.id, pageId: "page_refs" });
    expect(deleted.deleted).toBe(true);

    expect(await store.getPage("page_refs")).toBeNull();
    expect(await store.getActivePublishedRevision("page_refs")).toBeNull();
    expect(await store.listRevisions("page_refs")).toEqual([]);
    expect((await store.listPublishedLocaleStates()).some((l) => l.pageId === "page_refs")).toBe(
      false,
    );
    expect((await store.listActiveRedirects()).some((r) => r.pageId === "page_refs")).toBe(false);
    expect(
      (await store.listActiveRedirects()).some(
        (r) => r.fromPath === "/oude-refs" || r.toPath === "/referenties",
      ),
    ).toBe(false);

    const again = await store.deletePage({ siteId: site.id, pageId: "page_refs" });
    expect(again.deleted).toBe(false);

    await expect(
      store.deletePage({ siteId: site.id, pageId: "page_home" }),
    ).rejects.toThrow(/aangepaste/i);
  });
});

describe("file cms store site chrome", () => {
  it("persists navigation logo heights and leaves footer untouched on partial save", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());

    const before = await store.getSite();
    expect(before.navigation ?? null).toBeNull();
    expect(before.footer ?? null).toBeNull();

    const navigation = {
      ...defaultSiteNavigation(),
      logoHeightDesktop: 96,
      logoHeightMobile: 40,
    };
    const savedNav = await store.saveSiteChrome({ navigation });
    expect(savedNav.navigation?.logoHeightDesktop).toBe(96);
    expect(savedNav.navigation?.logoHeightMobile).toBe(40);
    expect(savedNav.footer).toBeNull();

    const afterNav = await store.getSite();
    expect(afterNav.navigation?.logoHeightDesktop).toBe(96);
    expect(afterNav.navigation?.logoHeightMobile).toBe(40);
    expect(afterNav.footer ?? null).toBeNull();
    expect(afterNav.configVersion).toBeGreaterThan(before.configVersion);

    const footer = {
      ...defaultSiteFooter(),
      logoHeight: 48,
      logoHeightMobile: 28,
    };
    const savedFooter = await store.saveSiteChrome({ footer });
    expect(savedFooter.navigation?.logoHeightDesktop).toBe(96);
    expect(savedFooter.footer?.logoHeight).toBe(48);
    expect(savedFooter.footer?.logoHeightMobile).toBe(28);

    const afterBoth = await store.getSite();
    expect(afterBoth.navigation?.logoHeightDesktop).toBe(96);
    expect(afterBoth.footer?.logoHeight).toBe(48);
  });

  it("rejects invalid navigation payloads", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    await expect(
      store.saveSiteChrome({
        navigation: { links: "nope" } as unknown as ReturnType<typeof defaultSiteNavigation>,
      }),
    ).rejects.toThrow(/navigatie|navigation/i);
  });
});
