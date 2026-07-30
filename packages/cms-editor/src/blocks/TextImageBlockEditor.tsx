import * as React from "react";
import { createItemId, type BlockEditorPresentation } from "@mccoy/cms-schema";
import type { CmsImage } from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { BlockImageField, Section, inputClass } from "./shared-fields";

export type ProductsIntroMetric = {
  id: string;
  value: string;
  label: string;
};

export type TextImageBlockData = {
  title: string;
  body?: string;
  image?: CmsImage;
  reverse?: boolean;
  presentation?: "default" | "productsIntro";
  eyebrow?: string;
  notice?: string;
  metrics?: ProductsIntroMetric[];
};

const DEFAULT_METRICS: ProductsIntroMetric[] = [
  { id: "metric_products", value: "100+", label: "Producten" },
  { id: "metric_b2b", value: "B2B", label: "Groothandel" },
  { id: "metric_contact", value: "24/7", label: "Contact" },
];

function ensureMetrics(metrics: ProductsIntroMetric[] | undefined): ProductsIntroMetric[] {
  if (Array.isArray(metrics) && metrics.length > 0) {
    return metrics.map((m) => ({
      id: m.id?.trim() || createItemId("metric"),
      value: m.value ?? "",
      label: m.label ?? "",
    }));
  }
  return DEFAULT_METRICS.map((m) => ({ ...m }));
}

export function TextImageBlockEditor({
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
  value: TextImageBlockData;
  onChange: (next: TextImageBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const compact = presentation === "inline" || presentation === "compact";
  const metrics = ensureMetrics(value.metrics);

  const updateMetric = (index: number, patch: Partial<ProductsIntroMetric>) => {
    const next = metrics.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange({ ...value, metrics: next });
  };

  return (
    <div className="space-y-6">
      <Section title="Tekst">
        {value.presentation === "productsIntro" ? (
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
        <NlEnField
          label={value.presentation === "productsIntro" ? "Intro" : "Tekst"}
          enPath={blockEnPath(blockId, "body")}
          multiline
        >
          <textarea
            className={`${inputClass} min-h-[5rem]`}
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
          />
        </NlEnField>
        {value.presentation === "productsIntro" ? (
          <NlEnField label="Webshop-melding" enPath={blockEnPath(blockId, "notice")} multiline>
            <textarea
              className={`${inputClass} min-h-[3rem]`}
              value={value.notice ?? ""}
              onChange={(e) => onChange({ ...value, notice: e.target.value })}
            />
          </NlEnField>
        ) : null}
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={value.reverse === true}
            onChange={(e) => onChange({ ...value, reverse: e.target.checked })}
          />
          Afbeelding links (omgekeerde layout)
        </label>
      </Section>
      {value.presentation === "productsIntro" ? (
        <Section title="Cijfers">
          <p className="text-xs text-white/55">
            Drie metrics onder de flyer (waarde + label). Lege waarden worden niet getoond.
          </p>
          <div className="grid gap-4">
            {metrics.slice(0, 3).map((metric, index) => (
              <div
                key={metric.id || `metric-${index}`}
                className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Metric {index + 1}
                </p>
                <NlEnField
                  label="Waarde"
                  enPath={blockEnPath(blockId, `metrics.${index}.value`)}
                >
                  <input
                    className={inputClass}
                    value={metric.value}
                    onChange={(e) => updateMetric(index, { value: e.target.value })}
                    placeholder={DEFAULT_METRICS[index]?.value}
                  />
                </NlEnField>
                <NlEnField
                  label="Label"
                  enPath={blockEnPath(blockId, `metrics.${index}.label`)}
                >
                  <input
                    className={inputClass}
                    value={metric.label}
                    onChange={(e) => updateMetric(index, { label: e.target.value })}
                    placeholder={DEFAULT_METRICS[index]?.label}
                  />
                </NlEnField>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      {!compact ? (
        <Section title="Afbeelding">
          <BlockImageField
            label="Sectie-afbeelding"
            value={value.image}
            preferTags={["cms"]}
            enAltPath={blockEnPath(blockId, "image.alt")}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
            onChange={(image) => onChange({ ...value, image })}
          />
        </Section>
      ) : null}
    </div>
  );
}
