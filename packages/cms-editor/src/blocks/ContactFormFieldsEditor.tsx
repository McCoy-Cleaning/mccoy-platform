import * as React from "react";
import {
  CONTACT_FORM_CUSTOM_FIELD_TYPES,
  createFormFieldItem,
  createFormFieldOption,
  FORM_FIELD_TYPE_LABELS_NL,
  type FormFieldItem,
  type FormFieldOption,
  type FormFieldType,
} from "@mccoy/cms-schema";
import { blockEnPath, EnDraftFor, NlEnField, sectionEnPath } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { Field, Section, inputClass } from "./shared-fields";

function FormFieldOptionsEditor({
  options,
  onChange,
  enPathPrefix,
}: {
  options: FormFieldOption[];
  onChange: (next: FormFieldOption[]) => void;
  enPathPrefix?: string;
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
          {enPathPrefix ? (
            <EnDraftFor
              fieldPath={`${enPathPrefix}.options.${optionIndex}.label`}
              label="Label"
            />
          ) : null}
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

/**
 * Editable custom fields for contact forms (company / phone / message by default).
 * Name and e-mail remain built-in on the storefront.
 */
export function ContactFormFieldsEditor({
  fields,
  onChange,
  blockId,
  sectionKey,
}: {
  fields: FormFieldItem[];
  onChange: (fields: FormFieldItem[]) => void;
  blockId?: string;
  sectionKey?: "contact.form" | "offerte.form";
}) {
  const fieldEnPath = (index: number, leaf: string) => {
    if (blockId) return blockEnPath(blockId, `fields.${index}.${leaf}`);
    if (sectionKey) return sectionEnPath(sectionKey, `fields.${index}.${leaf}`);
    return undefined;
  };

  return (
    <Section title="Formuliervelden">
      <p className="text-[11px] text-white/50">
        <span className="text-white/70">Naam</span> en{" "}
        <span className="text-white/70">E-mail</span> staan standaard op het formulier (verplicht
        voor verzending). Beheer hier de overige velden — label, placeholder, type en of het
        verplicht is.
      </p>
      <ObjectListEditor<FormFieldItem>
        items={fields}
        onChange={onChange}
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
          const labelPath = fieldEnPath(index, "label");
          const placeholderPath = fieldEnPath(index, "placeholder");
          return (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              {labelPath ? (
                <NlEnField label="Label" enPath={labelPath}>
                  <input
                    className={inputClass}
                    value={item.label}
                    onChange={(e) => actions.update({ ...item, label: e.target.value })}
                  />
                </NlEnField>
              ) : (
                <Field label="Label">
                  <input
                    className={inputClass}
                    value={item.label}
                    onChange={(e) => actions.update({ ...item, label: e.target.value })}
                  />
                </Field>
              )}
              {placeholderPath ? (
                <NlEnField label="Placeholder" enPath={placeholderPath}>
                  <input
                    className={inputClass}
                    value={item.placeholder ?? ""}
                    onChange={(e) =>
                      actions.update({
                        ...item,
                        placeholder: e.target.value || undefined,
                      })
                    }
                  />
                </NlEnField>
              ) : (
                <Field label="Placeholder">
                  <input
                    className={inputClass}
                    value={item.placeholder ?? ""}
                    onChange={(e) =>
                      actions.update({
                        ...item,
                        placeholder: e.target.value || undefined,
                      })
                    }
                  />
                </Field>
              )}
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
                    enPathPrefix={
                      blockId
                        ? `block:${blockId}:fields.${index}`
                        : sectionKey
                          ? `section:${sectionKey}:fields.${index}`
                          : undefined
                    }
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
  );
}
