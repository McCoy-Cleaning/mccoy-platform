import * as React from "react";
import { createItemId, type BlockEditorPresentation } from "@mccoy/cms-schema";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { EmptyHint, Field, Section, inputClass } from "./shared-fields";

export type FeatureGridItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
};

export type FeatureGridBlockData = {
  title: string;
  features: FeatureGridItem[];
  presentation?: "default" | "productsAssortment";
  eyebrow?: string;
  intro?: string;
};

export function FeatureGridBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: FeatureGridBlockData;
  onChange: (next: FeatureGridBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Kop">
        {value.presentation === "productsAssortment" ? (
          <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
            <input
              className={inputClass}
              value={value.eyebrow ?? ""}
              onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
            />
          </NlEnField>
        ) : null}
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        {value.presentation === "productsAssortment" ? (
          <NlEnField label="Intro" enPath={blockEnPath(blockId, "intro")} multiline>
            <textarea
              className={`${inputClass} min-h-[3rem]`}
              value={value.intro ?? ""}
              onChange={(e) => onChange({ ...value, intro: e.target.value })}
            />
          </NlEnField>
        ) : null}
      </Section>
      <Section title="Kenmerken">
        {value.features.length === 0 ? (
          <EmptyHint>Nog geen kenmerken — voeg er een toe.</EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.features}
          onChange={(features) => onChange({ ...value, features })}
          createItem={() => ({
            id: createItemId("feat"),
            icon: "sparkles",
            title: "Nieuw kenmerk",
            body: "",
          })}
          addLabel="Kenmerk toevoegen"
          renderItem={(item, actions, index) => (
            <div className="grid gap-2">
              <Field label="Icoon (decoratief)">
                <input
                  className={inputClass}
                  value={item.icon}
                  onChange={(e) => actions.update({ ...item, icon: e.target.value })}
                  placeholder="sparkles"
                />
              </Field>
              <Field label="Titel">
                <input
                  className={inputClass}
                  value={item.title}
                  onChange={(e) => actions.update({ ...item, title: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `features.${index}.title`)}
                label="Titel"
              />
              <Field label="Tekst">
                <textarea
                  className={`${inputClass} min-h-[3rem]`}
                  value={item.body}
                  onChange={(e) => actions.update({ ...item, body: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `features.${index}.body`)}
                label="Tekst"
                multiline
              />
            </div>
          )}
        />
      </Section>
    </div>
  );
}
