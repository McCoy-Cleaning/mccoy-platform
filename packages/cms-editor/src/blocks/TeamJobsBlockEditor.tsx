import * as React from "react";
import {
  createDefaultVacancy,
  createItemId,
  EMPLOYMENT_TYPE_LABELS_NL,
  EMPLOYMENT_TYPES,
  type CmsImage,
  type CmsLink,
  type EmploymentType,
  type JobsBlockData,
  type VacancyItem,
} from "@mccoy/cms-schema";
import { ObjectListEditor } from "./ObjectListEditor";
import { StructuredLinkField, PAGE_DESTINATION_LINK_KINDS } from "./StructuredLinkField";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { BlockImageField, EmptyHint, Field, Section, inputClass, selectClass } from "./shared-fields";

function PlainStringList({
  items,
  onChange,
  addLabel,
  enPathPrefix,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  /** e.g. `block:{id}:vacancies.0.responsibilities` → `.0`, `.1`, … */
  enPathPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((text, index) => (
        <div key={`${index}-${text.slice(0, 8)}`} className="space-y-1.5">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={text}
              aria-label={`Item ${index + 1}`}
              onChange={(e) => {
                const next = [...items];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-white/12 px-2 text-xs text-white/60 hover:bg-white/10"
              aria-label={`Verwijder item ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
          <EnDraftFor
            fieldPath={enPathPrefix ? `${enPathPrefix}.${index}` : undefined}
            label={`Item ${index + 1}`}
          />
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-medium text-sky-300 hover:text-sky-200"
        onClick={() => onChange([...items, ""])}
      >
        + {addLabel}
      </button>
    </div>
  );
}

export type TeamMember = {
  id: string;
  name: string;
  role?: string;
  bio?: string;
  photo?: CmsImage;
};

export type TeamGridBlockData = {
  title: string;
  members: TeamMember[];
};

export function TeamGridBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: TeamGridBlockData;
  onChange: (next: TeamGridBlockData) => void;
  presentation?: string;
  blockId?: string;
} & CmsImagePickerProps) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Kop">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
      </Section>
      <Section title="Teamleden">
        {value.members.length === 0 ? (
          <EmptyHint>Nog geen teamleden — voeg er een toe.</EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.members}
          onChange={(members) => onChange({ ...value, members })}
          createItem={() => ({
            id: createItemId("mem"),
            name: "Naam",
            role: "Functie",
            bio: "",
          })}
          addLabel="Teamlid toevoegen"
          renderItem={(member, actions, index) => (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Field label="Naam">
                    <input
                      className={inputClass}
                      value={member.name}
                      onChange={(e) => actions.update({ ...member, name: e.target.value })}
                    />
                  </Field>
                  <EnDraftFor
                    fieldPath={blockEnPath(blockId, `members.${index}.name`)}
                    label="Naam"
                  />
                </div>
                <div className="space-y-1.5">
                  <Field label="Functie">
                    <input
                      className={inputClass}
                      value={member.role ?? ""}
                      onChange={(e) => actions.update({ ...member, role: e.target.value })}
                    />
                  </Field>
                  <EnDraftFor
                    fieldPath={blockEnPath(blockId, `members.${index}.role`)}
                    label="Functie"
                  />
                </div>
              </div>
              <Field label="Bio">
                <textarea
                  className={`${inputClass} min-h-[3rem]`}
                  value={member.bio ?? ""}
                  onChange={(e) => actions.update({ ...member, bio: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `members.${index}.bio`)}
                label="Bio"
                multiline
              />
              <BlockImageField
                label="Foto"
                value={member.photo}
                preferTags={["team"]}
                enAltPath={blockEnPath(blockId, `members.${index}.photo.alt`)}
                projectImages={projectImages}
                assetBaseUrl={assetBaseUrl}
                uploadToMediaLibrary={uploadToMediaLibrary}
                mediaLibraryItems={mediaLibraryItems}
                resolveProjectImage={resolveProjectImage}
                onChange={(photo) => actions.update({ ...member, photo })}
              />
            </div>
          )}
        />
      </Section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  required,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputClass}
        value={value ?? ""}
        min={min}
        max={max}
        step={step ?? 1}
        required={required}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
      />
    </Field>
  );
}

function VacancyEditor({
  vacancy,
  onChange,
  blockId,
  index,
}: {
  vacancy: VacancyItem;
  onChange: (next: VacancyItem) => void;
  blockId?: string;
  index: number;
}) {
  const rate = vacancy.hourlyRate ?? {
    currency: "EUR" as const,
    period: "hour" as const,
    showOnWebsite: false,
  };
  const v = (field: string) => blockEnPath(blockId, `vacancies.${index}.${field}`);

  return (
    <div className="space-y-5">
      <Section title="Basisgegevens">
        <NlEnField
          label="Functietitel *"
          enPath={v("title")}
          hint="Verplicht voor zichtbare vacatures bij publiceren"
        >
          <input
            className={inputClass}
            value={vacancy.title}
            onChange={(e) => onChange({ ...vacancy, title: e.target.value })}
          />
        </NlEnField>
        <Field label="URL-slug" hint="Voor /vacatures/[slug]; leeg = afgeleid van titel">
          <input
            className={inputClass}
            value={vacancy.slug ?? ""}
            onChange={(e) => onChange({ ...vacancy, slug: e.target.value || undefined })}
            placeholder="bijv. glazenwasser"
          />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <NlEnField label="Afdeling" enPath={v("department")}>
            <input
              className={inputClass}
              value={vacancy.department ?? ""}
              onChange={(e) => onChange({ ...vacancy, department: e.target.value || undefined })}
            />
          </NlEnField>
          <NlEnField label="Locatie *" enPath={v("location")}>
            <input
              className={inputClass}
              value={vacancy.location}
              onChange={(e) => onChange({ ...vacancy, location: e.target.value })}
            />
          </NlEnField>
          <Field label="Dienstverband *">
            <select
              className={selectClass}
              value={vacancy.employmentType}
              onChange={(e) =>
                onChange({ ...vacancy, employmentType: e.target.value as EmploymentType })
              }
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EMPLOYMENT_TYPE_LABELS_NL[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Werkuren en beloning">
        <div className="grid gap-2 sm:grid-cols-2">
          <NumberField
            label="Min. uren per week"
            value={vacancy.hoursPerWeek?.minimum}
            min={0}
            max={60}
            onChange={(minimum) =>
              onChange({
                ...vacancy,
                hoursPerWeek: { ...vacancy.hoursPerWeek, minimum },
              })
            }
          />
          <NumberField
            label="Max. uren per week"
            value={vacancy.hoursPerWeek?.maximum}
            min={0}
            max={60}
            onChange={(maximum) =>
              onChange({
                ...vacancy,
                hoursPerWeek: { ...vacancy.hoursPerWeek, maximum },
              })
            }
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <NumberField
            label="Min. uurtarief (€)"
            value={rate.minimum}
            min={0}
            max={500}
            step={0.5}
            onChange={(minimum) =>
              onChange({
                ...vacancy,
                hourlyRate: { ...rate, minimum, showOnWebsite: rate.showOnWebsite },
              })
            }
          />
          <NumberField
            label="Max. uurtarief (€)"
            value={rate.maximum}
            min={0}
            max={500}
            step={0.5}
            onChange={(maximum) =>
              onChange({
                ...vacancy,
                hourlyRate: { ...rate, maximum, showOnWebsite: rate.showOnWebsite },
              })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={rate.showOnWebsite}
            onChange={(e) =>
              onChange({
                ...vacancy,
                hourlyRate: { ...rate, showOnWebsite: e.target.checked },
              })
            }
          />
          Toon uurtarief op de website
        </label>
        <NlEnField
          label="Alternatieve salaristekst"
          enPath={v("salaryText")}
          hint="Optioneel vrij tekstveld naast gestructureerd tarief"
        >
          <input
            className={inputClass}
            value={vacancy.salaryText ?? ""}
            onChange={(e) => onChange({ ...vacancy, salaryText: e.target.value || undefined })}
          />
        </NlEnField>
      </Section>

      <Section title="Functiebeschrijving">
        <NlEnField
          label="Korte beschrijving *"
          enPath={v("shortDescription")}
          hint="Wordt op de vacaturekaart getoond"
          multiline
        >
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={vacancy.shortDescription}
            onChange={(e) => onChange({ ...vacancy, shortDescription: e.target.value })}
          />
        </NlEnField>
        <NlEnField
          label="Volledige beschrijving"
          enPath={v("fullDescription")}
          hint="Uitklapbaar op de website"
          multiline
        >
          <textarea
            className={`${inputClass} min-h-[6rem]`}
            value={vacancy.fullDescription ?? ""}
            onChange={(e) => onChange({ ...vacancy, fullDescription: e.target.value || undefined })}
          />
        </NlEnField>
      </Section>

      <Section title="Verantwoordelijkheden en eisen">
        <Field label="Verantwoordelijkheden">
          <PlainStringList
            items={vacancy.responsibilities ?? []}
            enPathPrefix={v("responsibilities")}
            onChange={(responsibilities) =>
              onChange({
                ...vacancy,
                responsibilities: responsibilities.filter((s) => s.trim()).length
                  ? responsibilities
                  : undefined,
              })
            }
            addLabel="Verantwoordelijkheid toevoegen"
          />
        </Field>
        <Field label="Eisen">
          <PlainStringList
            items={vacancy.requirements ?? []}
            enPathPrefix={v("requirements")}
            onChange={(requirements) =>
              onChange({
                ...vacancy,
                requirements: requirements.filter((s) => s.trim()).length ? requirements : undefined,
              })
            }
            addLabel="Eis toevoegen"
          />
        </Field>
        <Field label="Arbeidsvoorwaarden">
          <PlainStringList
            items={vacancy.benefits ?? []}
            enPathPrefix={v("benefits")}
            onChange={(benefits) =>
              onChange({
                ...vacancy,
                benefits: benefits.filter((s) => s.trim()).length ? benefits : undefined,
              })
            }
            addLabel="Voordeel toevoegen"
          />
        </Field>
      </Section>

      <Section title="Sollicitatie">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Startdatum">
            <input
              type="date"
              className={inputClass}
              value={vacancy.startDate ?? ""}
              onChange={(e) => onChange({ ...vacancy, startDate: e.target.value || undefined })}
            />
          </Field>
          <Field label="Sollicitatietermijn">
            <input
              type="date"
              className={inputClass}
              value={vacancy.applicationDeadline ?? ""}
              onChange={(e) =>
                onChange({ ...vacancy, applicationDeadline: e.target.value || undefined })
              }
            />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <NlEnField label="Contactpersoon" enPath={v("contactName")}>
            <input
              className={inputClass}
              value={vacancy.contactName ?? ""}
              onChange={(e) => onChange({ ...vacancy, contactName: e.target.value || undefined })}
            />
          </NlEnField>
          <Field label="Contact e-mail">
            <input
              type="email"
              className={inputClass}
              value={vacancy.contactEmail ?? ""}
              onChange={(e) => onChange({ ...vacancy, contactEmail: e.target.value || undefined })}
            />
          </Field>
          <Field label="Contact telefoon">
            <input
              type="tel"
              className={inputClass}
              value={vacancy.contactPhone ?? ""}
              onChange={(e) => onChange({ ...vacancy, contactPhone: e.target.value || undefined })}
            />
          </Field>
        </div>
        <NlEnField label="Knoptekst" enPath={v("buttonLabel")}>
          <input
            className={inputClass}
            value={vacancy.buttonLabel}
            onChange={(e) => onChange({ ...vacancy, buttonLabel: e.target.value || "Solliciteer" })}
          />
        </NlEnField>
        <StructuredLinkField
          label="Sollicitatiebestemming"
          value={vacancy.applicationLink}
          allowedKinds={PAGE_DESTINATION_LINK_KINDS}
          onChange={(applicationLink) =>
            onChange({ ...vacancy, applicationLink: applicationLink ?? { type: "none" } })
          }
        />
      </Section>

      <Section title="Publicatie">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={vacancy.visible}
              onChange={(e) => onChange({ ...vacancy, visible: e.target.checked })}
            />
            Zichtbaar op de website
          </label>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={!!vacancy.featured}
              onChange={(e) => onChange({ ...vacancy, featured: e.target.checked })}
            />
            Uitgelicht
          </label>
        </div>
      </Section>
    </div>
  );
}

export function JobsBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: JobsBlockData;
  onChange: (next: JobsBlockData) => void;
  presentation?: string;
  blockId?: string;
}) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Sectie-instellingen">
        <NlEnField label="Kop" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading}
            onChange={(e) => onChange({ ...value, heading: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Introductie" enPath={blockEnPath(blockId, "introduction")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.introduction ?? ""}
            onChange={(e) => onChange({ ...value, introduction: e.target.value || undefined })}
          />
        </NlEnField>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Weergave">
            <select
              className={selectClass}
              value={value.displayMode}
              onChange={(e) =>
                onChange({
                  ...value,
                  displayMode: e.target.value === "list" ? "list" : "cards",
                })
              }
            >
              <option value="cards">Kaarten</option>
              <option value="list">Lijst</option>
            </select>
          </Field>
          <NlEnField label="Lege staat" enPath={blockEnPath(blockId, "emptyStateText")}>
            <input
              className={inputClass}
              value={value.emptyStateText ?? ""}
              placeholder="Geen openstaande vacatures"
              onChange={(e) => onChange({ ...value, emptyStateText: e.target.value || undefined })}
            />
          </NlEnField>
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={!!value.showFilters}
            onChange={(e) => onChange({ ...value, showFilters: e.target.checked })}
          />
          Toon filters (locatie / dienstverband)
        </label>
      </Section>

      <Section title="Vacatures">
        {value.vacancies.length === 0 ? (
          <EmptyHint>Nog geen vacatures — voeg er een toe.</EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.vacancies}
          onChange={(vacancies) => onChange({ ...value, vacancies })}
          createItem={() => createDefaultVacancy()}
          cloneItem={(vacancy) => ({
            ...vacancy,
            id: createItemId("job"),
            responsibilities: vacancy.responsibilities ? [...vacancy.responsibilities] : undefined,
            requirements: vacancy.requirements ? [...vacancy.requirements] : undefined,
            benefits: vacancy.benefits ? [...vacancy.benefits] : undefined,
            title: vacancy.title ? `${vacancy.title} (kopie)` : vacancy.title,
          })}
          addLabel="Vacature toevoegen"
          renderItem={(vacancy, actions, index) => (
            <VacancyEditor
              vacancy={vacancy}
              index={index}
              blockId={blockId}
              onChange={(next) => actions.update(next)}
            />
          )}
        />
      </Section>
    </div>
  );
}

/** @deprecated Use VacancyItem / applicationLink */
export type JobItem = {
  id: string;
  title: string;
  department?: string;
  location?: string;
  type?: string;
  applyLink?: CmsLink;
};
