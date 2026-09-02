import { describe, expect, it } from "vitest";
import {
  inlineTextDisplayValue,
  shouldSyncInlineTextFromProps,
} from "./wysiwyg-inline-text-state";

describe("wysiwyg-inline-text-state", () => {
  it("keeps pending commit visible until the prop catches up", () => {
    expect(inlineTextDisplayValue("Oud", null)).toBe("Oud");
    expect(inlineTextDisplayValue("Oud", "Nieuw")).toBe("Nieuw");
    expect(inlineTextDisplayValue("Nieuw", "Nieuw")).toBe("Nieuw");
  });

  it("does not sync DOM from props while focused (commit-on-blur safety)", () => {
    expect(shouldSyncInlineTextFromProps({ focused: true })).toBe(false);
    expect(shouldSyncInlineTextFromProps({ focused: false })).toBe(true);
  });
});
