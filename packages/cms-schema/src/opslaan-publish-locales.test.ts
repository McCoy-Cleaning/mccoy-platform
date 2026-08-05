import { describe, expect, it } from "vitest";
import {
  decideOpslaanPublishedLocales,
  opslaanSuccessToastTitle,
} from "./opslaan-publish-locales";

describe("decideOpslaanPublishedLocales", () => {
  it("publishes NL only when EN is unpublished and there are no drafts", () => {
    expect(
      decideOpslaanPublishedLocales({
        localEnPublished: false,
        serverEnPublished: false,
        hasEnDraftKeys: false,
      }),
    ).toEqual(["nl"]);
  });

  it("auto-publishes EN when draft overlays exist and EN is not yet live", () => {
    expect(
      decideOpslaanPublishedLocales({
        localEnPublished: false,
        serverEnPublished: false,
        hasEnDraftKeys: true,
      }),
    ).toEqual(["nl", "en"]);
  });

  it("republishes EN when already published locally even without new draft keys", () => {
    expect(
      decideOpslaanPublishedLocales({
        localEnPublished: true,
        serverEnPublished: false,
        hasEnDraftKeys: false,
      }),
    ).toEqual(["nl", "en"]);
  });

  it("republishes EN when server already has EN published", () => {
    expect(
      decideOpslaanPublishedLocales({
        localEnPublished: false,
        serverEnPublished: true,
        hasEnDraftKeys: false,
      }),
    ).toEqual(["nl", "en"]);
  });
});

describe("opslaanSuccessToastTitle", () => {
  it("announces bilingual publish when EN is included", () => {
    expect(opslaanSuccessToastTitle(["nl", "en"])).toBe("NL + EN gepubliceerd");
  });

  it("keeps NL-only success copy", () => {
    expect(opslaanSuccessToastTitle(["nl"])).toBe("Opgeslagen.");
  });
});
