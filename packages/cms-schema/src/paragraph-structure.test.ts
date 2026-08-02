import { describe, expect, it } from "vitest";
import {
  paragraphGapSizes,
  splitCmsParagraphs,
  syncParagraphStructure,
  shouldSyncParagraphStructure,
} from "./paragraph-structure";

describe("splitCmsParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitCmsParagraphs("One.\n\nTwo.\n\nThree.")).toEqual(["One.", "Two.", "Three."]);
  });
});

describe("paragraphGapSizes", () => {
  it("records a double blank as a larger gap", () => {
    expect(paragraphGapSizes("One.\n\n\nTwo.")).toEqual([2]);
    expect(paragraphGapSizes("One.\n\nTwo.\n\nThree.")).toEqual([1, 1]);
  });
});

describe("syncParagraphStructure", () => {
  it("rejoins equal paragraph counts with blank lines", () => {
    const nl = "A\n\nB\n\nC";
    const en = "A en\nB en\nC en";
    expect(syncParagraphStructure(nl, en)).toBe("A en\n\nB en\n\nC en");
  });

  it("copies an extra NL spacer into EN", () => {
    const nl = "First.\n\n\nSecond.\n\nThird.";
    const en = "First en.\n\nSecond en.\n\nThird en.";
    expect(syncParagraphStructure(nl, en)).toBe("First en.\n\n\nSecond en.\n\nThird en.");
  });

  it("merges extra EN paragraphs when NL has fewer slots", () => {
    const nl = "One.\n\nTwo.";
    const en = "One en.\n\nTwo en.\n\nThree en.";
    expect(syncParagraphStructure(nl, en)).toBe("One en.\n\nTwo en. Three en.");
  });

  it("leaves single-paragraph targets alone when NL is single-paragraph", () => {
    expect(syncParagraphStructure("Only NL", "Only EN")).toBe("Only EN");
    expect(shouldSyncParagraphStructure("Only NL", "Only EN")).toBe(false);
  });
});
