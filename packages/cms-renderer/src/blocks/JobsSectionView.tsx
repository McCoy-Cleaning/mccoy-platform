import * as React from "react";
import {
  describeCmsLink,
  EMPLOYMENT_TYPE_LABELS_NL,
  formatHourlyRateNl,
  formatHoursPerWeekNl,
  linkRel,
  linkTarget,
  normalizeJobs,
  resolveCmsLinkHref,
  type JobsBlockData,
  type VacancyItem,
} from "@mccoy/cms-schema";

import { SECTION_GRID } from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionHeader, SectionSurface } from "../sectionChromeUi";

export type JobsRenderMode = "preview" | "storefront";

export type JobsSectionViewProps = {
  data: unknown;
  pages?: Array<{ id: string; slug: string; title?: string }>;
  mode?: JobsRenderMode;
  /** When true (admin/preview), include hidden vacancies with a badge. */
  showHidden?: boolean;
};

function VacancyCard({
  vacancy,
  pages,
  mode,
  layout,
}: {
  vacancy: VacancyItem;
  pages: Array<{ id: string; slug: string; title?: string }>;
  mode: JobsRenderMode;
  layout: "cards" | "list";
}) {
  const [open, setOpen] = React.useState(false);
  const linkPages = pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title ?? p.slug }));
  const href = resolveCmsLinkHref(vacancy.applicationLink, linkPages);
  const rate = formatHourlyRateNl(vacancy.hourlyRate);
  const hours = formatHoursPerWeekNl(vacancy.hoursPerWeek);
  const meta = [
    vacancy.department,
    vacancy.location,
    EMPLOYMENT_TYPE_LABELS_NL[vacancy.employmentType],
  ]
    .filter(Boolean)
    .join(" · ");
  const linkHint = describeCmsLink(vacancy.applicationLink, linkPages);

  // Geen link → no clickable apply chrome (detail page remains available via listing slug routes).
  const applyControl =
    href && vacancy.applicationLink.type !== "none" ? (
      mode === "preview" ? (
        <button
          type="button"
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          title={`Bestemming: ${linkHint}`}
          onClick={(e) => e.preventDefault()}
        >
          {vacancy.buttonLabel || "Solliciteer"}
        </button>
      ) : (
        <a
          href={href}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          target={linkTarget(vacancy.applicationLink)}
          rel={linkRel(vacancy.applicationLink)}
        >
          {vacancy.buttonLabel || "Solliciteer"}
        </a>
      )
    ) : null;

  const details =
    vacancy.fullDescription ||
    vacancy.startDate ||
    vacancy.contactName ||
    vacancy.contactEmail ||
    vacancy.contactPhone ||
    (vacancy.responsibilities?.length ?? 0) > 0 ||
    (vacancy.requirements?.length ?? 0) > 0 ||
    (vacancy.benefits?.length ?? 0) > 0 ? (
      <div className="mt-3">
        <button
          type="button"
          className="text-xs font-semibold text-primary hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Minder details" : "Meer details"}
        </button>
        {open ? (
          <div className="mt-3 space-y-3 text-sm text-white/70">
            {vacancy.fullDescription ? <p className="whitespace-pre-wrap">{vacancy.fullDescription}</p> : null}
            {vacancy.startDate ? (
              <p className="text-xs text-white/55">
                Startdatum{" "}
                {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(
                  new Date(vacancy.startDate),
                )}
              </p>
            ) : null}
            {vacancy.contactName || vacancy.contactEmail || vacancy.contactPhone ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Contact</p>
                <ul className="mt-1 space-y-0.5 text-sm text-white/70">
                  {vacancy.contactName ? <li>{vacancy.contactName}</li> : null}
                  {vacancy.contactEmail ? (
                    <li>
                      <a className="text-primary hover:underline" href={`mailto:${vacancy.contactEmail}`}>
                        {vacancy.contactEmail}
                      </a>
                    </li>
                  ) : null}
                  {vacancy.contactPhone ? (
                    <li>
                      <a className="text-primary hover:underline" href={`tel:${vacancy.contactPhone}`}>
                        {vacancy.contactPhone}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {vacancy.responsibilities?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Verantwoordelijkheden</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {vacancy.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vacancy.requirements?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Eisen</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {vacancy.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {vacancy.benefits?.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Arbeidsvoorwaarden</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {vacancy.benefits.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <SectionSurface
      variant={layout === "cards" ? "elevated" : "outlined"}
      className={
        layout === "cards"
          ? "flex flex-col p-5"
          : "flex flex-wrap items-start justify-between gap-4 p-4"
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{vacancy.title}</h3>
          {vacancy.featured ? (
            <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              Uitgelicht
            </span>
          ) : null}
          {!vacancy.visible ? (
            <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              Verborgen
            </span>
          ) : null}
        </div>
        {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
        {hours ? <p className="mt-1 text-xs text-muted-foreground">{hours}</p> : null}
        {rate ? <p className="mt-0.5 text-xs font-medium text-foreground/90">{rate}</p> : null}
        {vacancy.salaryText && !rate ? (
          <p className="mt-0.5 text-xs font-medium text-foreground/90">{vacancy.salaryText}</p>
        ) : null}
        {vacancy.shortDescription ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{vacancy.shortDescription}</p>
        ) : null}
        {vacancy.applicationDeadline ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Solliciteren tot{" "}
            {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(
              new Date(vacancy.applicationDeadline),
            )}
          </p>
        ) : null}
        {details}
      </div>
      {applyControl ? <div className={layout === "cards" ? "mt-4" : "shrink-0"}>{applyControl}</div> : null}
    </SectionSurface>
  );
}

export function JobsSectionView({
  data,
  pages = [],
  mode = "storefront",
  showHidden = false,
}: JobsSectionViewProps) {
  const jobs: JobsBlockData = normalizeJobs(data);
  const [locationFilter, setLocationFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");

  let vacancies = showHidden ? [...jobs.vacancies] : jobs.vacancies.filter((v) => v.visible);
  // Featured first, then stable relative order within each group (array order).
  vacancies = vacancies
    .map((v, index) => ({ v, index }))
    .sort((a, b) => {
      const af = a.v.featured ? 0 : 1;
      const bf = b.v.featured ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.index - b.index;
    })
    .map(({ v }) => v);
  if (jobs.showFilters) {
    if (locationFilter) {
      vacancies = vacancies.filter((v) => v.location.toLowerCase().includes(locationFilter.toLowerCase()));
    }
    if (typeFilter) {
      vacancies = vacancies.filter((v) => v.employmentType === typeFilter);
    }
  }

  const locations = [...new Set(jobs.vacancies.map((v) => v.location).filter(Boolean))].sort();

  return (
    <SectionShell blockType="jobs">
      <SectionHeader
        title={jobs.heading}
        body={jobs.introduction || undefined}
        className="mb-10 sm:mb-14"
      />

      {jobs.showFilters ? (
        <div className="mb-10 flex flex-wrap gap-3 sm:mb-14">
          <label className="text-xs text-white/50">
            Locatie
            <select
              className="ml-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-white/50">
            Dienstverband
            <select
              className="ml-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {Object.entries(EMPLOYMENT_TYPE_LABELS_NL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {vacancies.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-sm text-white/50">
          {jobs.emptyStateText || "Er zijn momenteel geen openstaande vacatures."}
        </p>
      ) : jobs.displayMode === "list" ? (
        <ul className="space-y-3">
          {vacancies.map((v) => (
            <li key={v.id}>
              <VacancyCard vacancy={v} pages={pages} mode={mode} layout="list" />
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${SECTION_GRID} items-start sm:grid-cols-2`}>
          {vacancies.map((v) => (
            <VacancyCard key={v.id} vacancy={v} pages={pages} mode={mode} layout="cards" />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
