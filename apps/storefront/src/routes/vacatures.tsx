import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";

/**
 * Phase 9 JobPosting decision:
 * Do not emit multi-job JobPosting arrays on `/vacatures` (list abuse / eligibility risk).
 * Each visible vacancy gets a single JobPosting on `/vacatures/$slug` instead.
 */
export const Route = createFileRoute("/vacatures")({
  loader: () => loadMarketingPublishedPage("/vacatures"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return { meta: [{ title: "Vacatures — McCoy Cleaning" }] };
    }
    return tanstackHeadFromCms(loaderData.head);
  },
  component: VacaturesPage,
});

function VacaturesPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <VacaturesPageBody />
    </RoutePublishedPageProvider>
  );
}

function VacaturesPageBody() {
  const { snapshot } = Route.useLoaderData();
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const page = useCmsPageForView("page_vacatures") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-32">
      <div className="relative">
        <div className="pointer-events-none absolute -top-20 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        {page?.kind === "builtin" ? (
          <PageLayoutRenderer
            page={page}
            pageKey="vacatures"
            renderers={pageSectionRenderers}
            mode={editing ? "admin" : "public"}
            respectHidden={!editing}
          />
        ) : null}
      </div>
    </main>
  );
}
