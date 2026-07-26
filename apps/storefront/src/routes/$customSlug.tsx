import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublishedCmsBundle } from "@/lib/api/cms-published.functions";
import { useCms, hydratePublishedCmsState } from "@/lib/cms/store";
import { useCmsPageForView } from "@/lib/cms/live-edit-draft";
import { useEdit } from "@/lib/cms/edit-context";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { BlocksView } from "@/components/site/BlockView";
import type { CmsPage } from "@mccoy/cms-schema";

type CustomSlugLoaderData = {
  slug: string;
  page: CmsPage | null;
  hydrated: boolean;
  customPageCount: number;
  matchedSlug: string | null;
};

export const Route = createFileRoute("/$customSlug")({
  loader: async ({ params }): Promise<CustomSlugLoaderData> => {
    const slug = `/${params.customSlug}`;
    try {
      const bundle = await getPublishedCmsBundle();
      if (!bundle.ok) {
        return { slug, page: null, hydrated: false, customPageCount: 0, matchedSlug: null };
      }
      const pages = JSON.parse(bundle.pagesJson) as CmsPage[];
      // Hydrate before first render so refresh does not 404 on seed-only state.
      hydratePublishedCmsState({ pages });
      const page =
        pages.find((p) => p.isCustom && !p.isDraftOnly && p.slug === slug) ?? null;
      const customPages = pages.filter((p) => p.isCustom && !p.isDraftOnly);
      return {
        slug,
        page,
        hydrated: true,
        customPageCount: customPages.length,
        matchedSlug: page?.slug ?? null,
      };
    } catch {
      return { slug, page: null, hydrated: false, customPageCount: 0, matchedSlug: null };
    }
  },
  head: ({ params }) => {
    return {
      meta: [{ title: `${params.customSlug} — McCoy Cleaning` }],
    };
  },
  component: CustomSlugPage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="text-center space-y-2">
        <div className="text-6xl font-black">404</div>
        <div className="text-white/60">Pagina niet gevonden</div>
      </div>
    </div>
  ),
});

function CustomSlugPage() {
  const { customSlug } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const state = useCms();
  const { mode, pageId: editPageId } = useEdit();
  const isEdit = mode === "edit" && !!editPageId;
  const slug = `/${customSlug}`;
  const published =
    state.pages.find((p) => p.isCustom && !p.isDraftOnly && p.slug === slug) ??
    loaderData.page ??
    null;

  // In edit mode the admin parent tells us which page id to render (_cmsPage) — the
  // live postMessage draft is the source of truth, not a slug match against published pages.
  // Public: always go through useCmsPageForView so EN drafts overlay when locale is en.
  const page = useCmsPageForView(editPageId ?? published?.id ?? "__none__") ?? (isEdit ? undefined : published ?? undefined);

  if (!page && !isEdit) {
    throw notFound();
  }

  if (!page) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-white/50">
        Concept laden…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-24 pb-16">
        <BlocksView blocks={page.blocks} pageId={page.id} />
      </main>
      <Footer />
    </div>
  );
}
