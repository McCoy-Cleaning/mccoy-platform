import { describe, expect, it } from "vitest";
import {
  createDefaultQuoteItem,
  normalizeQuoteBlockData,
  parseBlockData,
} from "./index";

describe("quote block multi-testimonials", () => {
  it("migrates legacy flat quote fields into items[]", () => {
    const migrated = normalizeQuoteBlockData({
      quote: "Prima service",
      author: "Jan",
      role: "Manager",
      company: "Acme",
    });
    expect(migrated.items).toHaveLength(1);
    expect(migrated.items[0]?.quote).toBe("Prima service");
    expect(migrated.items[0]?.author).toBe("Jan");
    expect(migrated.items[0]?.role).toBe("Manager");
    expect(migrated.items[0]?.company).toBe("Acme");
    expect(migrated.items[0]?.id).toBeTruthy();
  });

  it("keeps existing items[] and ignores empty legacy fields", () => {
    const a = createDefaultQuoteItem({ quote: "One", author: "A" });
    const b = createDefaultQuoteItem({ quote: "Two", author: "B" });
    const migrated = normalizeQuoteBlockData({
      items: [a, b],
      quote: "should not replace",
    });
    expect(migrated.items).toHaveLength(2);
    expect(migrated.items.map((i) => i.quote)).toEqual(["One", "Two"]);
  });

  it("parseBlockData quote returns items shape", () => {
    const parsed = parseBlockData("quote", {
      quote: "Legacy",
      author: "Sam",
    });
    expect(parsed).toMatchObject({
      ok: true,
      dataVersion: 2,
      data: {
        items: [{ quote: "Legacy", author: "Sam" }],
      },
    });
  });
});
