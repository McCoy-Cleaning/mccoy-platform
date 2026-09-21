/**
 * Staff hook for the company details "Favoriete producten" section.
 *
 *   const favourites = useCompanyFavouriteProducts(companyId);
 *   favourites.items / favourites.add(product) / favourites.remove(productId)
 *   favourites.search(q) for the product picker
 *
 * Favourites are references only — no price, quantity, or entitlement meaning —
 * so add and remove render immediately and reconcile with the server afterwards.
 * A rejected mutation is inverted individually and reported through `statusMessage`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogueProduct, CompanyFavouriteProduct, OptimisticFavouritesView } from "@mccoy/domain";
import {
  EMPTY_FAVOURITES_VIEW,
  beginFavouriteAdd,
  beginFavouriteRemove,
  buildOptimisticFavourite,
  isFavouritePending,
  mergeServerFavourites,
  optimisticFavouriteId,
  resetFavouritesView,
  settleFavouriteAddConfirmed,
  settleFavouriteAddFailed,
  settleFavouriteRemoveConfirmed,
  settleFavouriteRemoveFailed,
} from "@mccoy/domain";

import {
  addAdminCompanyFavouriteProduct,
  listAdminCompanyFavouriteProducts,
  removeAdminCompanyFavouriteProduct,
  searchAdminActiveProducts,
} from "@/lib/api/admin-customers.functions";

const GENERIC_ERROR = "Er ging iets mis. Probeer het opnieuw.";

export type CompanyFavouriteProductsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok" };

/** Announced politely so assistive tech hears the outcome of an optimistic change. */
export type FavouriteStatusMessage = { tone: "success" | "error"; text: string } | null;

export function useCompanyFavouriteProducts(companyId: string) {
  const [state, setState] = useState<CompanyFavouriteProductsState>({ status: "loading" });
  const [view, setView] = useState<OptimisticFavouritesView>(EMPTY_FAVOURITES_VIEW);
  const [statusMessage, setStatusMessage] = useState<FavouriteStatusMessage>(null);
  const [searchResults, setSearchResults] = useState<CatalogueProduct[]>([]);

  const alive = useRef(true);
  const inFlight = useRef(0);
  // Read inside stable callbacks so mutating handlers do not change identity every render.
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const result = await listAdminCompanyFavouriteProducts({ data: { companyId } });
      if (!alive.current) return;
      if (!result.ok) {
        setState({ status: "error", message: result.error });
        return;
      }
      setView(resetFavouritesView(result.items));
      setState({ status: "ok" });
    } catch {
      if (!alive.current) return;
      setState({ status: "error", message: GENERIC_ERROR });
    }
  }, [companyId]);

  /**
   * Refetch without showing a loading state, so settling a mutation reconciles the
   * list with the server instead of blanking the section the user just acted on.
   */
  const revalidate = useCallback(async () => {
    try {
      const result = await listAdminCompanyFavouriteProducts({ data: { companyId } });
      if (!alive.current || !result.ok) return;
      setView((current) => mergeServerFavourites(current, result.items));
    } catch {
      // A failed background refresh must not disturb what the user is looking at;
      // the next explicit action or reload surfaces the problem.
    }
  }, [companyId]);

  const settle = useCallback(() => {
    inFlight.current -= 1;
    if (inFlight.current === 0) void revalidate();
  }, [revalidate]);

  useEffect(() => {
    setView(EMPTY_FAVOURITES_VIEW);
    setStatusMessage(null);
    void load();
  }, [load]);

  const add = useCallback(
    async (product: Pick<CatalogueProduct, "id" | "name" | "sku" | "status">) => {
      const placeholderId = optimisticFavouriteId(product.id);
      const optimisticRow = buildOptimisticFavourite({
        companyId,
        product,
        createdBy: null,
        createdAt: new Date().toISOString(),
      });

      setStatusMessage(null);
      setView((current) => beginFavouriteAdd(current, optimisticRow));
      inFlight.current += 1;

      let result: Awaited<ReturnType<typeof addAdminCompanyFavouriteProduct>> | null = null;
      try {
        result = await addAdminCompanyFavouriteProduct({ data: { companyId, productId: product.id } });
      } catch {
        result = null;
      }

      if (!alive.current) {
        inFlight.current -= 1;
        return { ok: false as const, error: GENERIC_ERROR };
      }

      if (!result || !result.ok) {
        const error = result?.ok === false ? result.error : GENERIC_ERROR;
        setView((current) => settleFavouriteAddFailed(current, placeholderId));
        setStatusMessage({ tone: "error", text: `${product.name} is niet toegevoegd. ${error}` });
        settle();
        return { ok: false as const, error };
      }

      const item: CompanyFavouriteProduct = result.item;
      setView((current) => settleFavouriteAddConfirmed(current, placeholderId, item));
      setStatusMessage({ tone: "success", text: `${item.productName} toegevoegd aan de favorieten.` });
      settle();
      return { ok: true as const, item };
    },
    [companyId, settle],
  );

  const remove = useCallback(
    async (productId: string) => {
      const removed = viewRef.current.items.find((item) => item.productId === productId);
      const label = removed?.productName ?? "Het product";

      setStatusMessage(null);
      setView((current) => beginFavouriteRemove(current, productId));
      inFlight.current += 1;

      let result: Awaited<ReturnType<typeof removeAdminCompanyFavouriteProduct>> | null = null;
      try {
        result = await removeAdminCompanyFavouriteProduct({ data: { companyId, productId } });
      } catch {
        result = null;
      }

      if (!alive.current) {
        inFlight.current -= 1;
        return { ok: false as const, error: GENERIC_ERROR };
      }

      if (!result || !result.ok) {
        const error = result?.ok === false ? result.error : GENERIC_ERROR;
        setView((current) => settleFavouriteRemoveFailed(current, productId));
        setStatusMessage({ tone: "error", text: `${label} is niet verwijderd. ${error}` });
        settle();
        return { ok: false as const, error };
      }

      setView((current) => settleFavouriteRemoveConfirmed(current, productId));
      setStatusMessage({ tone: "success", text: `${label} verwijderd uit de favorieten.` });
      settle();
      return { ok: true as const, removed: result.removed };
    },
    [companyId, settle],
  );

  const search = useCallback(async (q: string) => {
    try {
      const result = await searchAdminActiveProducts({ data: { q, limit: 25 } });
      if (!alive.current) return { ok: false as const, error: GENERIC_ERROR };
      if (!result.ok) {
        setSearchResults([]);
        return { ok: false as const, error: result.error };
      }
      setSearchResults(result.items);
      return { ok: true as const, items: result.items };
    } catch {
      if (alive.current) setSearchResults([]);
      return { ok: false as const, error: GENERIC_ERROR };
    }
  }, []);

  const isPending = useCallback(
    (productId: string) => isFavouritePending(view, productId),
    [view],
  );

  const items = view.items;
  const favouriteIds = useMemo(() => new Set(items.map((item) => item.productId)), [items]);

  return {
    state,
    items,
    favouriteIds,
    isPending,
    statusMessage,
    clearStatusMessage: useCallback(() => setStatusMessage(null), []),
    reload: load,
    add,
    remove,
    search,
    searchResults,
  };
}
