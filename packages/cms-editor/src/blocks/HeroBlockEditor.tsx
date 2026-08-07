import * as React from "react";
import { createItemId, type BlockEditorPresentation, type HeroBlockData } from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { SectionAiToolbar, collectShallowStringFields } from "../ai-assist";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { BlockImageField, CmsButtonEditor, Field, Section, inputClass, selectClass } from "./shared-fields";

export function HeroBlockEditor({
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
  value: HeroBlockData;
  onChange: (next: HeroBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const compact = presentation === "inline" || presentation === "compact";
  const pathPrefix = blockId ? `block:${blockId}` : undefined;
  const accent = value.headingAccent?.accent ?? "";

  const aiFields = collectShallowStringFields(
    {
      eyebrow: value.eyebrow ?? "",
      title: value.title,
      accent,
      subtitle: value.subtitle ?? "",
      certBadge: value.certBadge ?? "",
      "cta.label": value.cta?.label ?? "",
      "secondaryCta.label": value.secondaryCta?.label ?? "",
      "highlightStat.value": value.highlightStat?.value ?? "",
      "highlightStat.label": value.highlightStat?.label ?? "",
    },
    [
      "eyebrow",
      "title",
      "accent",
      "subtitle",
      "certBadge",
      "cta.label",
      "secondaryCta.label",
      "highlightStat.value",
      "highlightStat.label",
    ],
    { includeEmpty: true },
  );

  return (
    <div className="space-y-6">
      {pathPrefix ? (
        <SectionAiToolbar
          pathPrefix={pathPrefix}
          fields={aiFields}
          fieldLabels={{
            eyebrow: "Eyebrow",
            title: "Titel",
            accent: "Accent",
            subtitle: "Tekst",
            certBadge: "Keurmerk",
            "cta.label": "Primaire knop",
            "secondaryCta.label": "Secundaire knop",
            "highlightStat.value": "Highlight waarde",
            "highlightStat.label": "Highlight label",
          }}
          onApplyDutch={(nl) => {
            const next: HeroBlockData = { ...value };
            if (typeof nl.eyebrow === "string") next.eyebrow = nl.eyebrow;
            if (typeof nl.title === "string") next.title = nl.title;
            if (typeof nl.subtitle === "string") next.subtitle = nl.subtitle;
            if (typeof nl.accent === "string") {
              next.headingAccent = nl.accent.trim()
                ? { ...(value.headingAccent ?? {}), accent: nl.accent }
                : undefined;
            }
            if (typeof nl.certBadge === "string") next.certBadge = nl.certBadge;
            if (typeof nl["cta.label"] === "string" && value.cta) {
              next.cta = { ...value.cta, label: nl["cta.label"] };
            }
            if (typeof nl["secondaryCta.label"] === "string" && value.secondaryCta) {
              next.secondaryCta = { ...value.secondaryCta, label: nl["secondaryCta.label"] };
            }
            if (
              typeof nl["highlightStat.value"] === "string" ||
              typeof nl["highlightStat.label"] === "string"
            ) {
              next.highlightStat = {
                value: nl["highlightStat.value"] ?? value.highlightStat?.value ?? "",
                label: nl["highlightStat.label"] ?? value.highlightStat?.label ?? "",
              };
            }
            onChange(next);
          }}
        />
      ) : null}

      <Section title="Koptekst">
        <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
          <input
            className={inputClass}
            value={value.eyebrow ?? ""}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
          />
        </NlEnField>
        <NlEnField
          label="Titel"
          enPath={blockEnPath(blockId, "title")}
          hint={!value.title.trim() ? "Titel is verplicht voor publicatie" : undefined}
        >
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Accent" enPath={blockEnPath(blockId, "headingAccent.accent")}>
          <input
            className={inputClass}
            value={accent}
            onChange={(e) =>
              onChange({
                ...value,
                headingAccent: e.target.value.trim()
                  ? { ...(value.headingAccent ?? {}), accent: e.target.value }
                  : undefined,
              })
            }
          />
        </NlEnField>
        <NlEnField label="Tekst" enPath={blockEnPath(blockId, "subtitle")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.subtitle ?? ""}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
          />
        </NlEnField>
        {!compact ? (
          <Field label="Uitlijning">
            <select
              className={selectClass}
              value={value.align ?? "left"}
              onChange={(e) =>
                onChange({ ...value, align: e.target.value === "center" ? "center" : "left" })
              }
            >
              <option value="left">Links (Home-pariteit)</option>
              <option value="center">Gecentreerd</option>
            </select>
          </Field>
        ) : null}
      </Section>

      {!compact ? (
        <>
          <CmsButtonEditor
            label="Call-to-action"
            value={value.cta}
            enLabelPath={blockEnPath(blockId, "cta.label")}
            onChange={(cta) => onChange({ ...value, cta })}
            blockId={blockId}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
          />
          <CmsButtonEditor
            label="Secundaire knop"
            value={value.secondaryCta}
            enLabelPath={blockEnPath(blockId, "secondaryCta.label")}
            onChange={(secondaryCta) => onChange({ ...value, secondaryCta })}
            blockId={blockId}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
          />
          <Section title="Afbeelding">
            <BlockImageField
              label="Hero-afbeelding"
              value={value.image}
              preferTags={["hero", "home"]}
              enAltPath={blockEnPath(blockId, "image.alt")}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              onChange={(image) => onChange({ ...value, image })}
            />
            <NlEnField
              label="Highlight waarde"
              enPath={blockEnPath(blockId, "highlightStat.value")}
            >
              <input
                className={inputClass}
                value={value.highlightStat?.value ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    highlightStat: {
                      value: e.target.value,
                      label: value.highlightStat?.label ?? "",
                    },
                  })
                }
              />
            </NlEnField>
            <NlEnField
              label="Highlight label"
              enPath={blockEnPath(blockId, "highlightStat.label")}
            >
              <input
                className={inputClass}
                value={value.highlightStat?.label ?? ""}
                onChange={(e) =>
                  onChange({
                    ...value,
                    highlightStat: {
                      value: value.highlightStat?.value ?? "",
                      label: e.target.value,
                    },
                  })
                }
              />
            </NlEnField>
            <NlEnField label="Keurmerk" enPath={blockEnPath(blockId, "certBadge")}>
              <input
                className={inputClass}
                value={value.certBadge ?? ""}
                onChange={(e) => onChange({ ...value, certBadge: e.target.value })}
              />
            </NlEnField>
          </Section>
          <Section title="Trust strip">
            <ObjectListEditor
              items={value.trustItems ?? []}
              onChange={(trustItems) => onChange({ ...value, trustItems })}
              createItem={() => ({
                id: createItemId("trust"),
                value: "",
                label: "",
              })}
              cloneItem={(item) => ({ ...item, id: createItemId("trust") })}
              addLabel="Stat toevoegen"
              renderItem={(item, actions, index) => (
                <div className="grid gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Stat {index + 1}
                  </p>
                  <NlEnField
                    label="Waarde"
                    enPath={blockEnPath(blockId, `trustItems.${index}.value`)}
                  >
                    <input
                      className={inputClass}
                      value={item.value}
                      onChange={(e) => actions.update({ ...item, value: e.target.value })}
                    />
                  </NlEnField>
                  <NlEnField
                    label="Label"
                    enPath={blockEnPath(blockId, `trustItems.${index}.label`)}
                  >
                    <input
                      className={inputClass}
                      value={item.label}
                      onChange={(e) => actions.update({ ...item, label: e.target.value })}
                    />
                  </NlEnField>
                </div>
              )}
            />
          </Section>
        </>
      ) : null}
    </div>
  );
}
