import { createFileRoute } from "@tanstack/react-router";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { tanstackHeadFromCms } from "@/lib/cms/cms-head";
import { absoluteCanonicalUrl } from "@mccoy/cms-schema";

/** Existing fact-only JobPosting nodes — not invented ratings/prices. */
const VACATURES_JOB_JSON_LD = [
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
      sameAs: absoluteCanonicalUrl("/"),
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
      sameAs: absoluteCanonicalUrl("/"),
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
      sameAs: absoluteCanonicalUrl("/"),
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
];

export const Route = createFileRoute("/vacatures")({
  loader: () => loadMarketingPublishedPage("/vacatures"),
  head: ({ loaderData }) => {
    if (!loaderData?.head) {
      return { meta: [{ title: "Vacatures — McCoy Cleaning" }] };
    }
    const base = tanstackHeadFromCms(loaderData.head);
    return {
      ...base,
      scripts: [
        ...(base.scripts ?? []),
        {
          type: "application/ld+json",
          children: JSON.stringify(VACATURES_JOB_JSON_LD),
        },
      ],
    };
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
