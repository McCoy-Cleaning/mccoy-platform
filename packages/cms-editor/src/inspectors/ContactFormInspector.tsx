import * as React from "react";
import {
  createDefaultQuoteRequestForm,
  normalizeContactFormColumnsDesktop,
  normalizeContactFormTextPlacement,
  normalizeQuoteRequestForm,
  seedDefaultContactFormFields,
  type ContactFormColumnsDesktop,
  type ContactFormContent,
  type ContactFormTextPlacement,
  type QuoteRequestFormBlockData,
  type QuoteRequestFormTab,
} from "@mccoy/cms-schema";
import {
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
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

const CONTACT_COPY_KEYS = [
  "eyebrow",
  "heading",
  "body",
  "submitLabel",
  "consent",
  "successMessage",
  "successDetail",
] as const;

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
  const highlights = content.highlights ?? [];
  const textPlacement = normalizeContactFormTextPlacement(content.textPlacement);
  const formColumnsDesktop = normalizeContactFormColumnsDesktop(content.formColumnsDesktop);
  const fields =
    content.fields && content.fields.length > 0
      ? content.fields
      : seedDefaultContactFormFields({
          labels: content.labels,
          placeholders: content.placeholders,
        });
  const pathPrefix = `section:${sectionKey}`;
  const quote = normalizeQuoteRequestForm(
    content.quote ?? createDefaultQuoteRequestForm(),
  );

  const patchQuote = (next: QuoteRequestFormBlockData) => {
    onPatch({
      quote: next,
      heading: next.heading,
      submitLabel: next.submitLabel,
      successMessage: next.successMessage,
    });
  };

  const updateTab = (index: number, patch: Partial<QuoteRequestFormTab>) => {
    const tabs = quote.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab));
    patchQuote({ ...quote, tabs });
  };

  const aiFields = collectShallowStringFields(
    content as unknown as Record<string, unknown>,
    [...CONTACT_COPY_KEYS],
    { includeEmpty: true },
  );

  const applyDutch = (nl: Record<string, string>) => {
    const patch: Partial<ContactFormContent> = {};
    for (const key of CONTACT_COPY_KEYS) {
      if (typeof nl[key] === "string") {
        patch[key] = nl[key] || undefined;
      }
    }
    onPatch(patch);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-white/50">
        Het {formLabel.toLowerCase()} is vast onderdeel van de pagina: verbergen kan, verwijderen
        niet.{" "}
        {isOfferte
          ? "Kop, tabteksten, knop, succesbericht en veldlabels zijn hier bewerkbaar. Formuliertype, submission keys en veldtypes blijven vast (E12)."
          : "Kop, tekst, punten, knop en formuliervelden zijn hier bewerkbaar. Via de sectiecatalogus kunt u het formulier ook als blok toevoegen (vervangt deze vaste sectie op Contact). Engelse concepten staan in het AI-paneel (of onder formuliervelden); Opslaan vult ontbrekende EN-drafts vanuit NL."}
      </p>

      {!isOfferte ? (
        <SectionAiToolbar
          pathPrefix={pathPrefix}
          fields={aiFields}
          fieldLabels={{
            eyebrow: "Eyebrow",
            heading: "Kop",
            body: "Introductietekst",
            submitLabel: "Knoptekst",
            consent: "Toestemmingstekst",
            successMessage: "Succeskop",
            successDetail: "Succes-subtekst",
          }}
          onApplyDutch={applyDutch}
        />
      ) : null}

      <Section title="Kop & tekst">
        {!isOfferte ? (
          <NlEnField label="Eyebrow" enPath={sectionEnPath(sectionKey, "eyebrow")}>
            <input
              className={inputClass}
              value={content.eyebrow ?? ""}
              onChange={(e) => onPatch({ eyebrow: e.target.value || undefined })}
              placeholder="Contact"
            />
          </NlEnField>
        ) : null}
        <NlEnField label="Kop boven formulier" enPath={sectionEnPath(sectionKey, "heading")}>
          <input
            className={inputClass}
            value={isOfferte ? (quote.heading ?? content.heading ?? "") : (content.heading ?? "")}
            onChange={(e) => {
              const next = e.target.value || undefined;
              if (isOfferte) {
                patchQuote({ ...quote, heading: next });
                return;
              }
              onPatch({ heading: next });
            }}
            placeholder={isOfferte ? "Optionele kop" : "Laten we praten over uw pand."}
          />
        </NlEnField>
        {!isOfferte ? (
          <NlEnField
            label="Introductietekst"
            enPath={sectionEnPath(sectionKey, "body")}
            multiline
          >
            <textarea
              className={`${inputClass} min-h-[4rem]`}
              value={content.body ?? ""}
              onChange={(e) => onPatch({ body: e.target.value || undefined })}
              placeholder="Tekst naast het formulier."
            />
          </NlEnField>
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

      {isOfferte ? (
        <>
          <Section title="Versturen & bevestiging">
            <NlEnField label="Knoptekst" enPath={sectionEnPath(sectionKey, "submitLabel")}>
              <input
                className={inputClass}
                value={quote.submitLabel}
                onChange={(e) =>
                  patchQuote({ ...quote, submitLabel: e.target.value || quote.submitLabel })
                }
                placeholder="Verstuur aanvraag"
              />
            </NlEnField>
            <NlEnField
              label="Succesbericht"
              enPath={sectionEnPath(sectionKey, "successMessage")}
              multiline
            >
              <textarea
                className={`${inputClass} min-h-[3rem]`}
                value={quote.successMessage}
                onChange={(e) =>
                  patchQuote({
                    ...quote,
                    successMessage: e.target.value || quote.successMessage,
                  })
                }
              />
            </NlEnField>
          </Section>

          <Section title="Tabs">
            <p className="mb-2 text-[11px] text-white/45">
              Tag, titel en beschrijving zijn presentatie. Formuliertype (glas / meubel) blijft vast.
            </p>
            {quote.tabs.map((tab, index) => (
              <div
                key={tab.id}
                className="mb-3 space-y-3 rounded-lg border border-white/10 bg-black/10 p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  {tab.kind === "furniture_cleaning" ? "Meubelreiniging" : "Glasbewassing"}
                </p>
                <NlEnField
                  label="Tag"
                  enPath={sectionEnPath(sectionKey, `quote.tabs.${index}.tag`)}
                >
                  <input
                    className={inputClass}
                    value={tab.tag}
                    onChange={(e) => updateTab(index, { tag: e.target.value })}
                  />
                </NlEnField>
                <NlEnField
                  label="Titel"
                  enPath={sectionEnPath(sectionKey, `quote.tabs.${index}.title`)}
                >
                  <input
                    className={inputClass}
                    value={tab.title}
                    onChange={(e) => updateTab(index, { title: e.target.value })}
                  />
                </NlEnField>
                <NlEnField
                  label="Beschrijving"
                  enPath={sectionEnPath(sectionKey, `quote.tabs.${index}.description`)}
                  multiline
                >
                  <textarea
                    className={`${inputClass} min-h-[4rem]`}
                    value={tab.description}
                    onChange={(e) => updateTab(index, { description: e.target.value })}
                  />
                </NlEnField>
                <ContactFormFieldsEditor
                  fields={tab.fields}
                  onChange={(nextFields) => updateTab(index, { fields: nextFields })}
                  sectionKey={sectionKey}
                />
              </div>
            ))}
          </Section>
        </>
      ) : null}

      {!isOfferte ? (
        <Section title="Punten naast het formulier">
          <p className="mb-2 text-[11px] text-white/45">
            Optionele beloften of USP’s bij de tekstkolom. Leeg = geen punten op de site.
          </p>
          <StringListEditor
            value={highlights}
            onChange={(next) => onPatch({ highlights: next })}
            addLabel="Punt toevoegen"
            enPathPrefix={`${pathPrefix}:highlights`}
          />
        </Section>
      ) : null}

      {!isOfferte ? (
        <Section title="Versturen & bevestiging">
          <NlEnField label="Knoptekst" enPath={sectionEnPath(sectionKey, "submitLabel")}>
            <input
              className={inputClass}
              value={content.submitLabel ?? ""}
              onChange={(e) => onPatch({ submitLabel: e.target.value || undefined })}
              placeholder="Verstuur aanvraag"
            />
          </NlEnField>
          <NlEnField
            label="Toestemmingstekst"
            enPath={sectionEnPath(sectionKey, "consent")}
            multiline
          >
            <textarea
              className={`${inputClass} min-h-[3rem]`}
              value={content.consent ?? ""}
              onChange={(e) => onPatch({ consent: e.target.value || undefined })}
            />
          </NlEnField>
          <NlEnField label="Succeskop" enPath={sectionEnPath(sectionKey, "successMessage")}>
            <input
              className={inputClass}
              value={content.successMessage ?? ""}
              onChange={(e) => onPatch({ successMessage: e.target.value || undefined })}
            />
          </NlEnField>
          <NlEnField
            label="Succes-subtekst"
            enPath={sectionEnPath(sectionKey, "successDetail")}
            multiline
          >
            <textarea
              className={`${inputClass} min-h-[3rem]`}
              value={content.successDetail ?? ""}
              onChange={(e) => onPatch({ successDetail: e.target.value || undefined })}
            />
          </NlEnField>
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
