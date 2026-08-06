import * as React from "react";
import type { HomeHeroContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { PrototypeImageField, TypedLinkField } from "../PrototypeImageField";
import type { ImagePickerProps } from "../inspector-types";
import { addBtnClass, smallBtnClass } from "../inspector-chrome";
import { PLACEHOLDER_IMAGE } from "../placeholder-image";

export function HomeHeroInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: HomeHeroContent;
  onPatch: (patch: Partial<{ [K in keyof HomeHeroContent]: HomeHeroContent[K] | null }>) => void;
} & ImagePickerProps) {
  const aiFields = collectShallowStringFields(
    content as unknown as Record<string, unknown>,
    ["eyebrow", "heading", "headingAccent", "body"],
    { includeEmpty: true },
  );
  if (content.primaryCta) {
    aiFields["primaryCta.label"] = content.primaryCta.label ?? "";
  }
  if (content.secondaryCta) {
    aiFields["secondaryCta.label"] = content.secondaryCta.label ?? "";
  }

  const applyDutch = (nl: Record<string, string>) => {
    const patch: Partial<{ [K in keyof HomeHeroContent]: HomeHeroContent[K] | null }> = {};
    if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
    if (typeof nl.heading === "string") patch.heading = nl.heading;
    if (typeof nl.headingAccent === "string") patch.headingAccent = nl.headingAccent;
    if (typeof nl.body === "string") patch.body = nl.body;
    if (typeof nl["primaryCta.label"] === "string" && content.primaryCta) {
      patch.primaryCta = { label: nl["primaryCta.label"], link: content.primaryCta.link };
    }
    if (typeof nl["secondaryCta.label"] === "string" && content.secondaryCta) {
      patch.secondaryCta = { label: nl["secondaryCta.label"], link: content.secondaryCta.link };
    }
    onPatch(patch);
  };

  return (
    <div className="space-y-4">
      <SectionAiToolbar
        pathPrefix="section:home.hero"
        fields={aiFields}
        fieldLabels={{
          eyebrow: "Eyebrow",
          heading: "Kop",
          headingAccent: "Accent",
          body: "Tekst",
          "primaryCta.label": "Primaire knop",
          "secondaryCta.label": "Secundaire knop",
        }}
        onApplyDutch={applyDutch}
      />

      <div className="space-y-3">
        <InspectTextField
          label="Eyebrow"
          value={content.eyebrow ?? ""}
          onChange={(v) => onPatch({ eyebrow: v })}
          fieldPath="section:home.hero:eyebrow"
          fieldHint="eyebrow"
          maxChars={80}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Kop"
          value={content.heading}
          onChange={(v) => onPatch({ heading: v })}
          fieldPath="section:home.hero:heading"
          fieldHint="heading"
          maxChars={120}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Accent"
          value={content.headingAccent ?? ""}
          onChange={(v) => onPatch({ headingAccent: v })}
          fieldPath="section:home.hero:headingAccent"
          fieldHint="headingAccent"
          maxChars={80}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Tekst"
          value={content.body}
          onChange={(v) => onPatch({ body: v })}
          fieldPath="section:home.hero:body"
          fieldHint="body"
          multiline
          maxChars={600}
          enableAi={false}
          showEnDraft={false}
        />
      </div>

      {content.primaryCta ? (
        <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-white/70">Primaire knop</p>
            <button type="button" className={smallBtnClass} onClick={() => onPatch({ primaryCta: null })}>
              Verwijderen
            </button>
          </div>
          <InspectTextField
            label="Label"
            value={content.primaryCta.label}
            onChange={(v) =>
              onPatch({
                primaryCta: {
                  label: v,
                  link: content.primaryCta!.link,
                },
              })
            }
            fieldPath="section:home.hero:primaryCta.label"
            fieldHint="label"
            maxChars={60}
            enableAi={false}
            showEnDraft={false}
          />
          <TypedLinkField
            label="Bestemming"
            value={content.primaryCta.link}
            onChange={(link) => {
              if (!link) {
                onPatch({ primaryCta: null });
                return;
              }
              onPatch({
                primaryCta: { label: content.primaryCta!.label, link },
              });
            }}
          />
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Primaire knop is verwijderd.</p>
      )}

      {content.secondaryCta ? (
        <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-white/70">Secundaire knop</p>
            <button type="button" className={smallBtnClass} onClick={() => onPatch({ secondaryCta: null })}>
              Verwijderen
            </button>
          </div>
          <InspectTextField
            label="Label"
            value={content.secondaryCta.label}
            onChange={(v) =>
              onPatch({
                secondaryCta: {
                  label: v,
                  link: content.secondaryCta!.link,
                },
              })
            }
            fieldPath="section:home.hero:secondaryCta.label"
            fieldHint="label"
            maxChars={60}
            enableAi={false}
            showEnDraft={false}
          />
          <TypedLinkField
            label="Bestemming"
            value={content.secondaryCta.link}
            onChange={(link) => {
              if (!link) {
                onPatch({ secondaryCta: null });
                return;
              }
              onPatch({
                secondaryCta: { label: content.secondaryCta!.label, link },
              });
            }}
          />
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Secundaire knop is verwijderd.</p>
      )}

      <div className="border-t border-white/[0.07] pt-3">
        {content.image ? (
          <PrototypeImageField
            label="Hero-afbeelding"
            compact
            value={content.image}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
            preferTags={["hero", "home"]}
            onChange={(image) => onPatch({ image })}
            onClear={() => onPatch({ image: null })}
          />
        ) : (
          <button
            type="button"
            className={addBtnClass}
            onClick={() => onPatch({ image: PLACEHOLDER_IMAGE })}
          >
            Foto toevoegen
          </button>
        )}
      </div>
    </div>
  );
}
