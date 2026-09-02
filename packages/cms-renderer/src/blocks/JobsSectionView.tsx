import * as React from "react";
import {
  createDefaultVacancy,
  describeCmsLink,
  formatHourlyRateNl,
  formatHoursPerWeekNl,
  linkRel,
  linkTarget,
  normalizeJobs,
  resolveCmsLinkHref,
  resolveEmploymentTypeLabel,
  VACANCY_CARD_LABELS_NL,
  type JobsBlockData,
  type VacancyItem,
} from "@mccoy/cms-schema";

import { SECTION_GRID } from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionHeader, SectionSurface } from "../sectionChromeUi";
import {
  CmsListAddButton,
  CmsListRemoveButton,
  EditableText,
  useCmsTypedListEditor,
} from "../edit-surface";

export type JobsRenderMode = "preview" | "storefront";

export type JobsSectionViewProps = {
  data: unknown;
  pages?: Array<{ id: string; slug: string; title?: string }>;
  mode?: JobsRenderMode;
  /** When true (admin/preview), include hidden vacancies with a badge. */
  showHidden?: boolean;
};

function EditableStringList({
  pathPrefix,
  headingPath,
  items,
  editing,
  heading,
  addLabel,
  newItemText,
  onChange,
}: {
  pathPrefix: string;
  headingPath: string;
  items: string[];
  editing: boolean;
  heading: string;
  addLabel: string;
  newItemText: string;
  onChange: (next: string[]) => void;
}) {
  if (!items.length && !editing) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
        <EditableText path={headingPath} value={heading}>
          {heading}
        </EditableText>
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((text, itemIndex) => (
          <li key={`${pathPrefix}.${itemIndex}`} className="relative break-words pr-16">
            <EditableText path={`${pathPrefix}.${itemIndex}`} value={text} multiline>
              {text}
            </EditableText>
            {editing ? (
              <CmsListRemoveButton
                label={`${heading} verwijderen: ${text || `item ${itemIndex + 1}`}`}
                className="right-0 top-0"
                onRemove={() => onChange(items.filter((_, i) => i !== itemIndex))}
              />
            ) : null}
          </li>
        ))}
      </ul>
      {editing ? (
        <CmsListAddButton
          compact
          label={addLabel}
          onAdd={() => onChange([...items, newItemText])}
        />
      ) : null}
    </div>
  );
}

function VacancyCard({
  vacancy,
  index,
  pages,
  mode,
  layout,
  editing,
  onRemove,
  onChangeVacancy,
}: {
  vacancy: VacancyItem;
  index: number;
  pages: Array<{ id: string; slug: string; title?: string }>;
  mode: JobsRenderMode;
  layout: "cards" | "list";
  editing: boolean;
  onRemove?: () => void;
  onChangeVacancy?: (next: VacancyItem) => void;
}) {
  const linkPages = pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title ?? p.slug }));
  const href = resolveCmsLinkHref(vacancy.applicationLink, linkPages);
  const rate = formatHourlyRateNl(vacancy.hourlyRate);
  const hours = formatHoursPerWeekNl(vacancy.hoursPerWeek);
  const employmentLabel = resolveEmploymentTypeLabel(vacancy.employmentType);
  // Compact meta line (department / location / hours / rate) — employment is the badge.
  const meta = [
    vacancy.department,
    vacancy.location,
    hours,
    rate,
    !rate ? vacancy.salaryText : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const linkHint = describeCmsLink(vacancy.applicationLink, linkPages);

  const detailsHeading = vacancy.detailsHeading?.trim() || VACANCY_CARD_LABELS_NL.details;
  const benefitsHeading = vacancy.benefitsHeading?.trim() || VACANCY_CARD_LABELS_NL.offer;
  const requirementsHeading =
    vacancy.requirementsHeading?.trim() || VACANCY_CARD_LABELS_NL.lookingFor;

  const buttonLabel = vacancy.buttonLabel || "Solliciteer";
  const applyLabel = (
    <EditableText path={`vacancies.${index}.buttonLabel`} value={vacancy.buttonLabel || "Solliciteer"}>
      {buttonLabel}
    </EditableText>
  );

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
          {applyLabel}
        </button>
      ) : (
        <a
          href={href}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          target={linkTarget(vacancy.applicationLink)}
          rel={linkRel(vacancy.applicationLink)}
        >
          {applyLabel}
        </a>
      )
    ) : editing ? (
      <span className="rounded-full border border-dashed border-white/20 px-4 py-2 text-xs font-semibold text-white/55">
        {applyLabel}
      </span>
    ) : null;

  const patchList = (key: "requirements" | "benefits", next: string[]) => {
    if (!onChangeVacancy) return;
    const cleaned = next.map((s) => s.trim()).filter(Boolean);
    onChangeVacancy({
      ...vacancy,
      [key]: cleaned.length ? cleaned : undefined,
    });
  };

  return (
    <SectionSurface
      variant={layout === "cards" ? "elevated" : "outlined"}
      className={
        layout === "cards"
          ? "relative flex flex-col p-5"
          : "relative flex flex-wrap items-start justify-between gap-4 p-4"
      }
    >
      {editing && onRemove ? (
        <CmsListRemoveButton
          label={`Vacature verwijderen: ${vacancy.title}`}
          onRemove={onRemove}
        />
      ) : null}
      <div className="min-w-0 flex-1 space-y-3">
        {/* 1. Title + employment badge */}
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">
            <EditableText path={`vacancies.${index}.title`} value={vacancy.title}>
              {vacancy.title}
            </EditableText>
          </h3>
          {employmentLabel || editing ? (
            <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <EditableText path={`vacancies.${index}.employmentType`} value={employmentLabel}>
                {employmentLabel}
              </EditableText>
            </span>
          ) : null}
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

        {/* Compact meta (not a numbered content section) */}
        {editing ? (
          <p className="text-xs text-muted-foreground">
            <EditableText path={`vacancies.${index}.department`} value={vacancy.department ?? ""}>
              {vacancy.department ?? ""}
            </EditableText>
            {vacancy.department || vacancy.location ? " · " : null}
            <EditableText path={`vacancies.${index}.location`} value={vacancy.location}>
              {vacancy.location}
            </EditableText>
            {hours ? ` · ${hours}` : null}
            {rate ? ` · ${rate}` : null}
            {!rate && vacancy.salaryText ? (
              <>
                {" · "}
                <EditableText path={`vacancies.${index}.salaryText`} value={vacancy.salaryText}>
                  {vacancy.salaryText}
                </EditableText>
              </>
            ) : null}
          </p>
        ) : meta ? (
          <p className="text-xs text-muted-foreground">{meta}</p>
        ) : null}

        {/* 2. Details (plain text, not bullets) */}
        {vacancy.shortDescription || editing ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              <EditableText path={`vacancies.${index}.detailsHeading`} value={detailsHeading}>
                {detailsHeading}
              </EditableText>
            </p>
            <p className="text-sm leading-relaxed text-white/70">
              <EditableText
                path={`vacancies.${index}.shortDescription`}
                // Canvas Wysiwyg uses `value` only (ignores children) — keep a visible
                // prompt under DETAILS when the field is still empty in edit mode.
                value={
                  vacancy.shortDescription.trim()
                    ? vacancy.shortDescription
                    : editing
                      ? "Beschrijf hier de functie en het werk."
                      : ""
                }
                multiline
              >
                {vacancy.shortDescription || (editing ? "Beschrijf hier de functie en het werk." : "")}
              </EditableText>
            </p>
          </div>
        ) : null}

        {/* 3. Wat wij bieden · 4. Wat wij zoeken */}
        <div className="space-y-3 text-sm text-white/70">
          <EditableStringList
            pathPrefix={`vacancies.${index}.benefits`}
            headingPath={`vacancies.${index}.benefitsHeading`}
            items={vacancy.benefits ?? []}
            editing={editing}
            heading={benefitsHeading}
            addLabel="Punt toevoegen"
            newItemText="Nieuw punt"
            onChange={(next) => patchList("benefits", next)}
          />
          <EditableStringList
            pathPrefix={`vacancies.${index}.requirements`}
            headingPath={`vacancies.${index}.requirementsHeading`}
            items={vacancy.requirements ?? []}
            editing={editing}
            heading={requirementsHeading}
            addLabel="Punt toevoegen"
            newItemText="Nieuw punt"
            onChange={(next) => patchList("requirements", next)}
          />
        </div>

        {vacancy.applicationDeadline ? (
          <p className="text-xs text-muted-foreground">
            Solliciteren tot{" "}
            {new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(
              new Date(vacancy.applicationDeadline),
            )}
          </p>
        ) : null}
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
  const list = useCmsTypedListEditor<VacancyItem>("vacancies");
  const editing = list.editing;
  const [locationFilter, setLocationFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");

  const indexById = React.useMemo(() => {
    const map = new Map<string, number>();
    jobs.vacancies.forEach((v, i) => map.set(v.id, i));
    return map;
  }, [jobs.vacancies]);

  const patchVacancy = React.useCallback(
    (next: VacancyItem) => {
      list.patchList(jobs.vacancies.map((v) => (v.id === next.id ? next : v)));
    },
    [jobs.vacancies, list],
  );

  let vacancies =
    showHidden || editing ? [...jobs.vacancies] : jobs.vacancies.filter((v) => v.visible);
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
  if (jobs.showFilters && !editing) {
    if (locationFilter) {
      vacancies = vacancies.filter((v) => v.location.toLowerCase().includes(locationFilter.toLowerCase()));
    }
    if (typeFilter) {
      vacancies = vacancies.filter(
        (v) => resolveEmploymentTypeLabel(v.employmentType).toLowerCase() === typeFilter.toLowerCase(),
      );
    }
  }

  const locations = [...new Set(jobs.vacancies.map((v) => v.location).filter(Boolean))].sort();
  const employmentOptions = [
    ...new Set(
      jobs.vacancies
        .map((v) => resolveEmploymentTypeLabel(v.employmentType))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "nl"));
  const emptyCopy = jobs.emptyStateText || "Er zijn momenteel geen openstaande vacatures.";

  return (
    <SectionShell blockType="jobs">
      <SectionHeader
        title={
          <EditableText path="heading" value={jobs.heading}>
            {jobs.heading}
          </EditableText>
        }
        body={
          jobs.introduction || editing ? (
            <EditableText path="introduction" value={jobs.introduction ?? ""} multiline>
              {jobs.introduction ?? ""}
            </EditableText>
          ) : undefined
        }
        className="mb-10 sm:mb-14"
      />

      {jobs.showFilters && !editing ? (
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
              {employmentOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {vacancies.length === 0 && !editing ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-sm text-white/50">
          <EditableText path="emptyStateText" value={emptyCopy} multiline>
            {emptyCopy}
          </EditableText>
        </p>
      ) : (
        <>
          {editing && vacancies.length === 0 ? (
            <p className="mb-4 rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-white/50">
              <EditableText path="emptyStateText" value={emptyCopy} multiline>
                {emptyCopy}
              </EditableText>
            </p>
          ) : null}
          {jobs.displayMode === "list" ? (
            <ul className="space-y-3">
              {vacancies.map((v) => (
                <li key={v.id}>
                  <VacancyCard
                    vacancy={v}
                    index={indexById.get(v.id) ?? 0}
                    pages={pages}
                    mode={mode}
                    layout="list"
                    editing={editing}
                    onRemove={editing ? () => list.removeById(jobs.vacancies, v.id) : undefined}
                    onChangeVacancy={editing ? patchVacancy : undefined}
                  />
                </li>
              ))}
              {editing ? (
                <li>
                  <CmsListAddButton
                    label="Vacature toevoegen"
                    onAdd={() => list.append(jobs.vacancies, createDefaultVacancy())}
                  />
                </li>
              ) : null}
            </ul>
          ) : (
            <div className={`${SECTION_GRID} items-start sm:grid-cols-2`}>
              {vacancies.map((v) => (
                <VacancyCard
                  key={v.id}
                  vacancy={v}
                  index={indexById.get(v.id) ?? 0}
                  pages={pages}
                  mode={mode}
                  layout="cards"
                  editing={editing}
                  onRemove={editing ? () => list.removeById(jobs.vacancies, v.id) : undefined}
                  onChangeVacancy={editing ? patchVacancy : undefined}
                />
              ))}
              {editing ? (
                <CmsListAddButton
                  label="Vacature toevoegen"
                  onAdd={() => list.append(jobs.vacancies, createDefaultVacancy())}
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </SectionShell>
  );
}
