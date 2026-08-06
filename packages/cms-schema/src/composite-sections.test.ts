import { describe, expect, it } from "vitest";
import {
  buildEditorLayoutRows,
  countEditorSections,
  defaultFixedLayout,
  compositeEditorRowId,
  parseCompositeEditorRowId,
} from "./index";

describe("composite section editor rows", () => {
  it("expands about.main into kop / missie / visie / historie", () => {
    const layout = defaultFixedLayout("about");
    const rows = buildEditorLayoutRows(layout, {
      blockLabel: () => "Sectie",
      minMovableIndex: 0,
    });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.composite?.partId)).toEqual([
      "header",
      "mission",
      "vision",
      "history",
    ]);
    expect(rows[0]?.canHide).toBe(true);
    expect(rows[0]?.canDelete).toBe(true);
    expect(rows[1]?.canHide).toBe(false);
    expect(countEditorSections(layout)).toBe(4);
  });

  it("keeps home fixed sections one-row-each", () => {
    const layout = defaultFixedLayout("home");
    const rows = buildEditorLayoutRows(layout, {
      blockLabel: () => "Sectie",
      minMovableIndex: 1,
    });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => !r.composite)).toBe(true);
    expect(countEditorSections(layout)).toBe(4);
  });

  it("parses composite editor row ids", () => {
    const id = compositeEditorRowId("fixed:about:main", "mission");
    expect(parseCompositeEditorRowId(id)).toEqual({
      layoutItemId: "fixed:about:main",
      partId: "mission",
    });
  });

  it("keeps services as two independent fixed rows (not composite)", () => {
    const layout = defaultFixedLayout("services");
    const rows = buildEditorLayoutRows(layout, {
      blockLabel: () => "Sectie",
      minMovableIndex: 0,
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.composite)).toBe(true);
    expect(rows.map((r) => r.label)).toEqual(["Diensten - Intro", "Dienstkaarten"]);
    expect(rows.every((r) => r.canDelete)).toBe(true);
    expect(countEditorSections(layout)).toBe(2);
  });
});
