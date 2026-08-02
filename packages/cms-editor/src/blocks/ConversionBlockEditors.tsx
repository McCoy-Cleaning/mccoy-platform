import * as React from "react";
import {
  CONTACT_FORM_CUSTOM_FIELD_TYPES,
  createFormFieldItem,
  createFormFieldOption,
  FORM_FIELD_TYPE_LABELS_NL,
  type BlockEditorPresentation,
  type ContactFormBlockData,
  type FormFieldItem,
  type FormFieldOption,
  type FormFieldType,
  type NewsletterBlockData,
  type PopupBlockData,
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

function FormFieldOptionsEditor({
  options,
  onChange,
  blockId,
  fieldIndex,
}: {
  options: FormFieldOption[];
  onChange: (next: FormFieldOption[]) => void;
  blockId?: string;
  fieldIndex: number;
}) {
  return (
    <ObjectListEditor<FormFieldOption>
      items={options}
      onChange={onChange}
      createItem={() => createFormFieldOption("Optie")}
      cloneItem={(item) => ({ ...item, id: createFormFieldOption(item.label).id })}
      addLabel="Optie toevoegen"
      renderItem={(option, actions, optionIndex) => (
        <div className="rounded-lg border border-white/10 bg-black/10 p-2">
          <Field label="Label">
            <input
              className={inputClass}
              value={option.label}
              onChange={(e) => actions.update({ ...option, label: e.target.value })}
            />
          </Field>
          <EnDraftFor
            fieldPath={blockEnPath(blockId, `fields.${fieldIndex}.options.${optionIndex}.label`)}
            label="Label"
          />
          <Field label="Waarde (optioneel)" hint="Stabiele sleutel; leeg = afgeleid uit label.">
            <input
              className={inputClass}
              value={option.value ?? ""}
              onChange={(e) =>
                actions.update({ ...option, value: e.target.value.trim() || undefined })
              }
            />
          </Field>
          <div className="mt-2 flex gap-2">
            <button type="button" className="text-xs text-white/50 hover:text-white" onClick={actions.moveUp}>
              Omhoog
            </button>
            <button type="button" className="text-xs text-white/50 hover:text-white" onClick={actions.moveDown}>
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
        <NlEnField label="Introductietekst" enPath={blockEnPath(blockId, "body")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value || undefined })}
            placeholder="Tekst naast het formulier (links)."
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
        <p className="text-[11px] text-white/50">
          <span className="text-white/70">Naam</span> en{" "}
          <span className="text-white/70">E-mail</span> staan standaard op het formulier (verplicht
          voor verzending). Voeg hier extra velden toe — telefoon, bedrijf, tekst, tekstvak of
          keuzelijst. Het <span className="text-white/70">label</span> is wat de bezoeker ziet; het
          veldtype bepaalt invoercontrole.
        </p>
        <ObjectListEditor<FormFieldItem>
          items={value.fields}
          onChange={(fields) => onChange({ ...value, fields })}
          createItem={() => createFormFieldItem("Nieuw veld", "text")}
          cloneItem={(item) => ({
            ...item,
            id: createFormFieldItem(item.label, item.type).id,
            options: item.options?.map((option) => ({
              ...option,
              id: createFormFieldOption(option.label, option.value).id,
            })),
          })}
          addLabel="Veld toevoegen"
          renderItem={(item, actions, index) => {
            return (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <Field label="Label">
                  <input
                    className={inputClass}
                    value={item.label}
                    onChange={(e) => actions.update({ ...item, label: e.target.value })}
                  />
                </Field>
                <EnDraftFor fieldPath={blockEnPath(blockId, `fields.${index}.label`)} label="Label" />
                <Field
                  label="Veldtype"
                  hint="Bepaalt opslag en invoercontrole — niet hetzelfde als het zichtbare label."
                >
                  <select
                    className={inputClass}
                    value={item.type}
                    onChange={(e) => {
                      const type = e.target.value as FormFieldType;
                      const next: FormFieldItem = {
                        ...item,
                        type,
                        options:
                          type === "select"
                            ? item.options?.length
                              ? item.options
                              : [createFormFieldOption("Optie 1"), createFormFieldOption("Optie 2")]
                            : undefined,
                      };
                      actions.update(next);
                    }}
                  >
                    {CONTACT_FORM_CUSTOM_FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {FORM_FIELD_TYPE_LABELS_NL[type]}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="mt-2 flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={Boolean(item.required)}
                    onChange={(e) => actions.update({ ...item, required: e.target.checked })}
                  />
                  Verplicht
                </label>
                {item.type === "select" ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-medium text-white/55">Keuzeopties</p>
                    <FormFieldOptionsEditor
                      options={item.options ?? []}
                      onChange={(options) => actions.update({ ...item, options })}
                      blockId={blockId}
                      fieldIndex={index}
                    />
                  </div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="text-xs text-white/50 hover:text-white" onClick={actions.moveUp}>
                    Omhoog
                  </button>
                  <button type="button" className="text-xs text-white/50 hover:text-white" onClick={actions.moveDown}>
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
            );
          }}
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
