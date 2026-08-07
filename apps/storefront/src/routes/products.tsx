import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  localizeCmsPageForLocale,
  resolveProductsBlocksLayout,
  type BuiltinCmsPage,
  type CmsPage,
  type Locale,
} from "@mccoy/cms-schema";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

/** In-memory Producten fixed→blocks for public/preview — storefront does not persist. */
function withProductsBlocksCompat(page: CmsPage, locale: Locale = "nl"): CmsPage {
  if (page.kind !== "builtin" || page.pageKey !== "products") return page;
  // Layout migration may rebuild from NL sectionContent; re-apply EN drafts after.
  const migrated = resolveProductsBlocksLayout(page as BuiltinCmsPage).page;
  return localizeCmsPageForLocale(migrated, locale);
}

export const Route = createFileRoute("/products")({
  loader: async () => {
    const result = await loadMarketingPublishedPage("/products");
    const page = withProductsBlocksCompat(result.snapshot.page, result.snapshot.locale);
    return {
      snapshot: {
        ...result.snapshot,
        page,
      },
    };
  },
  head: () => ({
    meta: [
      { title: "Producten — McCoy Cleaning Products" },
      {
        name: "description",
        content:
          "McCoy Products: groothandel in hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en schoonmaakapparatuur. Neem contact op voor het assortiment.",
      },
      { property: "og:title", content: "Producten — McCoy Cleaning Products" },
      {
        property: "og:description",
        content:
          "McCoy Products: groothandel in hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en schoonmaakapparatuur.",
      },
      { property: "og:url", content: "/products" },
    ],
    links: [{ rel: "canonical", href: "/products" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "McCoy Cleaning Products",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              item: {
                "@type": "Product",
                name: "Luxe geurbeleving dispenser",
                description:
                  "Premium geurdispenser met verfijnde uitstraling voor sanitair, kantoren en representatieve ruimtes.",
              },
            },
            {
              "@type": "ListItem",
              position: 2,
              item: {
                "@type": "Product",
                name: "Luxe geuren",
                description:
                  "Exclusieve geuren zoals Wood Noir, Allure, Ibiza Vibes en Aromatic Amber.",
              },
            },
            {
              "@type": "ListItem",
              position: 3,
              item: {
                "@type": "Product",
                name: "Basis geuren",
                description:
                  "Frisse dagelijkse geuren zoals Eucalyptus en Lavendel voor sanitaire en algemene ruimtes.",
              },
            },
            {
              "@type": "ListItem",
              position: 4,
              item: {
                "@type": "Service",
                name: "Volledige service",
                description:
                  "Bijvullen en onderhoud elke twee maanden door McCoy, met tot 20% korting bij meerdere dispensers.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <ProductsPageBody />
    </RoutePublishedPageProvider>
  );
}

function ProductsPageBody() {
  const { snapshot } = Route.useLoaderData();
  const { mode } = useEdit();
  const editing = mode === "edit";
  const locale = useActiveCmsLocale();
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const viewed = useCmsPageForView("page_products") ?? snapshot.page;
  // Always resolve Producten layout in memory for display (public + admin iframe).
  // Admin ensureProductsBlocksMigration remains the persistence authority for drafts.
  // Memoize — resolve clones the page; running it every render OOMs under live-edit churn.
  const page = React.useMemo(
    () => (viewed ? withProductsBlocksCompat(viewed, locale) : viewed),
    [viewed, locale],
  );

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="products"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
