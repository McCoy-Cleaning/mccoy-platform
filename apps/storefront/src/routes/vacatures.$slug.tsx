import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  EMPLOYMENT_TYPE_LABELS_NL,
  formatHourlyRateNl,
  formatHoursPerWeekNl,
  normalizeJobs,
  resolveVacancyPublicSlug,
  buildJobPostingJsonLd,
  type VacancyItem,
  type ResolvedPublishedCmsPage,
} from "@mccoy/cms-schema";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { loadMarketingPublishedPage } from "@/lib/cms/route-page-loader";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { absoluteCanonicalLink } from "@/lib/cms/absolute-head";

function findVacancyBySlug(vacancies: VacancyItem[], slug: string): VacancyItem | null {
  const normalized = slug.trim().toLowerCase();
  return vacancies.find((v) => resolveVacancyPublicSlug(v).toLowerCase() === normalized) ?? null;
}

function visibleVacanciesFromSnapshot(snapshot: ResolvedPublishedCmsPage | undefined): VacancyItem[] {
  const page = snapshot?.page;
  if (!page || page.kind !== "builtin") return [];
  const jobsBlock = page.blocks.find((b) => b.type === "jobs");
  if (!jobsBlock) return [];
  return normalizeJobs(jobsBlock.data).vacancies.filter((v) => v.visible);
}

export const Route = createFileRoute("/vacatures/$slug")({
  loader: () => loadMarketingPublishedPage("/vacatures"),
  head: ({ params, loaderData }) => {
    const vacancy = findVacancyBySlug(
      visibleVacanciesFromSnapshot(loaderData?.snapshot),
      params.slug,
    );
    const title = vacancy
      ? `${vacancy.title} — Vacatures | McCoy Cleaning`
      : `${params.slug} — Vacatures | McCoy Cleaning`;
    const description = vacancy?.shortDescription?.trim()
      ? vacancy.shortDescription.trim()
      : "Vacature bij McCoy Cleaning in Twente. Bekijk details en solliciteer.";
    const jobLd = vacancy ? buildJobPostingJsonLd(vacancy) : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
      ],
      links: [absoluteCanonicalLink(`/vacatures/${params.slug}`)],
      scripts: jobLd
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(jobLd),
            },
          ]
        : [],
    };
  },
  component: VacatureDetailPage,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="space-y-3 text-center">
        <div className="text-6xl font-black">404</div>
        <p className="text-white/60">Vacature niet gevonden</p>
        <Link to="/vacatures" className="text-sm font-semibold text-primary hover:underline">
          Terug naar vacatures
        </Link>
      </div>
    </div>
  ),
});

function VacatureDetailPage() {
  const { snapshot } = Route.useLoaderData();
  return (
    <RoutePublishedPageProvider page={snapshot.page}>
      <VacatureDetailPageBody />
    </RoutePublishedPageProvider>
  );
}

function VacatureDetailPageBody() {
  const { slug } = Route.useParams();
  const { snapshot } = Route.useLoaderData();
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const page = useCmsPageForView("page_vacatures") ?? snapshot.page;

  const vacancy = useMemo(() => {
    if (page?.kind !== "builtin") return null;
    const jobsBlock = page.blocks.find((b) => b.type === "jobs");
    if (!jobsBlock) return null;
    const jobs = normalizeJobs(jobsBlock.data);
    const visible = jobs.vacancies.filter((v) => v.visible);
    return findVacancyBySlug(visible, slug);
  }, [page, slug]);

  if (!vacancy) {
    throw notFound();
  }

  const rate = formatHourlyRateNl(vacancy.hourlyRate);
  const hours = formatHoursPerWeekNl(vacancy.hoursPerWeek);
  const meta = [
    vacancy.department,
    vacancy.location,
    EMPLOYMENT_TYPE_LABELS_NL[vacancy.employmentType],
    hours,
    rate,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <Link to="/vacatures" className="text-sm font-medium text-white/55 hover:text-white">
          ← Alle vacatures
        </Link>
        <article className="mt-6 rounded-3xl border border-white/10 bg-card/50 p-6 sm:p-10">
          {vacancy.featured ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Uitgelicht
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {vacancy.title}
          </h1>
          {meta ? <p className="mt-2 text-sm text-white/55">{meta}</p> : null}
          {vacancy.shortDescription ? (
            <p className="mt-6 text-base leading-relaxed text-white/80">
              {vacancy.shortDescription}
            </p>
          ) : null}
          {vacancy.fullDescription ? (
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
              {vacancy.fullDescription}
            </p>
          ) : null}

          {vacancy.responsibilities?.length ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
                Verantwoordelijkheden
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
                {vacancy.responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {vacancy.requirements?.length ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
                Eisen
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
                {vacancy.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {vacancy.benefits?.length ? (
            <section className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/45">
                Arbeidsvoorwaarden
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
                {vacancy.benefits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="/vacatures#solliciteren"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {vacancy.buttonLabel || "Solliciteer"}
            </a>
            <Link
              to="/vacatures"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/5"
            >
              Terug
            </Link>
          </div>
        </article>
    </main>
  );
}
