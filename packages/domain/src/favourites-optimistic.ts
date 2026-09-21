/**
 * Pure reconciliation helpers for optimistically rendered company favourite lists.
 *
 * Favourites are references only — no price, quantity, entitlement, or permission
 * meaning — so the UI may show an add or remove before the server confirms it.
 *
 * Every in-flight mutation is inverted individually rather than by restoring a
 * whole snapshot. Restoring a snapshot would resurrect or discard a concurrent
 * mutation when a user toggles several rows faster than the round trip.
 */

import type { CatalogueProduct, CompanyFavouriteProduct } from "./commerce";

/** Placeholder rows carry this marker until the server returns the real row. */
export const OPTIMISTIC_FAVOURITE_ID_PREFIX = "optimistic:";

/**
 * A favourite row plus the mutation the UI should reflect.
 * `pending` is absent on rows confirmed by the server.
 */
export type OptimisticFavourite = CompanyFavouriteProduct & {
  readonly pending?: "adding";
};

/** A row hidden by a removal, kept so a failure can restore it in place. */
export type PendingFavouriteRemoval = {
  readonly row: CompanyFavouriteProduct;
  /** Index the row occupied before it was hidden. */
  readonly index: number;
  /**
   * Set once the server confirms the delete. The entry is kept rather than dropped
   * so the reconciling read that follows cannot resurrect the row if it observed
   * the table before the delete landed.
   */
  readonly confirmed?: true;
};

export type OptimisticFavouritesView = {
  readonly items: readonly OptimisticFavourite[];
  readonly pendingRemovals: ReadonlyMap<string, PendingFavouriteRemoval>;
};

export const EMPTY_FAVOURITES_VIEW: OptimisticFavouritesView = {
  items: [],
  pendingRemovals: new Map(),
};

/**
 * A product can be favourited at most once per company, so the product id is a
 * stable placeholder key. Deterministic ids keep reconciliation testable.
 */
export function optimisticFavouriteId(productId: string): string {
  return `${OPTIMISTIC_FAVOURITE_ID_PREFIX}${productId}`;
}

export function isOptimisticFavouriteId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_FAVOURITE_ID_PREFIX);
}

/** Build the row rendered immediately when a product is picked. */
export function buildOptimisticFavourite(input: {
  companyId: string;
  product: Pick<CatalogueProduct, "id" | "name" | "sku" | "status">;
  createdBy: string | null;
  createdAt: string;
}): OptimisticFavourite {
  return {
    id: optimisticFavouriteId(input.product.id),
    companyId: input.companyId,
    productId: input.product.id,
    productName: input.product.name,
    productSku: input.product.sku,
    productStatus: input.product.status,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    pending: "adding",
  };
}

/** True while any mutation for this product is unsettled — used to block double submission. */
export function isFavouritePending(view: OptimisticFavouritesView, productId: string): boolean {
  const removal = view.pendingRemovals.get(productId);
  if (removal && !removal.confirmed) return true;
  return view.items.some((item) => item.productId === productId && item.pending !== undefined);
}

export function favouriteProductIds(view: OptimisticFavouritesView): Set<string> {
  return new Set(view.items.map((item) => item.productId));
}

/**
 * Show a newly added product at once. The server orders by `created_at` descending,
 * so the placeholder belongs at the head of the list.
 */
export function beginFavouriteAdd(
  view: OptimisticFavouritesView,
  row: OptimisticFavourite,
): OptimisticFavouritesView {
  // Mirrors the unique (company_id, product_id) constraint: never show a duplicate.
  if (view.items.some((item) => item.productId === row.productId)) return view;

  // A re-add while the removal of the same product is still in flight cancels the
  // hidden row instead of stacking two contradictory operations on one product.
  const pendingRemovals = new Map(view.pendingRemovals);
  pendingRemovals.delete(row.productId);

  return { items: [row, ...view.items], pendingRemovals };
}

/** Swap the placeholder for the authoritative row the server returned. */
export function settleFavouriteAddConfirmed(
  view: OptimisticFavouritesView,
  placeholderId: string,
  confirmed: CompanyFavouriteProduct,
): OptimisticFavouritesView {
  const index = view.items.findIndex((item) => item.id === placeholderId);
  // The placeholder is gone when the user removed the row while the add was in
  // flight. Their later intent wins; do not resurrect the row.
  if (index === -1) return view;

  const items = view.items.slice();
  items[index] = { ...confirmed };

  // `add` is idempotent server-side and returns the pre-existing row on conflict,
  // which may already be present from a concurrent revalidation.
  return { items: dedupeByProductId(items), pendingRemovals: view.pendingRemovals };
}

/** Undo one failed add without touching other in-flight rows. */
export function settleFavouriteAddFailed(
  view: OptimisticFavouritesView,
  placeholderId: string,
): OptimisticFavouritesView {
  const items = view.items.filter((item) => item.id !== placeholderId);
  if (items.length === view.items.length) return view;
  return { items, pendingRemovals: view.pendingRemovals };
}

/** Hide a removed row at once, remembering where it sat so a failure can restore it. */
export function beginFavouriteRemove(
  view: OptimisticFavouritesView,
  productId: string,
): OptimisticFavouritesView {
  const index = view.items.findIndex((item) => item.productId === productId);
  if (index === -1) return view;

  const row = view.items[index];
  const items = view.items.filter((_, position) => position !== index);
  const pendingRemovals = new Map(view.pendingRemovals);
  // Strip the placeholder marker: what gets restored must look confirmed, because
  // no add is in flight for it any more.
  const { pending: _pending, ...plain } = row;
  pendingRemovals.set(productId, { row: plain, index });

  return { items, pendingRemovals };
}

/**
 * Mark a removal as accepted. The entry is retained, not dropped, so the
 * reconciling read in {@link mergeServerFavourites} cannot bring the row back.
 */
export function settleFavouriteRemoveConfirmed(
  view: OptimisticFavouritesView,
  productId: string,
): OptimisticFavouritesView {
  const entry = view.pendingRemovals.get(productId);
  if (!entry || entry.confirmed) return view;
  const pendingRemovals = new Map(view.pendingRemovals);
  pendingRemovals.set(productId, { ...entry, confirmed: true });
  return { items: view.items, pendingRemovals };
}

/** Put a failed removal back exactly where it was. */
export function settleFavouriteRemoveFailed(
  view: OptimisticFavouritesView,
  productId: string,
): OptimisticFavouritesView {
  const entry = view.pendingRemovals.get(productId);
  // An accepted removal is not rolled back by a later failure of something else.
  if (!entry || entry.confirmed) return view;

  const pendingRemovals = new Map(view.pendingRemovals);
  pendingRemovals.delete(productId);

  // The product may have been re-added in the meantime; that newer row wins.
  if (view.items.some((item) => item.productId === productId)) {
    return { items: view.items, pendingRemovals };
  }

  const items = view.items.slice();
  items.splice(Math.min(entry.index, items.length), 0, entry.row);
  return { items, pendingRemovals };
}

/**
 * Fold an authoritative server list into the current view.
 *
 * Used for silent revalidation after a mutation settles, so the list reconciles
 * with the server without flashing a loading state. Unsettled mutations survive
 * the merge: a revalidation must never show a success the user has since undone,
 * nor undo one the server has not rejected.
 *
 * Accepted removals are applied to this read and then forgotten, so a row that
 * genuinely comes back — re-added by another user — reappears on the next read
 * instead of being suppressed forever.
 */
export function mergeServerFavourites(
  view: OptimisticFavouritesView,
  serverItems: readonly CompanyFavouriteProduct[],
): OptimisticFavouritesView {
  const rows = serverItems
    .filter((item) => !view.pendingRemovals.has(item.productId))
    .map((item) => ({ ...item }) as OptimisticFavourite);

  const serverIds = new Set(rows.map((item) => item.productId));
  const stillAdding = view.items.filter(
    (item) => item.pending === "adding" && !serverIds.has(item.productId),
  );

  const pendingRemovals = new Map<string, PendingFavouriteRemoval>();
  for (const [productId, entry] of view.pendingRemovals) {
    if (!entry.confirmed) pendingRemovals.set(productId, entry);
  }

  return { items: [...stillAdding, ...rows], pendingRemovals };
}

/** Replace the whole view with server truth, e.g. on first load or an explicit retry. */
export function resetFavouritesView(
  serverItems: readonly CompanyFavouriteProduct[],
): OptimisticFavouritesView {
  return { items: serverItems.map((item) => ({ ...item })), pendingRemovals: new Map() };
}

function dedupeByProductId(items: readonly OptimisticFavourite[]): OptimisticFavourite[] {
  const seen = new Set<string>();
  const next: OptimisticFavourite[] = [];
  for (const item of items) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    next.push(item);
  }
  return next;
}
