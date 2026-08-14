import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuiltinCmsPage, CmsPage } from "@mccoy/cms-schema";

const harness = vi.hoisted(() => ({
  state: {
    pages: [] as CmsPage[],
    draft: {} as Record<string, { page?: CmsPage; overrides?: Record<string, unknown> }>,
  },
  translateNlToEn: vi.fn(),
}));

vi.mock("@/lib/api/content-ai.functions", () => ({
  translateNlToEn: harness.translateNlToEn,
}));

vi.mock("./store-persistence", () => ({
  EVENT: "mccoy-cms-change",
  read: () => harness.state,
}));

vi.mock("./store-draft", () => ({
  editablePage: (state: typeof harness.state, pageId: string): CmsPage | undefined =>
    state.draft[pageId]?.page ?? state.pages.find((page) => page.id === pageId),
  commitDraftPage: (state: typeof harness.state, pageId: string, page: CmsPage): void => {
    state.draft[pageId] = {
      ...(state.draft[pageId] ?? {}),
      overrides: { ...(state.draft[pageId]?.overrides ?? {}) },
      page: structuredClone(page),
    };
  },
}));

import {
  cmsEnApi,
  preparePageEnForOpslaan,
  runAutomaticEnTranslation,
  translateMissingEnForPublish,
} from "./store-en";

const PAGE_ID = "page_translation_test";
const TITLE_PATH = "page:meta:title";
const DESCRIPTION_PATH = "page:meta:description";

function page(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: PAGE_ID,
    kind: "builtin",
    isCustom: false,
    pageKey: "home",
    slug: "/",
    title: "Welkom",
    description: "Nederlandse beschrijving",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: 1,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
    ...overrides,
  } as BuiltinCmsPage;
}

function currentPage(): CmsPage {
  return harness.state.draft[PAGE_ID]?.page ?? harness.state.pages[0]!;
}

function successfulTranslation(fields: Record<string, string>) {
  return {
    ok: true as const,
    result: {
      fields: Object.fromEntries(
        Object.keys(fields).map((path) => [
          path,
          path === TITLE_PATH ? "Welcome" : "English description",
        ]),
      ),
    },
  };
}

beforeEach(() => {
  harness.state.pages = [
    page({
      enFieldDrafts: {
        [TITLE_PATH]: "Existing title",
        [DESCRIPTION_PATH]: "Existing description",
      },
      enFieldDraftSources: {
        [TITLE_PATH]: "Welkom",
        [DESCRIPTION_PATH]: "Nederlandse beschrijving",
      },
    }),
  ];
  harness.state.draft = {};
  harness.translateNlToEn.mockReset();
  harness.translateNlToEn.mockImplementation(
    async ({ data }: { data: { fields: Record<string, string> } }) =>
      successfulTranslation(data.fields),
  );
});

describe("background EN translation", () => {
  it("translates an empty EN field", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: { [TITLE_PATH]: "Existing title" },
      }),
    ];

    const result = await runAutomaticEnTranslation(PAGE_ID);

    expect(result).toMatchObject({ ok: true, translated: 1 });
    expect(harness.translateNlToEn).toHaveBeenCalledWith({
      data: {
        fields: { [DESCRIPTION_PATH]: "Nederlandse beschrijving" },
        maxCharsPerField: 4000,
      },
    });
    expect(currentPage().enFieldDrafts?.[DESCRIPTION_PATH]).toBe("English description");
  });

  it("translates whitespace EN unless it is intentional_blank", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: {
          [TITLE_PATH]: "Existing title",
          [DESCRIPTION_PATH]: "   ",
        },
      }),
    ];

    await runAutomaticEnTranslation(PAGE_ID);
    expect(currentPage().enFieldDrafts?.[DESCRIPTION_PATH]).toBe("English description");

    harness.state.pages = [
      page({
        enFieldDrafts: {
          [TITLE_PATH]: "Existing title",
          [DESCRIPTION_PATH]: "   ",
        },
        enFieldDraftMeta: {
          [DESCRIPTION_PATH]: { status: "intentional_blank" },
        },
      }),
    ];
    harness.state.draft = {};
    harness.translateNlToEn.mockClear();

    await runAutomaticEnTranslation(PAGE_ID);
    expect(harness.translateNlToEn).not.toHaveBeenCalled();
    expect(currentPage().enFieldDrafts?.[DESCRIPTION_PATH]).toBe("   ");
  });

  it("never sends or overwrites existing manual EN", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: { [TITLE_PATH]: "Manual welcome" },
        enFieldDraftMeta: {
          [TITLE_PATH]: { status: "manually_translated" },
        },
      }),
    ];

    await runAutomaticEnTranslation(PAGE_ID);

    const sent = harness.translateNlToEn.mock.calls[0]?.[0].data.fields;
    expect(sent).toEqual({ [DESCRIPTION_PATH]: "Nederlandse beschrijving" });
    expect(currentPage().enFieldDrafts?.[TITLE_PATH]).toBe("Manual welcome");
  });

  it("keeps generated EN untouched on subsequent runs", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: { [TITLE_PATH]: "Existing title" },
      }),
    ];

    await runAutomaticEnTranslation(PAGE_ID);
    expect(harness.translateNlToEn).toHaveBeenCalledTimes(1);
    harness.translateNlToEn.mockClear();

    await runAutomaticEnTranslation(PAGE_ID);

    expect(harness.translateNlToEn).not.toHaveBeenCalled();
    expect(currentPage().enFieldDrafts?.[DESCRIPTION_PATH]).toBe("English description");
  });

  it("lets manual EN entered during an in-flight request win", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: { [TITLE_PATH]: "Existing title" },
      }),
    ];
    let resolveProvider: ((value: ReturnType<typeof successfulTranslation>) => void) | undefined;
    harness.translateNlToEn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProvider = resolve;
        }),
    );

    const translation = runAutomaticEnTranslation(PAGE_ID);
    await vi.waitFor(() => expect(harness.translateNlToEn).toHaveBeenCalledTimes(1));
    cmsEnApi.setEnFieldDrafts(PAGE_ID, {
      [DESCRIPTION_PATH]: "My manual description",
    });
    resolveProvider?.(
      successfulTranslation({
        [DESCRIPTION_PATH]: "Nederlandse beschrijving",
      }),
    );
    await translation;

    expect(currentPage().enFieldDrafts?.[DESCRIPTION_PATH]).toBe("My manual description");
    expect(currentPage().enFieldDraftMeta?.[DESCRIPTION_PATH]?.status).toBe("manually_translated");
  });

  it("dedupes a failed unchanged source while explicit retry bypasses cooldown", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: { [TITLE_PATH]: "Existing title" },
      }),
    ];
    const now = Date.parse("2026-08-15T00:00:00.000Z");
    harness.translateNlToEn
      .mockResolvedValueOnce({
        ok: false,
        error: "Groq rate limit bereikt.",
        code: "rate_limit",
      })
      .mockImplementationOnce(async ({ data }: { data: { fields: Record<string, string> } }) =>
        successfulTranslation(data.fields),
      );

    await runAutomaticEnTranslation(PAGE_ID, undefined, now);
    await runAutomaticEnTranslation(PAGE_ID, undefined, now + 1_000);
    expect(harness.translateNlToEn).toHaveBeenCalledTimes(1);

    const retried = await cmsEnApi.translateMissingEnFields(PAGE_ID);

    expect(retried).toMatchObject({ ok: true, translated: 1 });
    expect(harness.translateNlToEn).toHaveBeenCalledTimes(2);
    expect(currentPage().enFieldDrafts?.[DESCRIPTION_PATH]).toBe("English description");
  });

  it("retries an empty EN field immediately when its NL source changes", async () => {
    harness.state.pages = [
      page({
        enFieldDrafts: { [TITLE_PATH]: "Existing title" },
      }),
    ];
    const now = Date.parse("2026-08-15T00:00:00.000Z");
    harness.translateNlToEn.mockResolvedValueOnce({
      ok: false,
      error: "Provider unavailable.",
      code: "provider",
    });
    await runAutomaticEnTranslation(PAGE_ID, undefined, now);

    const changed = structuredClone(currentPage());
    changed.description = "Gewijzigde Nederlandse beschrijving";
    harness.state.draft[PAGE_ID] = { page: changed, overrides: {} };
    harness.translateNlToEn.mockImplementationOnce(
      async ({ data }: { data: { fields: Record<string, string> } }) =>
        successfulTranslation(data.fields),
    );

    await runAutomaticEnTranslation(PAGE_ID, undefined, now + 1_000);

    expect(harness.translateNlToEn).toHaveBeenCalledTimes(2);
    expect(harness.translateNlToEn.mock.calls[1]?.[0].data.fields[DESCRIPTION_PATH]).toBe(
      "Gewijzigde Nederlandse beschrijving",
    );
  });
});

describe("publish EN translation", () => {
  it("collects the whole page, including every unmounted legal article, in one provider call", async () => {
    const legalPage = page({
      title: "Voorwaarden",
      description: "Voorwaarden van McCoy",
      enFieldDrafts: {
        [TITLE_PATH]: "Terms",
        [DESCRIPTION_PATH]: "Terms of McCoy",
        "block:blk_legal:heading": "Terms and Conditions",
        "block:blk_legal:articles.article_three.heading": "Existing article",
      },
      enFieldDraftMeta: {
        "block:blk_legal:articles.article_three.heading": {
          status: "manually_translated",
        },
        "block:blk_legal:articles.article_three.content": {
          status: "intentional_blank",
        },
      },
      blocks: [
        {
          id: "blk_legal",
          type: "legalArticles",
          data: {
            heading: "Algemene Voorwaarden",
            articles: [
              {
                id: "article_one",
                heading: "Artikel 1",
                anchor: "artikel-1",
                content: "Eerste inhoud.",
              },
              {
                id: "article_two",
                heading: "Artikel 2",
                anchor: "artikel-2",
                content: "Tweede inhoud.",
              },
              {
                id: "article_three",
                heading: "Artikel 3",
                anchor: "artikel-3",
                content: "Derde inhoud.",
              },
            ],
          },
        },
      ],
    });
    harness.state.pages = [legalPage];
    const prepared = preparePageEnForOpslaan(legalPage, legalPage);

    const result = await translateMissingEnForPublish(
      PAGE_ID,
      prepared.nextPage,
      prepared.toTranslate,
    );

    expect(result).toMatchObject({ translated: 4, providerCalls: 1 });
    expect(harness.translateNlToEn).toHaveBeenCalledTimes(1);
    const sent = harness.translateNlToEn.mock.calls[0]?.[0].data.fields;
    expect(sent).toEqual({
      "block:blk_legal:articles.article_one.heading": "Artikel 1",
      "block:blk_legal:articles.article_one.content": "Eerste inhoud.",
      "block:blk_legal:articles.article_two.heading": "Artikel 2",
      "block:blk_legal:articles.article_two.content": "Tweede inhoud.",
    });
    expect(result.page.enFieldDrafts?.["block:blk_legal:articles.article_one.heading"]).toBe(
      "English description",
    );
    expect(result.page.enFieldDrafts?.["block:blk_legal:articles.article_two.content"]).toBe(
      "English description",
    );
    expect(result.page.enFieldDrafts?.["block:blk_legal:articles.article_three.heading"]).toBe(
      "Existing article",
    );
    expect(
      result.page.enFieldDrafts?.["block:blk_legal:articles.article_three.content"],
    ).toBeUndefined();
  });

  it("preserves manual EN entered while the publish batch is in flight", async () => {
    const sourcePage = page({
      enFieldDrafts: { [TITLE_PATH]: "Existing title" },
    });
    harness.state.pages = [sourcePage];
    const prepared = preparePageEnForOpslaan(sourcePage, sourcePage);
    let resolveProvider: ((value: ReturnType<typeof successfulTranslation>) => void) | undefined;
    harness.translateNlToEn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProvider = resolve;
        }),
    );

    const translation = translateMissingEnForPublish(
      PAGE_ID,
      prepared.nextPage,
      prepared.toTranslate,
    );
    await vi.waitFor(() => expect(harness.translateNlToEn).toHaveBeenCalledTimes(1));
    cmsEnApi.setEnFieldDrafts(PAGE_ID, {
      [DESCRIPTION_PATH]: "My manual description",
    });
    resolveProvider?.(
      successfulTranslation({
        [DESCRIPTION_PATH]: "Nederlandse beschrijving",
      }),
    );

    const result = await translation;
    expect(result.page.enFieldDrafts?.[DESCRIPTION_PATH]).toBe("My manual description");
    expect(result.page.enFieldDraftMeta?.[DESCRIPTION_PATH]?.status).toBe("manually_translated");
  });
});
