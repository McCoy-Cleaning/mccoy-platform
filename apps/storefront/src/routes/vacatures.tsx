import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";

export const Route = createFileRoute("/vacatures")({
  loader: () => loadMarketingPublishedPage("/vacatures"),
  head: () => ({
    meta: [
      { title: "Vacatures Schoonmaak Twente — Werken bij McCoy Cleaning" },
      {
        name: "description",
        content:
          "Vacatures schoonmaak Twente: schoonmaakmedewerker, glazenwasser en oproepkracht bij McCoy Cleaning in Oldenzaal. Solliciteer direct.",
      },
      {
        name: "keywords",
        content:
          "vacatures schoonmaak Twente, schoonmaker Oldenzaal, glazenwasser vacature, baan schoonmaak Hengelo, werken bij schoonmaakbedrijf",
      },
      { property: "og:title", content: "Vacatures — Werken bij McCoy Cleaning" },
      {
        property: "og:description",
        content: "Word onderdeel van een vast eigen team. Schoonmaakvacatures in Twente.",
      },
      { property: "og:url", content: "/vacatures" },
    ],
    links: [
      { rel: "canonical", href: "/vacatures" },
      { rel: "alternate", hrefLang: "nl", href: "/vacatures" },
      { rel: "alternate", hrefLang: "en", href: "/en/vacatures" },
      { rel: "alternate", hrefLang: "x-default", href: "/vacatures" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: "Schoonmaakmedewerker",
            description:
              "Schoonmaakmedewerker bij McCoy Cleaning in Twente. Werk in een vast eigen team aan kantoor-, horeca- en opleveringsschoonmaak.",
            employmentType: "FULL_TIME",
            hiringOrganization: {
              "@type": "Organization",
              name: "McCoy Cleaning",
              sameAs: "/",
            },
            jobLocation: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Oldenzaal",
                addressRegion: "Overijssel",
                addressCountry: "NL",
              },
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: "Glazenwasser",
            description:
              "Glazenwasser bij McCoy Cleaning in Twente. Professionele glasbewassing bij bedrijven en particulieren met modern materieel.",
            employmentType: "FULL_TIME",
            hiringOrganization: {
              "@type": "Organization",
              name: "McCoy Cleaning",
              sameAs: "/",
            },
            jobLocation: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Oldenzaal",
                addressRegion: "Overijssel",
                addressCountry: "NL",
              },
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: "Oproepkracht schoonmaak",
            description:
              "Oproepkracht schoonmaak bij McCoy Cleaning in Twente. Flexibele inzet voor uiteenlopende schoonmaakprojecten in de regio.",
            employmentType: "PART_TIME",
            hiringOrganization: {
              "@type": "Organization",
              name: "McCoy Cleaning",
              sameAs: "/",
            },
            jobLocation: {
              "@type": "Place",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Oldenzaal",
                addressRegion: "Overijssel",
                addressCountry: "NL",
              },
            },
          },
        ]),
      },
    ],
  }),
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
