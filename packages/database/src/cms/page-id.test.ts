import { describe, expect, it } from "vitest";
import {
  cmsPageRecordId,
  cmsPageStableKey,
  isCmsUuid,
  uuidOrNull,
} from "./page-id";

describe("cms page id bridging", () => {
  it("recognizes uuids and rejects opaque app ids", () => {
    expect(isCmsUuid("a0000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isCmsUuid("page_home")).toBe(false);
    expect(isCmsUuid("custom_abc")).toBe(false);
  });

  it("uses page id as stable_key for builtins and customs", () => {
    expect(cmsPageStableKey("page_home")).toBe("page_home");
    expect(cmsPageStableKey("custom_x", null)).toBe("custom_x");
    expect(cmsPageStableKey("page_home", "page_home")).toBe("page_home");
  });

  it("exposes stable_key as the public record id", () => {
    expect(
      cmsPageRecordId({
        id: "a0000000-0000-4000-8000-000000000099",
        stable_key: "page_home",
      }),
    ).toBe("page_home");
    expect(
      cmsPageRecordId({
        id: "a0000000-0000-4000-8000-000000000099",
        stable_key: null,
      }),
    ).toBe("a0000000-0000-4000-8000-000000000099");
  });

  it("drops non-uuid actor ids for uuid columns", () => {
    expect(uuidOrNull("admin")).toBeNull();
    expect(uuidOrNull("a0000000-0000-4000-8000-000000000001")).toBe(
      "a0000000-0000-4000-8000-000000000001",
    );
  });
});
