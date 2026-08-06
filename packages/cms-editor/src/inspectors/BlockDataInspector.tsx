import * as React from "react";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
  isTranslatableFieldKey,
} from "../ai-assist";
import { Field, inputClass, selectClass, optionClass } from "../inspector-chrome";

const BLOCK_STRING_KEYS = [
  "title",
  "subtitle",
  "body",
  "description",
  "eyebrow",
  "ctaLabel",
  "ctaHref",
  "image",
  "before",
  "after",
  "poster",
  "html",
  "quote",
  "author",
  "caption",
  "videoUrl",
] as const;

const BLOCK_STRING_KEY_SET = new Set<string>(BLOCK_STRING_KEYS);

const BLOCK_FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  subtitle: "Subtitel",
  body: "Tekst",
  description: "Beschrijving",
  eyebrow: "Eyebrow",
  ctaLabel: "CTA-label",
  ctaHref: "CTA-URL",
  image: "Afbeelding",
  before: "Voor (afbeelding)",
  after: "Na (afbeelding)",
  poster: "Videoposter",
  html: "HTML",
  quote: "Quote",
  author: "Auteur",
  caption: "Bijschrift",
  videoUrl: "Video-URL",
};

/** Destination URLs are edited via LinkField in advanced — avoid duplicate raw URL chrome. */
const BLOCK_LINK_KEYS_HIDDEN_IN_INSPECTOR = new Set(["ctaHref", "href", "url"]);

/** Only top-level string fields that already exist on this block — never invent empty keys. */
function editableStringKeys(blockData: Record<string, unknown>): string[] {
  const existing = Object.keys(blockData).filter((key) => typeof blockData[key] === "string");
  const ordered = BLOCK_STRING_KEYS.filter((key) => existing.includes(key));
  const extras = existing.filter((key) => !BLOCK_STRING_KEY_SET.has(key));
  return [...ordered, ...extras];
}

export function BlockDataInspector({
  blockType,
  blockData,
  onPatch,
  blockId,
}: {
  blockType?: string;
  blockData: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  /** When set, enables EN draft paths `block:{id}:{field}`. */
  blockId?: string;
}) {
  const presentKeys = editableStringKeys(blockData);
  const copyKeys = presentKeys.filter((key) => isTranslatableFieldKey(key));
  const mediaKeys = presentKeys.filter(
    (key) => !isTranslatableFieldKey(key) && !BLOCK_LINK_KEYS_HIDDEN_IN_INSPECTOR.has(key),
  );
  const pathPrefix = blockId ? `block:${blockId}` : undefined;
  const batchFields = collectShallowStringFields(blockData, copyKeys, { includeEmpty: true });
  const fieldLabels = Object.fromEntries(
    copyKeys.map((key) => [key, BLOCK_FIELD_LABELS[key] ?? key]),
  );

  return (
    <div className="space-y-4">
      {pathPrefix && copyKeys.length > 0 ? (
        <SectionAiToolbar
          pathPrefix={pathPrefix}
          fields={batchFields}
          fieldLabels={fieldLabels}
          onApplyDutch={(nl) => {
            const patch: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(nl)) {
              if (copyKeys.includes(key)) patch[key] = value;
            }
            onPatch(patch);
          }}
        />
      ) : null}

      {blockType ? (
        <p className="text-[11px] text-white/40">
          Bloktype: <span className="font-medium text-white/65">{blockType}</span>
        </p>
      ) : null}

      <div className="space-y-3">
        {copyKeys.map((key) => {
          const value = typeof blockData[key] === "string" ? (blockData[key] as string) : "";
          const multiline = key === "body" || key === "html" || key === "quote" || key === "description";
          return (
            <InspectTextField
              key={key}
              label={BLOCK_FIELD_LABELS[key] ?? key}
              value={value}
              onChange={(v) => onPatch({ [key]: v })}
              fieldPath={pathPrefix ? `${pathPrefix}:${key}` : undefined}
              fieldHint={key}
              multiline={multiline}
              maxChars={multiline ? 1200 : 200}
            enableAi={false}
            showEnDraft={false}
            />
          );
        })}
      </div>

      {mediaKeys.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.07] pt-3">
          {mediaKeys.map((key) => {
            const value = typeof blockData[key] === "string" ? (blockData[key] as string) : "";
            return (
              <Field key={key} label={BLOCK_FIELD_LABELS[key] ?? key}>
                <input
                  className={inputClass}
                  value={value}
                  onChange={(e) => onPatch({ [key]: e.target.value })}
                />
              </Field>
            );
          })}
        </div>
      ) : null}

      {"align" in blockData || "reverse" in blockData ? (
        <div className="space-y-3 border-t border-white/[0.07] pt-3">
          {"align" in blockData ? (
            <Field label="Uitlijning">
              <select
                className={selectClass}
                value={typeof blockData.align === "string" ? blockData.align : ""}
                onChange={(e) => onPatch({ align: e.target.value })}
              >
                <option className={optionClass} value="">
                  —
                </option>
                <option className={optionClass} value="left">
                  left
                </option>
                <option className={optionClass} value="center">
                  center
                </option>
                <option className={optionClass} value="right">
                  right
                </option>
              </select>
            </Field>
          ) : null}
          {"reverse" in blockData ? (
            <label className="flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={Boolean(blockData.reverse)}
                onChange={(e) => onPatch({ reverse: e.target.checked })}
              />
              Omgekeerde layout (beeld links)
            </label>
          ) : null}
        </div>
      ) : null}

      {presentKeys.length === 0 && !("align" in blockData) && !("reverse" in blockData) ? (
        <p className="text-xs text-white/45">Geen bewerkbare sleutels op dit blok.</p>
      ) : null}
    </div>
  );
}
