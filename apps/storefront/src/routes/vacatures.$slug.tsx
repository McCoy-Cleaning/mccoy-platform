import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  EMPLOYMENT_TYPE_LABELS_NL,
  formatHourlyRateNl,
  formatHoursPerWeekNl,
  normalizeJobs,
  resolveVacancyPublicSlug,
  type VacancyItem,
} from "@mccoy/cms-schema";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";

function findVacancyBySlug(vacancies: VacancyItem[], slug: string): VacancyItem | null {
  const normalized = slug.trim().toLowerCase();
  return vacancies.find((v) => resolveVacancyPublicSlug(v).toLowerCase() === normalized) ?? null;
}

export const Route = createFileRoute("/vacatures/$slug")({
  loader: async () => {
    const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
    const { resultJson } = await loadPublishedPageForPath({ data: { pathname: "/vacatures" } });
    const result = JSON.parse(resultJson) as Awaited<
      ReturnType<typeof import("@/lib/cms/load-published-page.server").loadPublishedPageSnapshot>
    >;
    if (result.kind === "redirect") {
      throw redirect({ href: result.toPath, statusCode: result.statusCode });
    }
    // Builtin page — always seeded + published; a missing snapshot means the CMS
    // store is broken, not that the page is legitimately absent.
    if (result.kind !== "snapshot") {
      throw new Error("cms: vacatures/$slug loader must return a snapshot");
    }
    return { snapshot: result.snapshot };
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Vacatures | McCoy Cleaning` },
      {
        name: "description",
        content: "Vacature bij McCoy Cleaning in Twente. Bekijk details en solliciteer.",
      },
    ],
    links: [{ rel: "canonical", href: `/vacatures/${params.slug}` }],
  }),
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
    // #region agent log
    fetch("http://127.0.0.1:7637/ingest/e5fb6361-a078-4df0-a695-d0e399b9e246", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "8f1793" },
      body: JSON.stringify({
        sessionId: "8f1793",
        runId: "pre-fix",
        hypothesisId: "D",
        location: "vacatures.$slug.tsx:VacatureDetailPageBody",
        message: "throw notFound during render (missing vacancy)",
        data: { slug, pageKind: page?.kind ?? null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
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
      <Footer />
    </div>
  );
}
