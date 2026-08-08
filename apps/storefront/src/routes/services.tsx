import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import { servicesCardsPreloadLinks } from "@/lib/image-delivery";
import type { ServicesCardsContent } from "@mccoy/cms-schema";

/** Default local CMS paths — keep in sync with cms-schema service card originals. */
const DEFAULT_SERVICE_CARD_IMAGE_SRCS = [
  "/images/cms/work-regular-sander.png",
  "/images/cms/work-horeca.jpg",
  "/images/cms/work-oplevering-hal.png",
  "/images/cms/work-floor-scrubber.jpg",
  "/images/cms/work-furniture-bank.jpg",
  "/images/cms/work-glass-van.jpg",
] as const;

function servicesCardImageSrcsForPreload(
  page: { kind: string; sectionContent?: Record<string, unknown> } | undefined,
): string[] {
  const cards = (page?.kind === "builtin"
    ? (page.sectionContent?.["services.cards"] as ServicesCardsContent | undefined)?.cards
    : undefined) ?? [];
  const srcs = cards
    .map((card) => card.image?.src)
    .filter((src): src is string => Boolean(src) && !src.includes("placeholder"));
  return srcs.length > 0 ? srcs : [...DEFAULT_SERVICE_CARD_IMAGE_SRCS];
}

export const Route = createFileRoute("/services")({
  loader: () => loadMarketingPublishedPage("/services"),
  head: ({ loaderData }) => {
    const page = loaderData?.snapshot.page;
    const preloadLinks = servicesCardsPreloadLinks(servicesCardImageSrcsForPreload(page));
    if (!loaderData?.head) {
      return {
        meta: [{ title: "Diensten — McCoy Cleaning Twente" }],
        links: preloadLinks,
      };
    }
    const base = tanstackHeadFromCms(loaderData.head);
    return {
      ...base,
      links: [...(base.links ?? []), ...preloadLinks],
    };
  },
  component: ServicesPage,
});

function ServicesPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <ServicesPageBody />
    </RoutePublishedPageProvider>
  );
}

function ServicesPageBody() {
  const { snapshot } = Route.useLoaderData();
  const page = useCmsPageForView("page_services") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";

  return (
    <main className="pt-24">
      {page?.kind === "builtin" ? (
        <PageLayoutRenderer
          page={page}
          pageKey="services"
          renderers={pageSectionRenderers}
          mode={editing ? "admin" : "public"}
          respectHidden={!editing}
        />
      ) : null}
    </main>
  );
}
