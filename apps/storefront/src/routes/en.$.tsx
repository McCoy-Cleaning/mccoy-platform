import * as React from "react";
import { createFileRoute, redirect, notFound } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { BlocksView } from "@/components/site/BlockView";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import {
  localizeCmsPageForLocale,
  resolveProductsBlocksLayout,
  type BuiltinCmsPage,
  type BuiltinPageKey,
  type CmsPage,
} from "@mccoy/cms-schema";

/** Match /products: in-memory Producten fixed→blocks, then re-apply EN overlays. */
function withProductsBlocksCompat(page: CmsPage): CmsPage {
  if (page.kind !== "builtin" || page.pageKey !== "products") return page;
  const migrated = resolveProductsBlocksLayout(page as BuiltinCmsPage).page;
  return localizeCmsPageForLocale(migrated, "en");
}

/**
 * Phase C — English public routes. Pending EN → 302 to NL (locked policy).
 * Never renders Dutch body under /en/...
 */
export const Route = createFileRoute("/en/$")({
  loader: async ({ params }) => {
    const rest = params._splat ?? "";
    const pathname = rest ? `/en/${rest}` : "/en";
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    if (result.kind === "not_found") {
      throw notFound();
    }
    const snapshot = {
      ...result.snapshot,
      page: withProductsBlocksCompat(result.snapshot.page),
    };
    return { snapshot, head: result.head, pathname };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.head) return { meta: [{ name: "robots", content: "noindex" }] };
    return tanstackHeadFromCms(loaderData.head);
  },
  component: EnglishCmsPage,
});

function EnglishCmsPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <EnglishCmsPageBody />
    </RoutePublishedPageProvider>
  );
}

function EnglishCmsPageBody() {
  const { snapshot } = Route.useLoaderData();
  // Prefer client hydrate (includes enFieldDrafts) localized for /en; fall back to loader snapshot.
  const viewed = useCmsPageForView(snapshot.page.id) ?? snapshot.page;
  const page = React.useMemo(() => withProductsBlocksCompat(viewed), [viewed]);
  const pageKey = page.kind === "builtin" ? (page.pageKey as BuiltinPageKey | null) : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground" lang="en">
      <Navbar />
      <main>
        {page.kind === "builtin" && pageKey ? (
          <PageLayoutRenderer
            page={page}
            pageKey={pageKey}
            renderers={pageSectionRenderers}
            mode="public"
            respectHidden
          />
        ) : null}
        {page.kind === "custom" || (page.kind === "builtin" && !pageKey) ? (
          <div className={page.kind === "custom" ? "pt-24 pb-16" : undefined}>
            <BlocksView blocks={page.blocks} pageId={page.id} />
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
