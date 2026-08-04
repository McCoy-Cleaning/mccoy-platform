import * as React from "react";
import {
  createItemId,
  type BlockEditorPresentation,
  type CmsButton,
} from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { CmsButtonEditor, EmptyHint, Field, Section, inputClass } from "./shared-fields";

export type FeatureGridItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
  cta?: CmsButton;
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
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: FeatureGridBlockData;
  onChange: (next: FeatureGridBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  void presentation;
  const isAssortment = value.presentation === "productsAssortment";
  const imagePickerProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };

  return (
    <div className="space-y-6">
      <Section title="Kop">
        {isAssortment ? (
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
        {isAssortment ? (
          <NlEnField label="Intro" enPath={blockEnPath(blockId, "intro")} multiline>
            <textarea
              className={`${inputClass} min-h-[3rem]`}
              value={value.intro ?? ""}
              onChange={(e) => onChange({ ...value, intro: e.target.value })}
            />
          </NlEnField>
        ) : null}
      </Section>
      <Section title={isAssortment ? "Productkaarten" : "Kenmerken"}>
        {value.features.length === 0 ? (
          <EmptyHint>
            {isAssortment
              ? "Nog geen kaarten — voeg er een toe."
              : "Nog geen kenmerken — voeg er een toe."}
          </EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.features}
          onChange={(features) => onChange({ ...value, features })}
          createItem={() => ({
            id: createItemId("feat"),
            icon: "sparkles",
            title: isAssortment ? "Nieuwe kaart" : "Nieuw kenmerk",
            body: "",
            ...(isAssortment
              ? {
                  cta: {
                    label: "Productofferte aanvragen",
                    action: "link" as const,
                    link: { type: "internal_route" as const, route: "contact" as const },
                  },
                }
              : {}),
          })}
          addLabel={isAssortment ? "Kaart toevoegen" : "Kenmerk toevoegen"}
          renderItem={(item, actions, index) => (
            <div className="grid gap-3">
              {!isAssortment ? (
                <Field label="Icoon (decoratief)">
                  <input
                    className={inputClass}
                    value={item.icon}
                    onChange={(e) => actions.update({ ...item, icon: e.target.value })}
                    placeholder="sparkles"
                  />
                </Field>
              ) : null}
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
              {isAssortment ? (
                <CmsButtonEditor
                  label="Knop op deze kaart"
                  value={item.cta}
                  defaultLabel="Productofferte aanvragen"
                  enLabelPath={blockEnPath(blockId, `features.${index}.cta.label`)}
                  blockId={blockId ? `${blockId}-feat-${item.id}` : undefined}
                  onChange={(cta) => actions.update({ ...item, cta })}
                  {...imagePickerProps}
                />
              ) : null}
            </div>
          )}
        />
      </Section>
    </div>
  );
}
