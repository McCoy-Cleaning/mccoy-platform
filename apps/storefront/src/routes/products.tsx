import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  resolveProductsBlocksLayout,
  type BuiltinCmsPage,
  type CmsPage,
} from "@mccoy/cms-schema";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";

/** In-memory Producten fixed→blocks for public/preview — storefront does not persist. */
function withProductsBlocksCompat(page: CmsPage): CmsPage {
  if (page.kind !== "builtin" || page.pageKey !== "products") return page;
  return resolveProductsBlocksLayout(page as BuiltinCmsPage).page;
}

export const Route = createFileRoute("/products")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/products" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // Builtin page — always seeded + published; a missing snapshot means the CMS
    // store is broken, not that the page is legitimately absent.
    if (result.kind !== "snapshot") {
      throw new Error("cms: products loader must return a snapshot");
    }
    const page = withProductsBlocksCompat(result.snapshot.page);
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
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const viewed = useCmsPageForView("page_products") ?? snapshot.page;
  // Always resolve Producten layout in memory for display (public + admin iframe).
  // Admin ensureProductsBlocksMigration remains the persistence authority for drafts.
  // Memoize — resolve clones the page; running it every render OOMs under live-edit churn.
  const page = React.useMemo(
    () => (viewed ? withProductsBlocksCompat(viewed) : viewed),
    [viewed],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
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
      <Footer />
    </div>
  );
}
