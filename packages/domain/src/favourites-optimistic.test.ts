import { describe, expect, it } from "vitest";

import type { CompanyFavouriteProduct } from "./commerce";
import {
  EMPTY_FAVOURITES_VIEW,
  beginFavouriteAdd,
  beginFavouriteRemove,
  buildOptimisticFavourite,
  favouriteProductIds,
  isFavouritePending,
  isOptimisticFavouriteId,
  mergeServerFavourites,
  optimisticFavouriteId,
  resetFavouritesView,
  settleFavouriteAddConfirmed,
  settleFavouriteAddFailed,
  settleFavouriteRemoveConfirmed,
  settleFavouriteRemoveFailed,
  type OptimisticFavouritesView,
} from "./favourites-optimistic";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

function serverRow(productId: string, createdAt: string): CompanyFavouriteProduct {
  return {
    id: `row-${productId}`,
    companyId: COMPANY_ID,
    productId,
    productName: `Product ${productId.toUpperCase()}`,
    productSku: `SKU-${productId.toUpperCase()}`,
    productStatus: "active",
    createdBy: "staff-1",
    createdAt,
  };
}

function placeholder(productId: string, createdAt = "2026-01-10T00:00:00.000Z") {
  return buildOptimisticFavourite({
    companyId: COMPANY_ID,
    product: { id: productId, name: `Product ${productId.toUpperCase()}`, sku: null, status: "active" },
    createdBy: "staff-1",
    createdAt,
  });
}

function productIds(view: OptimisticFavouritesView): string[] {
  return view.items.map((item) => item.productId);
}

describe("buildOptimisticFavourite", () => {
  it("mirrors the picker product and marks the row as unconfirmed", () => {
    const row = placeholder("a");
    expect(row.id).toBe(optimisticFavouriteId("a"));
    expect(isOptimisticFavouriteId(row.id)).toBe(true);
    expect(row.pending).toBe("adding");
    expect(row.companyId).toBe(COMPANY_ID);
    expect(row.productName).toBe("Product A");
  });
});

describe("optimistic add", () => {
  it("shows the row instantly at the head of the list", () => {
    const view = beginFavouriteAdd(resetFavouritesView([serverRow("b", "2026-01-01T00:00:00.000Z")]), placeholder("a"));
    expect(productIds(view)).toEqual(["a", "b"]);
    expect(view.items[0].pending).toBe("adding");
    expect(isFavouritePending(view, "a")).toBe(true);
    expect(isFavouritePending(view, "b")).toBe(false);
  });

  it("refuses to show a product twice", () => {
    const base = resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]);
    expect(beginFavouriteAdd(base, placeholder("a"))).toBe(base);
  });

  it("replaces the placeholder with the authoritative server row on success", () => {
    const view = beginFavouriteAdd(EMPTY_FAVOURITES_VIEW, placeholder("a"));
    const settled = settleFavouriteAddConfirmed(view, optimisticFavouriteId("a"), serverRow("a", "2026-02-01T00:00:00.000Z"));

    expect(settled.items).toHaveLength(1);
    expect(settled.items[0].id).toBe("row-a");
    expect(settled.items[0].pending).toBeUndefined();
    expect(settled.items[0].createdAt).toBe("2026-02-01T00:00:00.000Z");
    expect(isFavouritePending(settled, "a")).toBe(false);
  });

  it("does not duplicate the product when an idempotent add returns an already-listed row", () => {
    // A revalidation landed mid-flight and already inserted the confirmed row.
    const view: OptimisticFavouritesView = {
      items: [placeholder("a"), serverRow("a", "2026-02-01T00:00:00.000Z")],
      pendingRemovals: new Map(),
    };
    const settled = settleFavouriteAddConfirmed(view, optimisticFavouriteId("a"), serverRow("a", "2026-02-01T00:00:00.000Z"));
    expect(productIds(settled)).toEqual(["a"]);
    expect(settled.items[0].pending).toBeUndefined();
  });
});

describe("rollback of a failed add", () => {
  it("removes only the failed placeholder and leaves confirmed rows intact", () => {
    const view = beginFavouriteAdd(resetFavouritesView([serverRow("b", "2026-01-01T00:00:00.000Z")]), placeholder("a"));
    const rolled = settleFavouriteAddFailed(view, optimisticFavouriteId("a"));

    expect(productIds(rolled)).toEqual(["b"]);
    expect(isFavouritePending(rolled, "a")).toBe(false);
    // The product is selectable again, so the user can retry.
    expect(favouriteProductIds(rolled).has("a")).toBe(false);
  });

  it("leaves a concurrent in-flight add untouched", () => {
    let view = beginFavouriteAdd(EMPTY_FAVOURITES_VIEW, placeholder("a"));
    view = beginFavouriteAdd(view, placeholder("b"));

    const rolled = settleFavouriteAddFailed(view, optimisticFavouriteId("a"));

    expect(productIds(rolled)).toEqual(["b"]);
    expect(isFavouritePending(rolled, "b")).toBe(true);
  });

  it("is a no-op when the placeholder is already gone", () => {
    const view = resetFavouritesView([serverRow("b", "2026-01-01T00:00:00.000Z")]);
    expect(settleFavouriteAddFailed(view, optimisticFavouriteId("a"))).toBe(view);
  });
});

describe("optimistic remove", () => {
  it("hides the row instantly and blocks a second submission", () => {
    const base = resetFavouritesView([
      serverRow("a", "2026-01-03T00:00:00.000Z"),
      serverRow("b", "2026-01-02T00:00:00.000Z"),
    ]);
    const view = beginFavouriteRemove(base, "a");

    expect(productIds(view)).toEqual(["b"]);
    expect(isFavouritePending(view, "a")).toBe(true);
    // The row is no longer rendered, so its delete control cannot be pressed again.
    expect(beginFavouriteRemove(view, "a")).toBe(view);
  });

  it("stops blocking the control once the server confirms, and keeps the row hidden", () => {
    const view = settleFavouriteRemoveConfirmed(
      beginFavouriteRemove(resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]), "a"),
      "a",
    );
    expect(productIds(view)).toEqual([]);
    expect(isFavouritePending(view, "a")).toBe(false);
    // The record is retained so the reconciling read cannot resurrect the row.
    expect(view.pendingRemovals.get("a")?.confirmed).toBe(true);
  });
});

describe("rollback of a failed remove", () => {
  it("restores the row at its original position, not at the end", () => {
    const base = resetFavouritesView([
      serverRow("a", "2026-01-04T00:00:00.000Z"),
      serverRow("b", "2026-01-03T00:00:00.000Z"),
      serverRow("c", "2026-01-02T00:00:00.000Z"),
    ]);
    const rolled = settleFavouriteRemoveFailed(beginFavouriteRemove(base, "b"), "b");

    expect(productIds(rolled)).toEqual(["a", "b", "c"]);
    expect(rolled.items[1].pending).toBeUndefined();
    expect(rolled.pendingRemovals.size).toBe(0);
  });

  it("restores only the failed row when two removals are in flight", () => {
    const base = resetFavouritesView([
      serverRow("a", "2026-01-03T00:00:00.000Z"),
      serverRow("b", "2026-01-02T00:00:00.000Z"),
      serverRow("c", "2026-01-01T00:00:00.000Z"),
    ]);
    let view = beginFavouriteRemove(base, "a");
    view = beginFavouriteRemove(view, "c");
    expect(productIds(view)).toEqual(["b"]);

    // `a` fails, `c` succeeds. A snapshot-based rollback would wrongly bring `c` back.
    const rolled = settleFavouriteRemoveConfirmed(settleFavouriteRemoveFailed(view, "a"), "c");

    expect(productIds(rolled)).toEqual(["a", "b"]);
    expect(rolled.pendingRemovals.has("a")).toBe(false);
    expect(rolled.pendingRemovals.get("c")?.confirmed).toBe(true);
  });

  it("keeps the newer row when the product was re-added before the failure arrived", () => {
    const base = resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]);
    let view = beginFavouriteRemove(base, "a");
    view = beginFavouriteAdd(view, placeholder("a", "2026-03-01T00:00:00.000Z"));
    // Re-adding cancels the hidden row so the two operations cannot both apply.
    expect(view.pendingRemovals.has("a")).toBe(false);

    const rolled = settleFavouriteRemoveFailed(view, "a");
    expect(productIds(rolled)).toEqual(["a"]);
    expect(rolled.items[0].pending).toBe("adding");
  });

  it("is a no-op when no removal is pending for that product", () => {
    const view = resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]);
    expect(settleFavouriteRemoveFailed(view, "a")).toBe(view);
  });
});

describe("mergeServerFavourites", () => {
  it("adopts authoritative server state when nothing is in flight", () => {
    const view = resetFavouritesView([serverRow("a", "2026-01-02T00:00:00.000Z")]);
    const merged = mergeServerFavourites(view, [
      serverRow("b", "2026-01-03T00:00:00.000Z"),
      serverRow("c", "2026-01-01T00:00:00.000Z"),
    ]);
    expect(productIds(merged)).toEqual(["b", "c"]);
  });

  it("does not resurrect a row whose removal is still in flight", () => {
    const view = beginFavouriteRemove(resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]), "a");
    // The server has not processed the delete yet, so it still reports the row.
    const merged = mergeServerFavourites(view, [serverRow("a", "2026-01-01T00:00:00.000Z")]);

    expect(productIds(merged)).toEqual([]);
    expect(isFavouritePending(merged, "a")).toBe(true);
  });

  it("keeps an unsettled add that the server has not stored yet", () => {
    const view = beginFavouriteAdd(EMPTY_FAVOURITES_VIEW, placeholder("a"));
    const merged = mergeServerFavourites(view, [serverRow("b", "2026-01-01T00:00:00.000Z")]);

    expect(productIds(merged)).toEqual(["a", "b"]);
    expect(merged.items[0].pending).toBe("adding");
  });

  it("prefers the server row once it reports the product an add is still awaiting", () => {
    const view = beginFavouriteAdd(EMPTY_FAVOURITES_VIEW, placeholder("a"));
    const merged = mergeServerFavourites(view, [serverRow("a", "2026-01-01T00:00:00.000Z")]);

    expect(productIds(merged)).toEqual(["a"]);
    expect(merged.items[0].id).toBe("row-a");
    expect(merged.items[0].pending).toBeUndefined();
  });

  it("does not resurrect a confirmed removal when the read still reports the row", () => {
    // The reconciling read can observe the table before the accepted delete lands.
    const view = settleFavouriteRemoveConfirmed(
      beginFavouriteRemove(resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]), "a"),
      "a",
    );
    const merged = mergeServerFavourites(view, [serverRow("a", "2026-01-01T00:00:00.000Z")]);

    expect(productIds(merged)).toEqual([]);
    // Applied once, then forgotten, so a genuine re-add is not suppressed forever.
    expect(merged.pendingRemovals.size).toBe(0);
    expect(productIds(mergeServerFavourites(merged, [serverRow("a", "2026-01-01T00:00:00.000Z")]))).toEqual(["a"]);
  });

  it("keeps an unconfirmed removal suppressed across repeated reads", () => {
    const view = beginFavouriteRemove(resetFavouritesView([serverRow("a", "2026-01-01T00:00:00.000Z")]), "a");
    const once = mergeServerFavourites(view, [serverRow("a", "2026-01-01T00:00:00.000Z")]);
    const twice = mergeServerFavourites(once, [serverRow("a", "2026-01-01T00:00:00.000Z")]);

    expect(productIds(twice)).toEqual([]);
    expect(isFavouritePending(twice, "a")).toBe(true);
  });

  it("drops a row another staff member deleted, so the UI cannot show stale membership", () => {
    const view = resetFavouritesView([
      serverRow("a", "2026-01-02T00:00:00.000Z"),
      serverRow("b", "2026-01-01T00:00:00.000Z"),
    ]);
    const merged = mergeServerFavourites(view, [serverRow("b", "2026-01-01T00:00:00.000Z")]);
    expect(productIds(merged)).toEqual(["b"]);
  });
});
