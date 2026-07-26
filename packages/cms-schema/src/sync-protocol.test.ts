import { describe, expect, it } from "vitest";
import { defaultSiteNavigation, mergeNavigationPatch, parseSiteNavigation } from "./navigation";
import {
  CMS_SYNC_BROADCAST,
  CMS_SYNC_CHANNEL,
  isCmsPublishedChromeBroadcast,
  isCmsSyncChildMessage,
  isCmsSyncParentMessage,
  parseSyncPublishedChrome,
  parseSyncPublishedNavigation,
} from "./sync-protocol";

describe("cms sync protocol", () => {
  it("accepts a valid published navigation push", () => {
    const navigation = parseSiteNavigation(
      mergeNavigationPatch(defaultSiteNavigation(), { logoHeightDesktop: 100 }),
    )!;
    const msg = {
      channel: CMS_SYNC_CHANNEL,
      type: "sync-published-navigation" as const,
      navigation,
    };
    expect(isCmsSyncParentMessage(msg)).toBe(true);
    expect(parseSyncPublishedNavigation(msg)?.logoHeightDesktop).toBe(100);
  });

  it("accepts navigation plus published custom pages", () => {
    const navigation = defaultSiteNavigation();
    const msg = {
      channel: CMS_SYNC_CHANNEL,
      type: "sync-published-navigation" as const,
      navigation,
      pages: [
        {
          id: "page_ref",
          slug: "/referenties",
          title: "Referenties",
          description: "x",
          inNav: true,
          isCustom: true,
          blocks: [],
          updatedAt: 1,
          version: 1,
        },
      ],
      removePageIds: ["page_old"],
    };
    expect(isCmsSyncParentMessage(msg)).toBe(true);
    const chrome = parseSyncPublishedChrome(msg);
    expect(chrome?.pages?.[0]?.title).toBe("Referenties");
    expect(chrome?.removePageIds).toEqual(["page_old"]);
  });

  it("rejects malformed navigation payloads", () => {
    expect(
      isCmsSyncParentMessage({
        channel: CMS_SYNC_CHANNEL,
        type: "sync-published-navigation",
        navigation: { links: "nope" },
      }),
    ).toBe(false);
  });

  it("recognises ready and ack child messages", () => {
    expect(isCmsSyncChildMessage({ channel: CMS_SYNC_CHANNEL, type: "sync-ready" })).toBe(true);
    expect(isCmsSyncChildMessage({ channel: CMS_SYNC_CHANNEL, type: "sync-ack", ok: true })).toBe(
      true,
    );
    expect(
      isCmsSyncChildMessage({
        channel: CMS_SYNC_CHANNEL,
        type: "sync-ack",
        ok: false,
        reason: "fail",
      }),
    ).toBe(true);
  });

  it("recognises published-chrome broadcast payloads", () => {
    expect(
      isCmsPublishedChromeBroadcast({
        channel: CMS_SYNC_BROADCAST,
        navigation: defaultSiteNavigation(),
        pages: [{ id: "a", slug: "/a", title: "A" }],
      }),
    ).toBe(true);
  });
});
