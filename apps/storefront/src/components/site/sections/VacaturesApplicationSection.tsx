import { useMemo, useState, forwardRef, useRef } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileText,
  PlayCircle,
  Upload,
} from "lucide-react";
import {
  cmsTextOrFallback,
  formFieldPayloadKey,
  normalizeJobs,
  normalizeVacaturesApplicationContent,
  optionPayloadValue,
  resolveJobApplicationFields,
  resolveSafeVideoEmbed,
  resolveVacancyPublicSlug,
  allowLegacyVacancyFallback,
  warnLegacyVacancyFallback,
  slugifyVacancyTitle,
  resolvePublicImageAlt,
  type FormFieldItem,
  type VacaturesApplicationContent,
  type VacaturesMainContent,
} from "@mccoy/cms-schema";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import { SECTION_PAGE_RAIL, SectionSurface } from "@mccoy/cms-renderer";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { useCmsPageForView } from "@/lib/cms/use-cms-page-for-view";
import { useRoutePublishedPage } from "@/lib/cms/route-published-page-context";
import { useI18n } from "@/lib/i18n";
import { submitSiteForm } from "@/lib/forms/submit-client";
import { useClientReady } from "@/lib/use-client-ready";
import { cn } from "@/lib/utils";

function isCmsPlaceholderSrc(src: string | undefined): boolean {
  if (!src) return true;
  return /placeholder/i.test(src);
}

function isFieldRequired(field: FormFieldItem): boolean {
  return field.required ?? (field.type === "name" || field.type === "email");
}

export function VacaturesApplicationSection() {
  const { t } = useI18n();
  const published = useRoutePublishedPage();
  const page = useCmsPageForView("page_vacatures") ?? published;
  const rawApplication = useTypedSectionContent(
    "page_vacatures",
    "vacatures.application",
  ) as VacaturesApplicationContent;
  const rawMain = useTypedSectionContent("page_vacatures", "vacatures.main") as
    | VacaturesMainContent
    | undefined;
  const content = useMemo(
    () =>
      normalizeVacaturesApplicationContent(rawApplication, rawMain?.applicationScope),
    [rawApplication, rawMain?.applicationScope],
  );
  const fields = useMemo(
    () => resolveJobApplicationFields(content.fields),
    [content.fields],
  );

  const clientReady = useClientReady();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRoleIndex, setActiveRoleIndex] = useState(0);
  const [fileNames, setFileNames] = useState<Record<string, string | null>>({});

  const applicationRoles = useMemo(() => {
    if (page?.kind === "builtin") {
      const jobsBlock = page.blocks.find((b) => b.type === "jobs");
      if (jobsBlock) {
        const jobs = normalizeJobs(jobsBlock.data);
        return jobs.vacancies
          .filter((v) => v.visible)
          .map((v) => ({
            id: v.id,
            slug: v.slug?.trim() || resolveVacancyPublicSlug(v),
            title: v.title,
            desc: v.shortDescription || v.department || v.location || "",
          }));
      }
      if (allowLegacyVacancyFallback() && t.jobs.roles.length > 0) {
        warnLegacyVacancyFallback("page_vacatures");
        return t.jobs.roles.map((r, i) => ({
          id: `legacy_${i}`,
          slug: slugifyVacancyTitle(r.title),
          title: r.title,
          desc: r.desc,
        }));
      }
      return [];
    }
    if (allowLegacyVacancyFallback()) {
      return t.jobs.roles.map((r, i) => ({
        id: `legacy_${i}`,
        slug: slugifyVacancyTitle(r.title),
        title: r.title,
        desc: r.desc,
      }));
    }
    return [];
  }, [page, t.jobs.roles]);

  const safeRoleIndex = Math.min(activeRoleIndex, Math.max(0, applicationRoles.length - 1));
  const selectedRole = applicationRoles[safeRoleIndex];
  const activeVacancyId = selectedRole?.id ?? "";
  const activeVacancySlug = selectedRole?.slug ?? "";
  const activeRoleTitle = selectedRole?.title ?? "";

  const formEyebrow = cmsTextOrFallback(content.formEyebrow, t.jobs.formTitle);
  const formIntro = cmsTextOrFallback(content.formIntro, t.jobs.formSub);
  const mediaEyebrow = cmsTextOrFallback(content.mediaEyebrow, t.jobs.videoTitle);
  const mediaHeading = cmsTextOrFallback(content.mediaHeading, t.jobs.videoSub);
  const mediaBadge = content.mediaBadge?.trim() || "McCoy on Facebook";
  const mediaLinkLabel = content.mediaLinkLabel?.trim() || "Open op Facebook";

  const media = content.media;
  const videoEmbed =
    media.kind === "video" ? resolveSafeVideoEmbed(media.videoUrl) : null;

  return (
    <section
      id="apply"
      className={cn(SECTION_PAGE_RAIL, "mt-16 pb-24")}
      data-cms-section="vacatures.application"
    >
      <div className="grid gap-8 lg:grid-cols-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-7"
        >
          <SectionSurface variant="form" className="p-7 md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {formEyebrow}
            </p>
            <h2 className="font-display mt-3 text-3xl text-foreground md:text-4xl">
              {activeRoleTitle}
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{formIntro}</p>

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
                  const result = await submitSiteForm({
                    kind: "job_application",
                    pageId: "page_vacatures",
                    sourceId: FIXED_FORM_SOURCE_IDS.vacaturesApplication,
                    form: e.currentTarget,
                    extras: {
                      vacancyId: activeVacancyId,
                      vacancySlug: activeVacancySlug,
                      vacancyTitleSnapshot: activeRoleTitle,
                      role: activeRoleTitle,
                    },
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
                          {active ? (
                            <motion.span
                              layoutId="role-glow"
                              className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full bg-primary/30 blur-2xl"
                              transition={{ type: "spring", stiffness: 220, damping: 30 }}
                            />
                          ) : null}
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

                {fields.map((field) => (
                  <JobApplicationField
                    key={field.id}
                    field={field}
                    fileName={fileNames[formFieldPayloadKey(field)] ?? null}
                    onPickFile={(name) =>
                      setFileNames((prev) => ({
                        ...prev,
                        [formFieldPayloadKey(field)]: name,
                      }))
                    }
                    pickLabel={t.jobs.cvPick}
                  />
                ))}

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

        <motion.aside
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="lg:col-span-5"
        >
          <div className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {mediaEyebrow}
            </p>
            <h3 className="font-display mt-3 text-2xl text-white md:text-3xl">
              {mediaHeading}
            </h3>
            <div className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-background/60">
              {media.kind === "video" && videoEmbed?.ok ? (
                <>
                  {mediaBadge ? (
                    <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                      <PlayCircle className="h-3.5 w-3.5 text-primary" /> {mediaBadge}
                    </div>
                  ) : null}
                  <iframe
                    src={videoEmbed.embedUrl}
                    title={mediaEyebrow || "McCoy Cleaning video"}
                    className="aspect-video w-full"
                    style={{ border: "none", overflow: "hidden" }}
                    scrolling="no"
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </>
              ) : media.kind === "image" &&
                media.image?.src &&
                !isCmsPlaceholderSrc(media.image.src) ? (
                <img
                  src={media.image.src}
                  alt={resolvePublicImageAlt(media.image, mediaEyebrow || "McCoy Cleaning")}
                  className="aspect-video w-full bg-black/35 object-contain object-center"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-background/80 text-sm text-white/40">
                  Media niet beschikbaar
                </div>
              )}
            </div>
            {media.kind === "video" && media.shareUrl?.trim() ? (
              <a
                href={media.shareUrl.trim()}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                {mediaLinkLabel} <ArrowRight className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </motion.aside>
      </div>
    </section>
  );
}

function JobApplicationField({
  field,
  fileName,
  onPickFile,
  pickLabel,
}: {
  field: FormFieldItem;
  fileName: string | null;
  onPickFile: (name: string | null) => void;
  pickLabel: string;
}) {
  const key = formFieldPayloadKey(field);
  const required = isFieldRequired(field);
  const id = `vacatures-${key}-${field.id}`;
  const label = field.label.trim() || key;

  if (field.type === "file") {
    const Icon = key === "letter" ? Upload : FileText;
    return (
      <FileDrop
        label={label}
        icon={Icon}
        name={key}
        required={required}
        fileName={fileName}
        onPick={(f) => onPickFile(f?.name ?? null)}
        pick={pickLabel}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="sm:col-span-2">
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
        >
          {label}
          {required ? <span className="ml-1 text-primary">*</span> : null}
        </label>
        <textarea
          id={id}
          name={key}
          rows={5}
          required={required}
          maxLength={1000}
          className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
        />
      </div>
    );
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    return (
      <div className="sm:col-span-2">
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
        >
          {label}
          {required ? <span className="ml-1 text-primary">*</span> : null}
        </label>
        <select
          id={id}
          name={key}
          required={required}
          className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white outline-none transition focus:border-primary"
          defaultValue=""
        >
          <option value="">{required ? "Maak een keuze…" : "—"}</option>
          {options.map((option) => (
            <option key={option.id} value={optionPayloadValue(option)}>
              {option.label.trim() || optionPayloadValue(option)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const inputType =
    field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";

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
        type={inputType}
        name={key}
        required={required}
        maxLength={255}
        autoComplete={
          field.type === "name"
            ? "name"
            : field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : field.type === "company"
                  ? "organization"
                  : undefined
        }
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

type FileDropProps = {
  label: string;
  pick: string;
  name: string;
  required?: boolean;
  fileName: string | null;
  onPick: (f: File | null) => void;
  icon: React.ComponentType<{ className?: string }>;
};

const FileDrop = forwardRef<HTMLInputElement, FileDropProps>(function FileDrop(
  { label, pick, name, required, fileName, onPick, icon: Icon },
  ref,
) {
  const localRef = useRef<HTMLInputElement>(null);
  return (
    <div className="sm:col-span-1">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </label>
      <label className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-background/40 px-4 py-3 transition hover:border-primary/60 hover:bg-primary/5">
        <Icon className="h-4 w-4 text-primary" />
        <span className="flex-1 truncate text-sm text-white/70">{fileName ?? pick}</span>
        <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
          .pdf .doc
        </span>
        <input
          ref={ref ?? localRef}
          type="file"
          name={name}
          required={required}
          accept=".pdf,.doc,.docx"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
    </div>
  );
});
