import { describe, expect, it, vi } from "vitest";
import type { BuiltinCmsPage } from "@mccoy/cms-schema";

const translateNlToEn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/content-ai.functions", () => ({
  translateNlToEn,
}));

import { preparePageEnForOpslaan } from "./store-en";

function pageWithManualEnglish(): BuiltinCmsPage {
  return {
    id: "page_home",
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
    enFieldDrafts: {
      "page:meta:title": "Welcome — manually edited",
    },
    enFieldDraftSources: {
      "page:meta:title": "Welkom",
    },
    enFieldDraftMeta: {
      "page:meta:title": {
        status: "manually_translated",
        sourceHash: "manual-source",
      },
    },
  } as unknown as BuiltinCmsPage;
}

describe("preparePageEnForOpslaan", () => {
  it("keeps translation outside repeated unchanged saves and preserves manual EN", () => {
    const published = pageWithManualEnglish();

    const first = preparePageEnForOpslaan(structuredClone(published), published);
    const second = preparePageEnForOpslaan(structuredClone(published), published);

    expect(translateNlToEn).not.toHaveBeenCalled();
    expect(first.toTranslate).toEqual({
      "page:meta:description": "Nederlandse beschrijving",
    });
    expect(second.toTranslate).toEqual(first.toTranslate);
    expect(first.nextPage.enFieldDrafts?.["page:meta:title"]).toBe("Welcome — manually edited");
    expect(first.nextPage.enFieldDraftMeta?.["page:meta:title"]?.status).toBe(
      "manually_translated",
    );
  });

  it("does not let a translation integration failure block publish preparation", () => {
    translateNlToEn.mockRejectedValueOnce(new Error("provider unavailable"));
    const published = pageWithManualEnglish();

    const prepared = preparePageEnForOpslaan(structuredClone(published), published);

    expect(prepared.nextPage.id).toBe(published.id);
    expect(prepared.toTranslate).toHaveProperty("page:meta:description");
    expect(translateNlToEn).not.toHaveBeenCalled();
  });
});
