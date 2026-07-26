import { describe, expect, it } from "vitest";
import { findCmsMediaReferencesInPayloads, storageCmsImage } from "./media";

describe("findCmsMediaReferencesInPayloads", () => {
  it("finds storage asset ids in draft and published payloads", () => {
    const assetId = "11111111-2222-4333-8444-555555555555";
    const refs = findCmsMediaReferencesInPayloads(assetId, [
      {
        pageId: "page_home",
        pageTitle: "Home",
        draftPayload: {
          sectionContent: {
            "home.hero": {
              image: storageCmsImage({
                id: assetId,
                publicUrl: "https://example.com/a.webp",
                altDefault: "Hero",
                width: 10,
                height: 10,
              }),
            },
          },
        },
        publishedPayload: { other: true },
      },
      {
        pageId: "page_about",
        pageTitle: "About",
        publishedPayload: {
          nested: [{ assetId: `storage:${assetId}`, src: "https://x", alt: "", decorative: false }],
        },
      },
    ]);
    expect(refs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pageId: "page_home", state: "draft" }),
        expect.objectContaining({ pageId: "page_about", state: "published" }),
      ]),
    );
  });

  it("returns empty when unused", () => {
    expect(
      findCmsMediaReferencesInPayloads("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", [
        { pageId: "p", pageTitle: "P", draftPayload: { hello: "world" } },
      ]),
    ).toEqual([]);
  });
});
