import * as React from "react";
import {
  defaultContactFormHighlights,
  normalizeContactFormColumnsDesktop,
  normalizeContactFormTextPlacement,
  seedDefaultContactFormFields,
  type ContactFormColumnsDesktop,
  type ContactFormContent,
  type ContactFormTextPlacement,
} from "@mccoy/cms-schema";
import { InspectTextField } from "../ai-assist";
import { ContactFormFieldsEditor } from "../blocks/ContactFormFieldsEditor";
import { FormScopeField } from "../blocks/FormScopeField";
import { StringListEditor } from "../blocks/StringListEditor";
import { NlEnField, sectionEnPath } from "../blocks/en-draft-fields";
import { inputClass } from "../inspector-chrome";
import { Field, Section } from "../blocks/field-chrome";

const TEXT_PLACEMENT_OPTIONS: Array<{
  id: ContactFormTextPlacement;
  label: string;
  hint: string;
}> = [
  { id: "top", label: "Boven", hint: "Tekst boven het formulier" },
  { id: "left", label: "Links", hint: "Tekst links, formulier rechts" },
  { id: "right", label: "Rechts", hint: "Formulier links, tekst rechts" },
];

const COLUMNS_OPTIONS: Array<{
  id: ContactFormColumnsDesktop;
  label: string;
  hint: string;
}> = [
  { id: 1, label: "1 kolom", hint: "Velden onder elkaar" },
  { id: 2, label: "2 kolommen", hint: "Velden naast elkaar op desktop" },
];

export function ContactFormInspector({
  content,
  onPatch,
  formLabel = "Contactformulier",
  sectionKey = "contact.form",
}: {
  content: ContactFormContent;
  onPatch: (patch: Partial<ContactFormContent>) => void;
  formLabel?: string;
  sectionKey?: "contact.form" | "offerte.form";
}) {
  const isOfferte = sectionKey === "offerte.form";
  const highlights = content.highlights ?? (isOfferte ? [] : defaultContactFormHighlights());
  const textPlacement = normalizeContactFormTextPlacement(content.textPlacement);
  const formColumnsDesktop = normalizeContactFormColumnsDesktop(content.formColumnsDesktop);
  const fields =
    content.fields && content.fields.length > 0
      ? content.fields
      : seedDefaultContactFormFields({
          labels: content.labels,
          placeholders: content.placeholders,
        });

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-white/50">
        Het {formLabel.toLowerCase()} is vast onderdeel van de pagina: verbergen kan, verwijderen
        niet. Kop, tekst, punten, knop en formuliervelden zijn hier bewerkbaar. Via de
        sectiecatalogus kunt u het formulier ook als blok toevoegen (vervangt deze vaste sectie op
        Contact).
      </p>

      <Section title="Kop & tekst">
        {!isOfferte ? (
          <Field label="Eyebrow">
            <input
              className={inputClass}
              value={content.eyebrow ?? ""}
              onChange={(e) => onPatch({ eyebrow: e.target.value || undefined })}
              placeholder="Contact"
            />
          </Field>
        ) : null}
        <Field label="Kop boven formulier">
          <input
            className={inputClass}
            value={content.heading ?? ""}
            onChange={(e) => onPatch({ heading: e.target.value || undefined })}
            placeholder="Laten we praten over uw pand."
          />
        </Field>
        {!isOfferte ? (
          <InspectTextField
            label="Introductietekst"
            value={content.body ?? ""}
            onChange={(v) => onPatch({ body: v || undefined })}
            fieldPath={`section:${sectionKey}:body`}
            fieldHint="body"
            multiline
            maxChars={600}
            placeholder="Tekst naast het formulier."
            enableAi={false}
          />
        ) : null}
        {!isOfferte ? (
          <Field
            label="Positie van de tekst"
            hint="Boven: gestapeld. Links/rechts: tekst en formulier naast elkaar."
          >
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Positie van de tekst"
            >
              {TEXT_PLACEMENT_OPTIONS.map((opt) => {
                const selected = textPlacement === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onPatch({ textPlacement: opt.id })}
                    className={
                      selected
                        ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-3 py-3 text-left"
                        : "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left hover:border-white/25"
                    }
                  >
                    <span className="block text-sm font-semibold text-white">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-white/45">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}
        {!isOfferte ? (
          <Field
            label="Kolommen op desktop"
            hint="Mobiel blijft altijd één kolom. Geldt voor de formuliervelden."
          >
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kolommen op desktop">
              {COLUMNS_OPTIONS.map((opt) => {
                const selected = formColumnsDesktop === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onPatch({ formColumnsDesktop: opt.id })}
                    className={
                      selected
                        ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-3 py-3 text-left"
                        : "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left hover:border-white/25"
                    }
                  >
                    <span className="block text-sm font-semibold text-white">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-white/45">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}
      </Section>

      {!isOfferte ? (
        <Section title="Punten naast het formulier">
          <p className="mb-2 text-[11px] text-white/45">
            Korte beloften of USP’s bij de tekstkolom. Leeg = standaardpunten van de site.
          </p>
          <StringListEditor
            value={highlights}
            onChange={(next) => onPatch({ highlights: next })}
            addLabel="Punt toevoegen"
            enPathPrefix={`section:${sectionKey}:highlights`}
          />
          {content.highlights == null ? (
            <button
              type="button"
              className="mt-2 text-[11px] text-sky-300/90 underline-offset-2 hover:underline"
              onClick={() => onPatch({ highlights: defaultContactFormHighlights() })}
            >
              Standaardpunten vastleggen in CMS
            </button>
          ) : content.highlights.length === 0 ? (
            <button
              type="button"
              className="mt-2 text-[11px] text-sky-300/90 underline-offset-2 hover:underline"
              onClick={() => onPatch({ highlights: defaultContactFormHighlights() })}
            >
              Standaardpunten herstellen
            </button>
          ) : null}
        </Section>
      ) : null}

      {!isOfferte ? (
        <Section title="Versturen & bevestiging">
          <NlEnField
            label="Knoptekst"
            enPath={sectionEnPath(sectionKey, "submitLabel")}
          >
            <input
              className={inputClass}
              value={content.submitLabel ?? ""}
              onChange={(e) => onPatch({ submitLabel: e.target.value || undefined })}
              placeholder="Verstuur aanvraag"
            />
          </NlEnField>
          <InspectTextField
            label="Toestemmingstekst"
            value={content.consent ?? ""}
            onChange={(v) => onPatch({ consent: v || undefined })}
            fieldPath={`section:${sectionKey}:consent`}
            fieldHint="consent"
            multiline
            maxChars={280}
            enableAi={false}
          />
          <NlEnField
            label="Succeskop"
            enPath={sectionEnPath(sectionKey, "successMessage")}
          >
            <input
              className={inputClass}
              value={content.successMessage ?? ""}
              onChange={(e) => onPatch({ successMessage: e.target.value || undefined })}
            />
          </NlEnField>
          <InspectTextField
            label="Succes-subtekst"
            value={content.successDetail ?? ""}
            onChange={(v) => onPatch({ successDetail: v || undefined })}
            fieldPath={`section:${sectionKey}:successDetail`}
            fieldHint="body"
            multiline
            maxChars={280}
            enableAi={false}
          />
        </Section>
      ) : null}

      {!isOfferte ? (
        <ContactFormFieldsEditor
          fields={fields}
          onChange={(next) => onPatch({ fields: next })}
          sectionKey={sectionKey}
        />
      ) : null}

      {isOfferte ? (
        <>
          <FormScopeField
            label="Scope glasbewassing"
            value={content.glassScope}
            onChange={(glassScope) => onPatch({ glassScope })}
          />
          <FormScopeField
            label="Scope meubelreiniging"
            value={content.furnitureScope}
            onChange={(furnitureScope) => onPatch({ furnitureScope })}
          />
        </>
      ) : (
        <FormScopeField value={content.scope} onChange={(scope) => onPatch({ scope })} />
      )}
    </div>
  );
}
