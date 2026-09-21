import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Box, Droplets, Loader2, Package, Plus, Scroll, Search, Star, Trash2 } from "lucide-react";
import type { CatalogueProduct, CompanyFavouriteProduct } from "@mccoy/domain";

import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { InlineLoader } from "@/components/admin/InlineLoader";
import { useCompanyFavouriteProducts } from "../hooks/useCompanyFavouriteProducts";

const SEARCH_DEBOUNCE_MS = 250;

export function favouriteDisplayName(item: CompanyFavouriteProduct): string {
  return item.productName;
}

export function favouriteDisplaySku(item: CompanyFavouriteProduct): string | null {
  return item.productSku;
}

export function favouriteDisplayCategory(
  item: CompanyFavouriteProduct & { category?: string | null },
): string | null {
  const category = item.category?.trim();
  return category ? category : null;
}

export function pickerProductsNotFavourited(
  results: readonly CatalogueProduct[],
  favouriteProductIds: ReadonlySet<string>,
): CatalogueProduct[] {
  return results.filter((product) => !favouriteProductIds.has(product.id));
}

export function CompanyFavouriteProductsSection({ companyId }: { companyId: string }) {
  const favourites = useCompanyFavouriteProducts(companyId);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const pickerId = useId();
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const favouriteIds = favourites.favouriteIds;
  const pickerItems = useMemo(
    () => pickerProductsNotFavourited(favourites.searchResults, favouriteIds),
    [favourites.searchResults, favouriteIds],
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // Search identity is stable; only debounce query changes while the picker is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runSearch(q: string) {
    setSearching(true);
    setPickerError(null);
    const result = await favourites.search(q);
    setSearching(false);
    if (!result.ok) {
      setPickerError(result.error);
    }
    return result;
  }

  function openPicker(immediateQuery?: string) {
    const nextQuery = immediateQuery ?? query;
    setPickerOpen(true);
    favourites.clearStatusMessage();
    searchInputRef.current?.focus();
    void runSearch(nextQuery);
  }

  function addProduct(product: CatalogueProduct) {
    // The row appears at once; closing the picker here keeps the interaction
    // instant rather than waiting for the round trip to confirm.
    setPickerOpen(false);
    setQuery("");
    void favourites.add(product);
  }

  function removeProduct(productId: string) {
    void favourites.remove(productId);
  }

  const catalogueEmpty =
    pickerOpen && !searching && !pickerError && query.trim() === "" && favourites.searchResults.length === 0;
  const noSearchMatches =
    pickerOpen &&
    !searching &&
    !pickerError &&
    query.trim() !== "" &&
    favourites.searchResults.length === 0;

  return (
    <section
      id="favoriete-producten"
      className="rounded-3xl border border-white/[0.08] bg-[#0b1424]/90 p-6 shadow-[0_24px_56px_-32px_rgba(0,0,0,0.75)] backdrop-blur-xl"
      aria-labelledby="favorieten-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="favorieten-heading" className="flex items-center gap-2.5 text-lg font-semibold">
            <Star className="h-4 w-4 text-white/40" aria-hidden />
            Favoriete producten
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Deze producten zijn zichtbaar voor alle gebruikers van dit bedrijf en helpen bij sneller bestellen.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 sm:w-80">
            <span className="sr-only">Zoek favoriete producten</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              ref={searchInputRef}
              value={query}
              role="combobox"
              aria-expanded={pickerOpen}
              aria-controls={pickerId}
              aria-autocomplete="list"
              onChange={(event) => {
                setQuery(event.target.value);
                setPickerOpen(true);
                favourites.clearStatusMessage();
              }}
              placeholder="Zoek een product op naam, SKU of categorie…"
              className="a-input w-full pl-10"
            />
          </label>
          <button
            type="button"
            className="a-btn a-btn-primary"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            onClick={() => openPicker()}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Product toevoegen
          </button>
        </div>
      </div>

      {/*
        Always rendered with reserved height: an optimistic change settles into a
        success or error message without shifting the list underneath it.
      */}
      <p
        role="status"
        aria-live="polite"
        data-testid="favourites-status"
        className={`mt-4 min-h-5 text-sm ${
          favourites.statusMessage?.tone === "error" ? "text-red-300" : "text-white/55"
        }`}
      >
        {favourites.statusMessage?.text ?? ""}
      </p>

      {pickerOpen ? (
        <div
          id={pickerId}
          className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/20"
          role="listbox"
          aria-label="Catalogusproducten"
        >
          {searching ? <InlineLoader label="Producten zoeken…" className="p-6" /> : null}
          {!searching && pickerError ? (
            <ErrorState
              className="p-6"
              title="Producten niet geladen"
              message={pickerError}
              onRetry={() => {
                void runSearch(query);
              }}
            />
          ) : null}
          {!searching && catalogueEmpty ? (
            <EmptyState
              className="p-6"
              title="Nog geen catalogusproducten"
              description="Er zijn nog geen actieve producten om als favoriet toe te voegen."
            />
          ) : null}
          {!searching && noSearchMatches ? (
            <EmptyState
              className="p-6"
              title="Geen producten gevonden"
              description="Probeer een andere zoekterm of voeg eerst een product toe aan de catalogus."
            />
          ) : null}
          {!searching && !pickerError && pickerItems.length > 0
            ? pickerItems.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={favourites.isPending(product.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 disabled:opacity-50"
                  onClick={() => {
                    addProduct(product);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white/90">{product.name}</span>
                    <span className="block truncate text-xs text-white/45">{product.sku ?? "—"}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-white/45" aria-hidden />
                </button>
              ))
            : null}
          {!searching &&
          !pickerError &&
          favourites.searchResults.length > 0 &&
          pickerItems.length === 0 ? (
            <p className="p-4 text-sm text-white/55">Deze producten staan al bij de favorieten.</p>
          ) : null}
        </div>
      ) : null}

      {favourites.state.status === "loading" ? (
        // Skeleton cards occupy the loaded strip's exact footprint, so real data
        // arriving does not shift the rest of the company page.
        <div className="mt-5" role="status" aria-busy="true">
          <span className="sr-only">Favorieten laden…</span>
          <div className="flex gap-4 overflow-hidden pb-2" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="min-h-[14.75rem] w-[13.5rem] shrink-0 animate-pulse rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 motion-reduce:animate-none"
              >
                <div className="h-[6.5rem] rounded-2xl bg-white/[0.06]" />
                <div className="space-y-2 pt-3">
                  <div className="h-3.5 w-3/4 rounded bg-white/[0.06]" />
                  <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
                  <div className="h-3 w-2/5 rounded bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {favourites.state.status === "error" ? (
        <ErrorState
          title="Favorieten niet geladen"
          message={favourites.state.message}
          onRetry={() => {
            void favourites.reload();
          }}
        />
      ) : null}
      {favourites.state.status === "ok" ? (
        <div className="mt-5 flex gap-4 overflow-x-auto pb-2">
          {favourites.items.map((item) => {
            const name = favouriteDisplayName(item);
            const sku = favouriteDisplaySku(item);
            const category = favouriteDisplayCategory(item);
            const PhotoIcon = favouritePhotoIcon(name);
            const adding = item.pending === "adding";
            return (
              <article
                key={item.id}
                aria-busy={adding || undefined}
                // Opacity only — the card keeps its exact footprint while unconfirmed,
                // so settling the mutation cannot shift the row.
                className={`w-[13.5rem] shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 ${
                  adding ? "opacity-60" : ""
                }`}
              >
                <div
                  className="flex h-[6.5rem] items-center justify-center rounded-2xl bg-[#eef2f6] text-[#64748b]"
                  aria-hidden
                >
                  <PhotoIcon className="h-10 w-10" />
                </div>
                <div className="space-y-1 pt-3">
                  <h3 className="truncate text-sm font-semibold text-white/90">{name}</h3>
                  {sku ? <p className="truncate text-xs text-white/45">{sku}</p> : null}
                  {category ? <p className="truncate text-xs text-white/50">{category}</p> : null}
                  <div className="flex items-center justify-between pt-2">
                    {adding ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-white/55">
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                          aria-hidden
                        />
                        Toevoegen…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-200">
                        <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden />
                        Favoriet
                      </span>
                    )}
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-40"
                      aria-label={`${name} verwijderen`}
                      // Only this row is locked while its own mutation is unsettled;
                      // other rows stay operable.
                      disabled={favourites.isPending(item.productId)}
                      onClick={() => {
                        removeProduct(item.productId);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <button
            type="button"
            className="flex min-h-[14.75rem] w-[13.5rem] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 bg-white/[0.02] px-4 text-center text-sm font-medium text-white/60 hover:border-white/40 hover:text-white disabled:opacity-40"
            onClick={() => openPicker()}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/15">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            Product toevoegen
            <span className="text-xs font-normal leading-relaxed text-white/40">
              Zoek een product of voeg een product toe aan de favorieten
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

function favouritePhotoIcon(name: string) {
  const key = name.toLowerCase();
  if (/(reinig|cleaner|spray|glas)/.test(key)) return Droplets;
  if (/(rol|doek|mop|papier)/.test(key)) return Scroll;
  if (/(zak|bag|folie)/.test(key)) return Box;
  return Package;
}
