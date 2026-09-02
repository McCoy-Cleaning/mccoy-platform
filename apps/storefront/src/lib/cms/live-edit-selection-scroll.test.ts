import { describe, expect, it } from "vitest";
import { shouldScrollOnLocalCanvasSelection } from "./live-edit-selection-scroll";

describe("live-edit canvas selection scroll policy", () => {
  it("does not scroll when selection is set from a canvas click", () => {
    expect(shouldScrollOnLocalCanvasSelection()).toBe(false);
  });
});
