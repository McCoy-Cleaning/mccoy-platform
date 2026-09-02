import * as React from "react";
import { localImage, type ProductsMainContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { PrototypeImageField } from "../PrototypeImageField";
import { CmsButtonEditor } from "../blocks/shared-fields";
import type { ImagePickerProps } from "../inspector-types";
import { addBtnClass } from "../inspector-chrome";

export function ProductsMainInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: ProductsMainContent;
  onPatch: (patch: Partial<{ [K in keyof ProductsMainContent]: ProductsMainContent[K] | null }>) => void;
} & ImagePickerProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-white/50">
        Eén sectie: sectietitel, sectietekst, knoppen, webshop-notitie én flyer. Assortimentskaarten
        staan apart in &quot;Producten-info&quot;.
      </p>
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:products.main:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietitel"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:products.main:heading"
        fieldHint="heading"
        maxChars={160}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietekst"
        value={content.intro}
        onChange={(v) => onPatch({ intro: v })}
        fieldPath="section:products.main:intro"
        fieldHint="intro"
        multiline
        maxChars={1200}
        enableAi={false}
        showEnDraft={false}
      />
      <p className="text-[11px] leading-relaxed text-white/40">
        Gebruik een lege regel tussen alinea&apos;s voor meerdere paragrafen.
      </p>
      <InspectTextField
        label="Extra sectietekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath="section:products.main:body"
        fieldHint="body"
        multiline
        maxChars={500}
        enableAi={false}
        showEnDraft={false}
      />
      <p className="text-[11px] leading-relaxed text-white/40">
        Extra sectietekst verschijnt als melding onder de knoppen (webshop-notitie).
      </p>
      <CmsButtonEditor
        label="Primaire knop"
        value={content.cta}
        onChange={(cta) => onPatch({ cta })}
      />
      <CmsButtonEditor
        label="Secundaire knop"
        value={content.secondaryCta}
        onChange={(secondaryCta) => onPatch({ secondaryCta })}
      />
      {(content.metrics ?? []).map((metric, index) => (
        <div key={metric.id} className="grid grid-cols-2 gap-2">
          <InspectTextField
            label={`Metric ${index + 1} waarde`}
            value={metric.value}
            onChange={(v) => {
              const metrics = (content.metrics ?? []).map((m) =>
                m.id === metric.id ? { ...m, value: v } : m,
              );
              onPatch({ metrics });
            }}
            fieldPath={`section:products.main:metrics.${index}.value`}
            fieldHint="value"
            maxChars={24}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label={`Metric ${index + 1} label`}
            value={metric.label}
            onChange={(v) => {
              const metrics = (content.metrics ?? []).map((m) =>
                m.id === metric.id ? { ...m, label: v } : m,
              );
              onPatch({ metrics });
            }}
            fieldPath={`section:products.main:metrics.${index}.label`}
            fieldHint="label"
            maxChars={40}
            enableAi={false}
            showEnDraft={false}
          />
        </div>
      ))}
      {content.image ? (
        <PrototypeImageField
          label="Flyer"
          value={content.image}
          projectImages={projectImages}
          assetBaseUrl={assetBaseUrl}
          uploadToMediaLibrary={uploadToMediaLibrary}
          mediaLibraryItems={mediaLibraryItems}
          resolveProjectImage={resolveProjectImage}
          preferTags={["products", "work"]}
          onChange={(image) => onPatch({ image })}
          onClear={() => onPatch({ image: null })}
        />
      ) : (
        <button
          type="button"
          className={addBtnClass}
          onClick={() =>
            onPatch({
              image: localImage("/images/cms/products-flyer.png", "McCoy Cleaning Products flyer"),
            })
          }
        >
          Flyer toevoegen
        </button>
      )}
      <SectionAiToolbar
        pathPrefix="section:products.main"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "intro", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{
          eyebrow: "Eyebrow",
          heading: "Sectietitel",
          intro: "Sectietekst",
          body: "Extra sectietekst",
        }}
        onApplyDutch={(nl) => {
          const patch: Partial<ProductsMainContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.intro === "string") patch.intro = nl.intro;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
    </div>
  );
}
