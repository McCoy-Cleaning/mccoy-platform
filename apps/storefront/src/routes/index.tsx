import { createFileRoute, redirect } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { homeSectionRenderers } from "@/components/site/homeSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import {
  HERO_IMAGE_SIZES,
  heroWebpSrcSet,
  supabasePhotoSrcSets,
  supabaseTransformedUrl,
} from "@/lib/image-delivery";

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
    const remote = supabasePhotoSrcSets(heroSrc, [640, 960, 1280]);
    const webpSrcSet =
      remote?.webpSrcSet ??
      heroWebpSrcSet(heroSrc) ??
      "/images/cms/hero-cleaning-640.webp 640w, /images/cms/hero-cleaning-960.webp 960w, /images/cms/hero-cleaning-1280.webp 1280w";
    const preloadHref = remote
      ? supabaseTransformedUrl(heroSrc, { width: 640, quality: 72, format: "webp" })
      : "/images/cms/hero-cleaning-640.webp";
    return {
      ...base,
      links: [
        ...(base.links ?? []),
        {
          rel: "preload",
          as: "image",
          type: "image/webp",
          href: preloadHref,
          imageSrcSet: webpSrcSet,
          imageSizes: HERO_IMAGE_SIZES,
          fetchPriority: "high",
        },
      ],
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
      <Footer />
    </div>
  );
}
