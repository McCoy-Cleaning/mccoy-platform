import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Navbar } from "@/components/site/Navbar";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { homeSectionRenderers } from "@/components/site/homeSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";

const Footer = lazy(() =>
  import("@/components/site/Footer").then((m) => ({ default: m.Footer })),
);

export const Route = createFileRoute("/en/")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/en" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // `/en` home never 404s — unpublished EN may 302 to NL; otherwise builtin fallback.
    if (result.kind !== "snapshot") {
      throw new Error("cms: en home loader must return a snapshot");
    }
    return { snapshot: result.snapshot, head: result.head };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.head) return { meta: [{ name: "robots", content: "noindex" }] };
    return tanstackHeadFromCms(loaderData.head);
  },
  component: EnglishHome,
});

function EnglishHome() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <EnglishHomePage />
    </RoutePublishedPageProvider>
  );
}

function EnglishHomePage() {
  const { snapshot } = Route.useLoaderData();
  const page = useCmsPageForView("page_home") ?? snapshot.page;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground" lang="en">
      <Navbar />
      <main>
        {page.kind === "builtin" && page.pageKey === "home" ? (
          <PageLayoutRenderer
            page={page}
            pageKey="home"
            renderers={homeSectionRenderers}
            mode="public"
            respectHidden
          />
        ) : null}
      </main>
      <Suspense fallback={<div className="min-h-[16rem]" aria-hidden />}>
        <Footer />
      </Suspense>
    </div>
  );
}
