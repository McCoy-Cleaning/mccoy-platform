import * as React from "react";
import {
  createDefaultQuoteItem,
  createItemId,
  type AnnouncementBlockData,
  type BlockEditorPresentation,
  type QuoteBlockData,
  type QuoteTestimonialItem,
  type SpacerBlockData,
  type SpacerSize,
  type TeamProfileBlockData,
} from "@mccoy/cms-schema";
import { SectionAiToolbar } from "../ai-assist";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { BlockImageField, BlockLinkField, Field, Section, inputClass, selectClass } from "./shared-fields";

const SPACER_OPTIONS: Array<{ value: SpacerSize; label: string }> = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

export function QuoteBlockEditor({
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
  value: QuoteBlockData;
  onChange: (next: QuoteBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  void presentation;
  const items = value.items?.length ? value.items : [createDefaultQuoteItem()];
  const pathPrefix = blockId ? `block:${blockId}` : undefined;

  return (
    <div className="space-y-6">
      <Section title="Testimonials">
        <ObjectListEditor<QuoteTestimonialItem>
          items={items}
          onChange={(next) => onChange({ items: next })}
          createItem={() => ({ id: createItemId("quote"), quote: "" })}
          cloneItem={(item) => ({ ...item, id: createItemId("quote") })}
          addLabel="Testimonial toevoegen"
          renderItem={(item, actions, index) => (
            <div className="grid gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Testimonial {index + 1}
              </p>
              {pathPrefix ? (
                <SectionAiToolbar
                  pathPrefix={pathPrefix}
                  fields={{
                    [`items.${index}.quote`]: item.quote ?? "",
                    [`items.${index}.author`]: item.author ?? "",
                    [`items.${index}.role`]: item.role ?? "",
                    [`items.${index}.company`]: item.company ?? "",
                  }}
                  fieldLabels={{
                    [`items.${index}.quote`]: "Quote",
                    [`items.${index}.author`]: "Auteur",
                    [`items.${index}.role`]: "Functie",
                    [`items.${index}.company`]: "Bedrijf",
                  }}
                  onApplyDutch={(nl) => {
                    actions.update({
                      ...item,
                      quote: nl[`items.${index}.quote`] ?? item.quote,
                      author: nl[`items.${index}.author`] ?? item.author,
                      role: nl[`items.${index}.role`] ?? item.role,
                      company: nl[`items.${index}.company`] ?? item.company,
                    });
                  }}
                />
              ) : null}
              {/* EN drafts live in SectionAiToolbar when pathPrefix is set */}
              {pathPrefix ? (
                <>
                  <Field label="Quote">
                    <textarea
                      className={`${inputClass} min-h-[5rem]`}
                      value={item.quote}
                      onChange={(e) => actions.update({ ...item, quote: e.target.value })}
                    />
                  </Field>
                  <Field label="Auteur">
                    <input
                      className={inputClass}
                      value={item.author ?? ""}
                      onChange={(e) => actions.update({ ...item, author: e.target.value })}
                    />
                  </Field>
                  <Field label="Functie">
                    <input
                      className={inputClass}
                      value={item.role ?? ""}
                      onChange={(e) => actions.update({ ...item, role: e.target.value })}
                    />
                  </Field>
                  <Field label="Bedrijf">
                    <input
                      className={inputClass}
                      value={item.company ?? ""}
                      onChange={(e) => actions.update({ ...item, company: e.target.value })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <NlEnField label="Quote" enPath={blockEnPath(blockId, `items.${index}.quote`)} multiline>
                    <textarea
                      className={`${inputClass} min-h-[5rem]`}
                      value={item.quote}
                      onChange={(e) => actions.update({ ...item, quote: e.target.value })}
                    />
                  </NlEnField>
                  <NlEnField label="Auteur" enPath={blockEnPath(blockId, `items.${index}.author`)}>
                    <input
                      className={inputClass}
                      value={item.author ?? ""}
                      onChange={(e) => actions.update({ ...item, author: e.target.value })}
                    />
                  </NlEnField>
                  <NlEnField label="Functie" enPath={blockEnPath(blockId, `items.${index}.role`)}>
                    <input
                      className={inputClass}
                      value={item.role ?? ""}
                      onChange={(e) => actions.update({ ...item, role: e.target.value })}
                    />
                  </NlEnField>
                  <NlEnField label="Bedrijf" enPath={blockEnPath(blockId, `items.${index}.company`)}>
                    <input
                      className={inputClass}
                      value={item.company ?? ""}
                      onChange={(e) => actions.update({ ...item, company: e.target.value })}
                    />
                  </NlEnField>
                </>
              )}
              <BlockImageField
                label="Foto"
                value={item.avatar}
                preferTags={["team", "cms"]}
                enAltPath={blockEnPath(blockId, `items.${index}.avatar.alt`)}
                projectImages={projectImages}
                assetBaseUrl={assetBaseUrl}
                uploadToMediaLibrary={uploadToMediaLibrary}
                mediaLibraryItems={mediaLibraryItems}
                resolveProjectImage={resolveProjectImage}
                onChange={(avatar) => actions.update({ ...item, avatar })}
              />
            </div>
          )}
        />
      </Section>
    </div>
  );
}

export function AnnouncementBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: AnnouncementBlockData;
  onChange: (next: AnnouncementBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Aankondiging">
        <NlEnField label="Bericht" enPath={blockEnPath(blockId, "message")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.message}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Linktekst" enPath={blockEnPath(blockId, "linkLabel")}>
          <input
            className={inputClass}
            value={value.linkLabel ?? ""}
            onChange={(e) => onChange({ ...value, linkLabel: e.target.value })}
          />
        </NlEnField>
        <BlockLinkField
          label="Link"
          value={value.link ?? null}
          onChange={(link) => onChange({ ...value, link })}
        />
      </Section>
    </div>
  );
}

export function SpacerBlockEditor({
  value,
  onChange,
  presentation = "inspector",
}: {
  value: SpacerBlockData;
  onChange: (next: SpacerBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Ruimte">
        <Field label="Grootte">
          <select
            className={selectClass}
            value={value.size}
            onChange={(e) => onChange({ ...value, size: e.target.value as SpacerSize })}
          >
            {SPACER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={value.divider}
            onChange={(e) => onChange({ ...value, divider: e.target.checked })}
          />
          Scheidingslijn tonen
        </label>
      </Section>
    </div>
  );
}

export function TeamProfileBlockEditor({
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
  value: TeamProfileBlockData;
  onChange: (next: TeamProfileBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  void presentation;
  return (
    <div className="space-y-6">
      <Section title="Profiel">
        <NlEnField label="Naam" enPath={blockEnPath(blockId, "name")}>
          <input
            className={inputClass}
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Functie" enPath={blockEnPath(blockId, "role")}>
          <input
            className={inputClass}
            value={value.role ?? ""}
            onChange={(e) => onChange({ ...value, role: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Bio" enPath={blockEnPath(blockId, "bio")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.bio ?? ""}
            onChange={(e) => onChange({ ...value, bio: e.target.value })}
          />
        </NlEnField>
        <Field label="E-mail">
          <input
            className={inputClass}
            type="email"
            value={value.email ?? ""}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </Field>
        <BlockImageField
          label="Foto"
          value={value.photo}
          preferTags={["team", "cms"]}
          enAltPath={blockEnPath(blockId, "photo.alt")}
          projectImages={projectImages}
          assetBaseUrl={assetBaseUrl}
          uploadToMediaLibrary={uploadToMediaLibrary}
          mediaLibraryItems={mediaLibraryItems}
          resolveProjectImage={resolveProjectImage}
          onChange={(photo) => onChange({ ...value, photo })}
        />
      </Section>
    </div>
  );
}
