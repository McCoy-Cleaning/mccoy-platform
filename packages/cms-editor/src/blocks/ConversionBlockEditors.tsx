import * as React from "react";
import {
  normalizeContactFormColumnsDesktop,
  normalizeContactFormTextPlacement,
  seedDefaultContactFormFields,
  type BlockEditorPresentation,
  type ContactFormBlockData,
  type ContactFormColumnsDesktop,
  type ContactFormTextPlacement,
  type NewsletterBlockData,
  type PopupBlockData,
} from "@mccoy/cms-schema";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { ContactFormFieldsEditor } from "./ContactFormFieldsEditor";
import { StringListEditor } from "./StringListEditor";
import { TitleBodyCtaBlockEditor } from "./TitleBodyCtaBlockEditor";
import { Field, Section, inputClass } from "./shared-fields";
import { FormScopeField } from "./FormScopeField";

const CONTACT_TEXT_PLACEMENT_OPTIONS: Array<{
  id: ContactFormTextPlacement;
  label: string;
  hint: string;
}> = [
  { id: "top", label: "Boven", hint: "Tekst boven het formulier" },
  { id: "left", label: "Links", hint: "Tekst links, formulier rechts" },
  { id: "right", label: "Rechts", hint: "Formulier links, tekst rechts" },
];

const CONTACT_COLUMNS_OPTIONS: Array<{
  id: ContactFormColumnsDesktop;
  label: string;
  hint: string;
}> = [
  { id: 1, label: "1 kolom", hint: "Velden onder elkaar" },
  { id: 2, label: "2 kolommen", hint: "Velden naast elkaar op desktop" },
];

export function NewsletterBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: NewsletterBlockData;
  onChange: (next: NewsletterBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Nieuwsbrief">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Tekst" enPath={blockEnPath(blockId, "body")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Knoptekst" enPath={blockEnPath(blockId, "buttonLabel")}>
          <input
            className={inputClass}
            value={value.buttonLabel}
            onChange={(e) => onChange({ ...value, buttonLabel: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Consenttekst (optioneel)" enPath={blockEnPath(blockId, "consent")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.consent ?? ""}
            onChange={(e) => onChange({ ...value, consent: e.target.value || undefined })}
            placeholder="Ik ga akkoord met de privacyverklaring."
          />
        </NlEnField>
        <FormScopeField
          value={value.scope}
          onChange={(scope) => onChange({ ...value, scope })}
        />
        <p className="text-[11px] text-white/45">
          Aanmeldingen worden veilig opgeslagen als website-aanvraag (geen marketingautomatisering).
        </p>
      </Section>
    </div>
  );
}

export function ContactFormBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: ContactFormBlockData;
  onChange: (next: ContactFormBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  void presentation;
  const patch = (partial: Partial<ContactFormBlockData>) => onChange({ ...value, ...partial });
  const textPlacement = normalizeContactFormTextPlacement(value.textPlacement);
  const formColumnsDesktop = normalizeContactFormColumnsDesktop(value.formColumnsDesktop);
  const highlights = value.highlights ?? [];
  const fields =
    value.fields?.length > 0
      ? value.fields
      : seedDefaultContactFormFields({
          labels: value.labels,
          placeholders: value.placeholders,
        });

  return (
    <div className="space-y-6">
      <Section title="Kop & tekst">
        <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
          <input
            className={inputClass}
            value={value.eyebrow ?? ""}
            onChange={(e) => patch({ eyebrow: e.target.value || undefined })}
            placeholder="Contact"
          />
        </NlEnField>
        <NlEnField label="Kop" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Laten we praten over uw pand."
          />
        </NlEnField>
        <NlEnField label="Introductietekst" enPath={blockEnPath(blockId, "body")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.body ?? ""}
            onChange={(e) => patch({ body: e.target.value || undefined })}
            placeholder="Tekst naast of boven het formulier."
          />
        </NlEnField>
        <Field
          label="Positie van de tekst"
          hint="Boven: gestapeld. Links/rechts: tekst en formulier naast elkaar."
        >
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Positie van de tekst">
            {CONTACT_TEXT_PLACEMENT_OPTIONS.map((opt) => {
              const selected = textPlacement === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => patch({ textPlacement: opt.id })}
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
        <Field
          label="Kolommen op desktop"
          hint="Mobiel blijft altijd één kolom. Geldt voor de formuliervelden."
        >
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kolommen op desktop">
            {CONTACT_COLUMNS_OPTIONS.map((opt) => {
              const selected = formColumnsDesktop === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => patch({ formColumnsDesktop: opt.id })}
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
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
          Ontvanger wordt server-side bepaald via <code className="text-white/70">FORM_TO_EMAIL</code>.
          Een eventueel oud &quot;recipient&quot;-veld in de data wordt genegeerd.
        </p>
      </Section>

      <Section title="Punten naast het formulier">
        <p className="mb-2 text-[11px] text-white/45">
          Optionele beloften of USP’s bij de tekstkolom. Leeg = geen punten op de site.
        </p>
        <StringListEditor
          value={highlights}
          onChange={(next) => patch({ highlights: next })}
          addLabel="Punt toevoegen"
          enPathPrefix={blockId ? `block:${blockId}:highlights` : undefined}
        />
      </Section>

      <Section title="Versturen & bevestiging">
        <NlEnField label="Knoptekst" enPath={blockEnPath(blockId, "submitLabel")}>
          <input
            className={inputClass}
            value={value.submitLabel ?? ""}
            onChange={(e) => patch({ submitLabel: e.target.value || undefined })}
            placeholder="Verstuur aanvraag"
          />
        </NlEnField>
        <NlEnField label="Toestemmingstekst" enPath={blockEnPath(blockId, "consent")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.consent ?? ""}
            onChange={(e) => patch({ consent: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Succeskop" enPath={blockEnPath(blockId, "successMessage")}>
          <input
            className={inputClass}
            value={value.successMessage ?? ""}
            onChange={(e) => patch({ successMessage: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Succes-subtekst" enPath={blockEnPath(blockId, "successDetail")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.successDetail ?? ""}
            onChange={(e) => patch({ successDetail: e.target.value || undefined })}
          />
        </NlEnField>
        <FormScopeField value={value.scope} onChange={(scope) => patch({ scope })} />
      </Section>

      <ContactFormFieldsEditor
        fields={fields}
        onChange={(next) => patch({ fields: next })}
        blockId={blockId}
      />
    </div>
  );
}

/** Popup uses the shared title/body/CTA editor; quality is typed-composed. */
export function PopupBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: PopupBlockData;
  onChange: (next: PopupBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
        Gedrag: dismissible modal/banner. Op de storefront één keer per sessie of tot sluiten
        (localStorage-sleutel per blok-id). Respecteert <code className="text-white/70">prefers-reduced-motion</code>.
      </p>
      <TitleBodyCtaBlockEditor
        value={value}
        onChange={onChange}
        presentation={presentation}
        blockId={blockId}
      />
    </div>
  );
}
