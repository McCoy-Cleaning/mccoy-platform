import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, forwardRef } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Briefcase,
  Upload,
  FileText,
  PlayCircle,
} from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useI18n } from "@/lib/i18n";
import teamFoto from "@/assets/foto_voetbalteam_mccoy.jpg.asset.json";

const facebookVideoUrl = "https://www.facebook.com/McCoyCleaning/videos/4269581773264540/";
const facebookShareUrl = "https://www.facebook.com/share/v/1E8ftFTuKV/";

export const Route = createFileRoute("/vacatures")({
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
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [activeRole, setActiveRole] = useState(0);
  const cvRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLInputElement>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [letterName, setLetterName] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
        {/* hero */}
        <section className="relative px-4 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute -top-20 right-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t.jobs.kicker}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.7 }}
              className="font-display mt-6 max-w-3xl text-5xl text-white md:text-7xl"
            >
              {t.jobs.title}
            </motion.h1>
            <p className="mt-5 max-w-2xl font-bold text-white/65">{t.jobs.sub}</p>
          </div>
        </section>

        {/* team culture — football */}
        <section className="relative mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="grid items-center gap-8 overflow-hidden rounded-[2rem] border border-white/10 bg-card/60 lg:grid-cols-2"
          >
            <div className="p-6 sm:p-10 lg:order-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t.jobs.teamTitle}
              </p>
              <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">
                {t.jobs.teamTitle}
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                {t.jobs.teamText}
              </p>
            </div>
            <div className="relative lg:order-1">
              <img
                src={teamFoto.url}
                alt="McCoy Cleaning voetbalteam"
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/10] lg:aspect-auto lg:h-full"
                loading="lazy"
              />
            </div>
          </motion.div>
        </section>

        {/* application + video grid */}
        <section id="apply" className="mx-auto mt-16 max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12">
            {/* form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-[2rem] border border-white/10 bg-card/60 p-7 md:p-10 lg:col-span-7"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t.jobs.formTitle}
              </p>
              <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">
                {t.jobs.roles[activeRole].title}
              </h2>
              <p className="mt-2 text-sm text-white/60">{t.jobs.formSub}</p>

              {sent ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                  <p className="font-display text-2xl text-white">{t.jobs.success}</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSent(true);
                  }}
                  className="mt-8 grid gap-4 sm:grid-cols-2"
                >
                  {/* role picker as small animated cards inside the form */}
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/60">
                      {t.jobs.role}
                    </label>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {t.jobs.roles.map((r, i) => {
                        const active = activeRole === i;
                        return (
                          <motion.button
                            type="button"
                            key={r.title}
                            onClick={() => setActiveRole(i)}
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
                  <button
                    type="submit"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] sm:col-span-2"
                  >
                    {t.jobs.submit}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </button>
                </form>
              )}
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
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <input
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
