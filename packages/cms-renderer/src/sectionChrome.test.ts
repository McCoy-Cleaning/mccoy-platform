import { describe, expect, it } from "vitest";
import { ALL_BLOCK_TYPES } from "@mccoy/cms-schema";
import { BLOCK_CHROME_CONFIG, getBlockChromeConfig } from "./sectionChrome";

describe("BLOCK_CHROME_CONFIG", () => {
  it("covers every BlockType exactly once", () => {
    expect(Object.keys(BLOCK_CHROME_CONFIG).sort()).toEqual([...ALL_BLOCK_TYPES].sort());
  });

  it("never assigns shell header + items surface without a deliberate width mode", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const cfg = getBlockChromeConfig(type);
      expect(["shell", "block", "none"]).toContain(cfg.headerMode);
      expect(["none", "section", "items"]).toContain(cfg.surfaceMode);
      expect(["page", "reading", "wideReading", "form", "media", "fullBleed"]).toContain(
        cfg.widthMode,
      );
    }
  });

  it("keeps spacer and announcement headerless", () => {
    expect(getBlockChromeConfig("spacer").headerMode).toBe("none");
    expect(getBlockChromeConfig("announcement").headerMode).toBe("none");
  });

  it("keeps reading measure for richText and page two-column for contactForm", () => {
    expect(getBlockChromeConfig("richText").widthMode).toBe("reading");
    expect(getBlockChromeConfig("contactForm").widthMode).toBe("page");
    expect(getBlockChromeConfig("contactForm").surfaceMode).toBe("none");
    expect(getBlockChromeConfig("newsletter").widthMode).toBe("form");
    expect(getBlockChromeConfig("newsletter").surfaceMode).toBe("section");
  });
});
