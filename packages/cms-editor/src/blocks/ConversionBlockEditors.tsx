import * as React from "react";
import {
  createTextListItem,
  type BlockEditorPresentation,
  type ContactFormBlockData,
  type NewsletterBlockData,
  type PopupBlockData,
  type TextListItem,
} from "@mccoy/cms-schema";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { TitleBodyCtaBlockEditor } from "./TitleBodyCtaBlockEditor";
import { Field, Section, inputClass } from "./shared-fields";
import { FormScopeField } from "./FormScopeField";

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
  return (
    <div className="space-y-6">
      <Section title="Contactformulier">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Bevestigingstekst" enPath={blockEnPath(blockId, "confirmation")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.confirmation ?? ""}
            onChange={(e) => onChange({ ...value, confirmation: e.target.value || undefined })}
          />
        </NlEnField>
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
          Ontvanger wordt server-side bepaald via <code className="text-white/70">FORM_TO_EMAIL</code>.
          Een eventueel oud &quot;recipient&quot;-veld in de data wordt genegeerd.
        </p>
        <FormScopeField
          value={value.scope}
          onChange={(scope) => onChange({ ...value, scope })}
        />
      </Section>
      <Section title="Velden">
        <ObjectListEditor<TextListItem>
          items={value.fields}
          onChange={(fields) => onChange({ ...value, fields })}
          createItem={() => createTextListItem("Nieuw veld")}
          cloneItem={(item) => ({ ...item, id: createTextListItem(item.text).id })}
          addLabel="Veld toevoegen"
          renderItem={(item, actions, index) => (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <Field label="Label">
                <input
                  className={inputClass}
                  value={item.text}
                  onChange={(e) => actions.update({ ...item, text: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `fields.${index}.text`)}
                label="Label"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="text-xs text-white/50 hover:text-white"
                  onClick={actions.moveUp}
                >
                  Omhoog
                </button>
                <button
                  type="button"
                  className="text-xs text-white/50 hover:text-white"
                  onClick={actions.moveDown}
                >
                  Omlaag
                </button>
                <button
                  type="button"
                  className="text-xs text-rose-300/80 hover:text-rose-200"
                  onClick={actions.remove}
                >
                  Verwijderen
                </button>
              </div>
            </div>
          )}
        />
      </Section>
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
