import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useRef, forwardRef, useMemo } from "react";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Briefcase, Upload, FileText, PlayCircle } from "lucide-react";
import {
  normalizeJobs,
  allowLegacyVacancyFallback,
  warnLegacyVacancyFallback,
} from "@mccoy/cms-schema";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { pageSectionRenderers } from "@/components/site/pageSectionRenderers";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { RoutePublishedPageProvider } from "@/lib/cms/route-published-page-context";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { useI18n } from "@/lib/i18n";
import { submitSiteForm } from "@/lib/forms/submit-client";
import { useClientReady } from "@/lib/use-client-ready";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import { SECTION_PAGE_RAIL, SectionSurface } from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

const facebookVideoUrl = "https://www.facebook.com/McCoyCleaning/videos/4269581773264540/";
const facebookShareUrl = "https://www.facebook.com/share/v/1E8ftFTuKV/";

export const Route = createFileRoute("/vacatures")({
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
      throw new Error("cms: vacatures loader must return a snapshot");
    }
    return { snapshot: result.snapshot };
  },
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
      { rel: "alternate", hrefLang: "en", href: "/en/jobs" },
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
  const { t } = useI18n();
  // Prefer the SSR-resolved loader snapshot over the client-only CMS seed store so
  // the first client render matches the server HTML (avoids hydration mismatch).
  const page = useCmsPageForView("page_vacatures") ?? snapshot.page;
  const { mode } = useEdit();
  const editing = mode === "edit";
  const clientReady = useClientReady();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const cvRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [letterName, setLetterName] = useState<string | null>(null);

  const applicationRoles = useMemo(() => {
    if (page?.kind === "builtin") {
      const jobsBlock = page.blocks.find((b) => b.type === "jobs");
      // Do not fall back when a jobs block exists but vacancies are empty/hidden.
      if (jobsBlock) {
        const jobs = normalizeJobs(jobsBlock.data);
        return jobs.vacancies
          .filter((v) => v.visible)
          .map((v) => ({
            id: v.id,
            title: v.title,
            desc: v.shortDescription || v.department || v.location || "",
          }));
      }
      // Default seeds always include a jobs block via ensureVacaturesJobsBlock.
      // Legacy static roles only when explicitly gated for older environments.
      if (allowLegacyVacancyFallback() && t.jobs.roles.length > 0) {
        warnLegacyVacancyFallback("page_vacatures");
        return t.jobs.roles.map((r, i) => ({
          id: `legacy_${i}`,
          title: r.title,
          desc: r.desc,
        }));
      }
      return [];
    }
    if (allowLegacyVacancyFallback()) {
      return t.jobs.roles.map((r, i) => ({
        id: `legacy_${i}`,
        title: r.title,
        desc: r.desc,
      }));
    }
    return [];
  }, [page, t.jobs.roles]);

  const safeRoleIndex = Math.min(activeRoleIndex, Math.max(0, applicationRoles.length - 1));
  const selectedRole = applicationRoles[safeRoleIndex];
  const activeVacancyId = selectedRole?.id ?? "";
  const activeRoleTitle = selectedRole?.title ?? "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
        {/* CMS-managed chrome (eyebrow/heading/body) */}
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

        {/* application + video grid */}
        <section id="apply" className={cn(SECTION_PAGE_RAIL, "mt-16 pb-24")}>
          <div className="grid gap-8 lg:grid-cols-12">
            {/* form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              <SectionSurface variant="form" className="p-7 md:p-10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {t.jobs.formTitle}
                </p>
                <h2 className="font-display mt-3 text-3xl text-foreground md:text-4xl">
                  {activeRoleTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{t.jobs.formSub}</p>

                {sent ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                    <p className="font-display text-2xl text-white">{t.jobs.success}</p>
                  </div>
                ) : (
                  <form
                    data-testid={clientReady ? "site-form-ready" : "site-form-pending"}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!clientReady || submitting) return;
                      setSubmitting(true);
                      setError(null);
                      const extraFiles: File[] = [];
                      const cv = cvRef.current?.files?.[0];
                      const letter = letterRef.current?.files?.[0];
                      if (cv) extraFiles.push(cv);
                      if (letter) extraFiles.push(letter);
                      const result = await submitSiteForm({
                        kind: "job_application",
                        pageId: "page_vacatures",
                        sourceId: FIXED_FORM_SOURCE_IDS.vacaturesApplication,
                        form: e.currentTarget,
                        extras: {
                          vacancyId: activeVacancyId,
                          vacancyTitleSnapshot: activeRoleTitle,
                          // Legacy display field for email templates; server prefers vacancyId.
                          role: activeRoleTitle,
                        },
                        extraFiles,
                      });
                      setSubmitting(false);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setSent(true);
                    }}
                    className="mt-8 grid gap-4 sm:grid-cols-2"
                  >
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="absolute -left-[9999px] h-0 w-0 opacity-0"
                    />
                    {/* role picker as small animated cards inside the form */}
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60">
                        {t.jobs.role}
                      </label>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {applicationRoles.map((r, i) => {
                          const active = safeRoleIndex === i;
                          return (
                            <motion.button
                              type="button"
                              key={r.id}
                              onClick={() => setActiveRoleIndex(i)}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              transition={{ type: "spring", stiffness: 320, damping: 24 }}
                              className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${
                                active
                                  ? "border-primary/60 bg-primary/10"
                                  : "border-white/10 bg-background/40 hover:border-primary/40"
                              }`}
                            >
                              {active && (
                                <motion.span
                                  layoutId="role-glow"
                                  className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-primary/30 blur-2xl"
                                  transition={{ type: "spring", stiffness: 220, damping: 30 }}
                                />
                              )}
                              <div className="relative flex items-center gap-2.5">
                                <span
                                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition ${
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-primary/15 text-primary"
                                  }`}
                                >
                                  <Briefcase className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 font-display text-sm leading-tight text-white">
                                  {r.title}
                                </span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <Field label={t.contact.name} name="name" required />
                    <Field label={t.contact.email} name="email" type="email" required />
                    <Field label={t.contact.phone} name="phone" type="tel" />

                    <FileDrop
                      label={t.jobs.cv}
                      icon={FileText}
                      name="cv"
                      ref={cvRef}
                      fileName={cvName}
                      onPick={(f) => setCvName(f?.name ?? null)}
                      pick={t.jobs.cvPick}
                    />
                    <FileDrop
                      label={t.jobs.letter}
                      icon={Upload}
                      name="letter"
                      ref={letterRef}
                      fileName={letterName}
                      onPick={(f) => setLetterName(f?.name ?? null)}
                      pick={t.jobs.cvPick}
                    />

                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
                        {t.jobs.motivation}
                      </label>
                      <textarea
                        name="motivation"
                        rows={5}
                        maxLength={1000}
                        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
                      />
                    </div>
                    {error ? (
                      <p
                        className="sm:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={!clientReady || submitting}
                      aria-disabled={!clientReady || submitting}
                      className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
                    >
                      {submitting ? "..." : t.jobs.submit}
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </button>
                  </form>
                )}
              </SectionSurface>
            </motion.div>

            {/* video */}
            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-5"
            >
              <div className="sticky top-28">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  {t.jobs.videoTitle}
                </p>
                <h3 className="font-display mt-3 text-2xl text-white md:text-3xl">
                  {t.jobs.videoSub}
                </h3>
                <div className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-background/60">
                  <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                    <PlayCircle className="h-3.5 w-3.5 text-primary" /> McCoy on Facebook
                  </div>
                  <iframe
                    src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(facebookVideoUrl)}&show_text=false&width=560&height=315`}
                    title="McCoy Cleaning — Facebook video"
                    className="aspect-video w-full"
                    style={{ border: "none", overflow: "hidden" }}
                    scrolling="no"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
                <a
                  href={facebookShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Open op Facebook <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            </motion.aside>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  const id = `vacatures-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
      >
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        maxLength={255}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

type FileDropProps = {
  label: string;
  pick: string;
  name: string;
  fileName: string | null;
  onPick: (f: File | null) => void;
  icon: React.ComponentType<{ className?: string }>;
};

const FileDrop = forwardRef<HTMLInputElement, FileDropProps>(function FileDrop(
  { label, pick, name, fileName, onPick, icon: Icon },
  ref,
) {
  return (
    <div className="sm:col-span-1">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <label className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-background/40 px-4 py-3 transition hover:border-primary/60 hover:bg-primary/5">
        <Icon className="h-4 w-4 text-primary" />
        <span className="flex-1 truncate text-sm text-white/70">{fileName ?? pick}</span>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
          .pdf .doc
        </span>
        <input
          ref={ref}
          type="file"
          name={name}
          accept=".pdf,.doc,.docx"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
    </div>
  );
});
