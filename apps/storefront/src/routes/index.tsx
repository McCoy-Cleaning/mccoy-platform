import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Navbar } from "@/components/site/Navbar";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { homeSectionRenderers } from "@/components/site/homeSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import { homeHeroPreloadLink } from "@/lib/image-delivery";

/** Footer is below the fold — keep lucide social icons off the LCP/TBT path. */
const Footer = lazy(() =>
  import("@/components/site/Footer").then((m) => ({ default: m.Footer })),
);

export const Route = createFileRoute("/")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // Home loader always falls back to builtin content — never 404 for `/`.
    if (result.kind !== "snapshot") {
      throw new Error("cms: home loader must return a snapshot");
    }
    return { snapshot: result.snapshot, head: result.head };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return {
        meta: [{ title: "McCoy Cleaning" }],
      };
    }
    const base = tanstackHeadFromCms(loaderData.head);
    const page = loaderData.snapshot.page;
    const heroSrc =
      (page.kind === "builtin"
        ? (page.sectionContent?.["home.hero"] as { image?: { src?: string } } | undefined)?.image?.src
        : undefined) ?? "/images/cms/hero-cleaning.jpg";
    return {
      ...base,
      links: [...(base.links ?? []), homeHeroPreloadLink(heroSrc)],
    };
  },
  component: Index,
});

function Index() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <HomePage />
    </RoutePublishedPageProvider>
  );
}

function HomePage() {
  const { snapshot } = Route.useLoaderData();
  const page = useCmsPageForView("page_home") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main>
        {page?.kind === "builtin" ? (
          <PageLayoutRenderer
            page={page}
            pageKey="home"
            renderers={homeSectionRenderers}
            mode={editing ? "admin" : "public"}
            respectHidden={!editing}
          />
        ) : null}
      </main>
      <Suspense fallback={<div className="min-h-[16rem]" aria-hidden />}>
        <Footer />
      </Suspense>
    </div>
  );
}
