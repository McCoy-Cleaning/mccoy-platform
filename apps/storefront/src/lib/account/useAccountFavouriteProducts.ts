/**
 * Portal hook for the company-shared favourite list.
 * Company is always resolved from the authenticated membership — never pass companyId.
 *
 *   const favourites = useAccountFavouriteProducts();
 *   favourites.add(product) / favourites.remove(productId)
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
  addAccountFavouriteProduct,
  listAccountFavouriteProducts,
  removeAccountFavouriteProduct,
  searchAccountActiveProducts,
} from "@/lib/api/account.functions";

const GENERIC_ERROR = "Er ging iets mis. Probeer het opnieuw.";

export type AccountFavouriteProductsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; companyId: string };

/** Announced politely so assistive tech hears the outcome of an optimistic change. */
export type FavouriteStatusMessage = { tone: "success" | "error"; text: string } | null;

export function useAccountFavouriteProducts() {
  const [state, setState] = useState<AccountFavouriteProductsState>({ status: "loading" });
  const [view, setView] = useState<OptimisticFavouritesView>(EMPTY_FAVOURITES_VIEW);
  const [statusMessage, setStatusMessage] = useState<FavouriteStatusMessage>(null);
  const [searchResults, setSearchResults] = useState<CatalogueProduct[]>([]);

  const alive = useRef(true);
  const inFlight = useRef(0);
  // Read inside stable callbacks so mutating handlers do not change identity every render.
  const viewRef = useRef(view);
  viewRef.current = view;
  const companyIdRef = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const result = await listAccountFavouriteProducts();
      if (!alive.current) return;
      if (!result.ok) {
        setState({ status: "error", message: result.error });
        return;
      }
      companyIdRef.current = result.companyId;
      setView(resetFavouritesView(result.items));
      setState({ status: "ok", companyId: result.companyId });
    } catch {
      if (!alive.current) return;
      setState({ status: "error", message: GENERIC_ERROR });
    }
  }, []);

  /**
   * Refetch without showing a loading state, so settling a mutation reconciles the
   * list with the server instead of blanking the section the user just acted on.
   */
  const revalidate = useCallback(async () => {
    try {
      const result = await listAccountFavouriteProducts();
      if (!alive.current || !result.ok) return;
      setView((current) => mergeServerFavourites(current, result.items));
    } catch {
      // A failed background refresh must not disturb what the user is looking at;
      // the next explicit action or reload surfaces the problem.
    }
  }, []);

  const settle = useCallback(() => {
    inFlight.current -= 1;
    if (inFlight.current === 0) void revalidate();
  }, [revalidate]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (product: Pick<CatalogueProduct, "id" | "name" | "sku" | "status">) => {
      const placeholderId = optimisticFavouriteId(product.id);
      const optimisticRow = buildOptimisticFavourite({
        // Display-only. The server resolves the authoritative company from the session
        // and the confirmed row replaces this placeholder on settle.
        companyId: companyIdRef.current ?? "",
        product,
        createdBy: null,
        createdAt: new Date().toISOString(),
      });

      setStatusMessage(null);
      setView((current) => beginFavouriteAdd(current, optimisticRow));
      inFlight.current += 1;

      let result: Awaited<ReturnType<typeof addAccountFavouriteProduct>> | null = null;
      try {
        result = await addAccountFavouriteProduct({ data: { productId: product.id } });
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
    [settle],
  );

  const remove = useCallback(
    async (productId: string) => {
      const removed = viewRef.current.items.find((item) => item.productId === productId);
      const label = removed?.productName ?? "Het product";

      setStatusMessage(null);
      setView((current) => beginFavouriteRemove(current, productId));
      inFlight.current += 1;

      let result: Awaited<ReturnType<typeof removeAccountFavouriteProduct>> | null = null;
      try {
        result = await removeAccountFavouriteProduct({ data: { productId } });
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
    [settle],
  );

  const search = useCallback(async (q: string) => {
    try {
      const result = await searchAccountActiveProducts({ data: { q, limit: 25 } });
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

  const isPending = useCallback((productId: string) => isFavouritePending(view, productId), [view]);

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
