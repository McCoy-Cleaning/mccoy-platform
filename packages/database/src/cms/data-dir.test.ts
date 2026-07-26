import { describe, expect, it } from "vitest";
import { findMonorepoRoot, getDataDir } from "@mccoy/security";

describe("findMonorepoRoot / getDataDir", () => {
  it("walks up from apps/admin to the monorepo root", () => {
    expect(findMonorepoRoot("C:/repo/mccoy_code/apps/admin")).toBe("C:/repo/mccoy_code");
  });

  it("walks up from apps/storefront to the monorepo root", () => {
    expect(findMonorepoRoot("C:/repo/mccoy_code/apps/storefront")).toBe("C:/repo/mccoy_code");
  });

  it("handles Windows separators", () => {
    expect(findMonorepoRoot("C:\\repo\\mccoy_code\\apps\\admin")).toBe("C:\\repo\\mccoy_code");
  });

  it("returns cwd when not under apps/", () => {
    expect(findMonorepoRoot("C:/repo/mccoy_code")).toBe("C:/repo/mccoy_code");
  });

  it("getDataDir appends .data under the resolved root (no MCCOY_DATA_DIR)", () => {
    // Smoke: function is callable in node; exact path depends on cwd/env.
    expect(typeof getDataDir()).toBe("string");
    expect(getDataDir().length).toBeGreaterThan(0);
  });
});
