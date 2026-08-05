import * as React from "react";
import {
  createItemId,
  createTimelineMilestone,
  type BenefitsBlockData,
  type BlockEditorPresentation,
  type ColumnsBlockData,
  type ComparisonTableBlockData,
  type LatestPostsBlockData,
  type PortfolioBlockData,
  type StepItem,
  type StepsBlockData,
  type TextListItem,
  type TimelineBlockData,
  type ValuesBlockData,
} from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { StringListEditor } from "./StringListEditor";
import { BlockImageField, Field, Section, inputClass } from "./shared-fields";

export function ColumnsBlockEditor({
  value,
  onChange,
  blockId,
}: {
  value: ColumnsBlockData;
  onChange: (next: ColumnsBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  return (
    <div className="space-y-4">
      <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
        <input
          className={inputClass}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </NlEnField>
      <ObjectListEditor
        items={value.columns}
        onChange={(columns) => onChange({ ...value, columns })}
        createItem={() => ({ id: createItemId("col"), title: "Nieuw", body: "" })}
        addLabel="Kolom toevoegen"
        renderItem={(item, actions, index) => (
          <div className="grid gap-2">
            <input
              className={inputClass}
              placeholder="Titel"
              value={item.title}
              onChange={(e) => actions.update({ ...item, title: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `columns.${item.id}.title`)}
              label="Titel"
            />
            <textarea
              className={inputClass}
              placeholder="Tekst"
              value={item.body}
              onChange={(e) => actions.update({ ...item, body: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `columns.${item.id}.body`)}
              label="Tekst"
              multiline
            />
          </div>
        )}
      />
    </div>
  );
}

export function StepsBlockEditor({
  value,
  onChange,
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: StepsBlockData;
  onChange: (next: StepsBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  return (
    <div className="space-y-4">
      <Section title="Stappen">
        <p className="text-[11px] text-white/45">
          Horizontale slider op de site — actieve stap vergroot. Optionele afbeelding per stap.
        </p>
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
      </Section>
      <ObjectListEditor<StepItem>
        items={value.steps}
        onChange={(steps) => onChange({ ...value, steps })}
        createItem={(): StepItem => ({ id: createItemId("step"), title: "Stap", body: "" })}
        addLabel="Stap toevoegen"
        renderItem={(item, actions, index) => (
          <div className="grid gap-3">
            <Field label="Titel">
              <input
                className={inputClass}
                placeholder="Titel"
                value={item.title}
                onChange={(e) => actions.update({ ...item, title: e.target.value })}
              />
            </Field>
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `steps.${item.id}.title`)}
              label="Titel"
            />
            <Field label="Tekst">
              <textarea
                className={`${inputClass} min-h-[3rem]`}
                placeholder="Tekst"
                value={item.body}
                onChange={(e) => actions.update({ ...item, body: e.target.value })}
              />
            </Field>
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `steps.${item.id}.body`)}
              label="Tekst"
              multiline
            />
            <BlockImageField
              label="Afbeelding"
              value={item.image}
              preferTags={["steps", "process", "cms"]}
              enAltPath={blockEnPath(blockId, `steps.${item.id}.image.alt`)}
              {...imageProps}
              onChange={(image) => actions.update({ ...item, image: image ?? undefined })}
            />
          </div>
        )}
      />
    </div>
  );
}

export function ValuesBlockEditor({
  value,
  onChange,
  blockId,
}: {
  value: ValuesBlockData;
  onChange: (next: ValuesBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  return (
    <div className="space-y-4">
      <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
        <input
          className={inputClass}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </NlEnField>
      <ObjectListEditor
        items={value.values}
        onChange={(values) => onChange({ ...value, values })}
        createItem={() => ({ id: createItemId("val"), title: "Waarde", body: "" })}
        addLabel="Waarde toevoegen"
        renderItem={(item, actions, index) => (
          <div className="grid gap-2">
            <input
              className={inputClass}
              placeholder="Titel"
              value={item.title}
              onChange={(e) => actions.update({ ...item, title: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `values.${item.id}.title`)}
              label="Titel"
            />
            <textarea
              className={inputClass}
              placeholder="Tekst"
              value={item.body}
              onChange={(e) => actions.update({ ...item, body: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `values.${item.id}.body`)}
              label="Tekst"
              multiline
            />
          </div>
        )}
      />
    </div>
  );
}

export function BenefitsBlockEditor({
  value,
  onChange,
  blockId,
}: {
  value: BenefitsBlockData;
  onChange: (next: BenefitsBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  return (
    <div className="space-y-4">
      <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
        <input
          className={inputClass}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </NlEnField>
      <StringListEditor
        value={(value.items as TextListItem[]) ?? []}
        onChange={(items) => onChange({ ...value, items })}
        enPathPrefix={blockEnPath(blockId, "items")}
      />
    </div>
  );
}

export function TimelineBlockEditor({
  value,
  onChange,
  blockId,
}: {
  value: TimelineBlockData;
  onChange: (next: TimelineBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  return (
    <div className="space-y-4">
      <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
        <input
          className={inputClass}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </NlEnField>
      <ObjectListEditor
        items={value.milestones}
        onChange={(milestones) => onChange({ ...value, milestones })}
        createItem={() => createTimelineMilestone()}
        addLabel="Mijlpaal toevoegen"
        renderItem={(m, actions, index) => (
          <div className="grid gap-2">
            <input
              className={inputClass}
              placeholder="Jaar"
              value={m.year ?? ""}
              onChange={(e) => actions.update({ ...m, year: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `milestones.${index}.year`)}
              label="Jaar"
            />
            <input
              className={inputClass}
              placeholder="Titel"
              value={m.title}
              onChange={(e) => actions.update({ ...m, title: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `milestones.${index}.title`)}
              label="Titel"
            />
            <textarea
              className={inputClass}
              placeholder="Tekst"
              value={m.body ?? ""}
              onChange={(e) => actions.update({ ...m, body: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `milestones.${index}.body`)}
              label="Tekst"
              multiline
            />
          </div>
        )}
      />
    </div>
  );
}

export function ComparisonTableBlockEditor({
  value,
  onChange,
  blockId,
}: {
  value: ComparisonTableBlockData;
  onChange: (next: ComparisonTableBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  const columns = value.columns ?? [];
  const rows = value.rows ?? [];
  return (
    <div className="space-y-4">
      <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
        <input
          className={inputClass}
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </NlEnField>
      <StringListEditor
        value={columns.map((c, i) => ({ id: `col_${i}`, text: c }))}
        onChange={(items) =>
          onChange({
            ...value,
            columns: items.map((i) => i.text),
            rows: rows.map((r) => ({
              ...r,
              values: items.map((_, idx) => r.values[idx] === true),
            })),
          })
        }
        addLabel="Kolom toevoegen"
        enPathPrefix={blockEnPath(blockId, "columns")}
        enItemField=""
      />
      <ObjectListEditor
        items={rows}
        onChange={(next) => onChange({ ...value, rows: next })}
        createItem={() => ({
          id: createItemId("row"),
          feature: "Kenmerk",
          values: columns.map(() => false),
        })}
        addLabel="Rij toevoegen"
        renderItem={(row, actions, index) => (
          <div className="space-y-2">
            <input
              className={inputClass}
              value={row.feature}
              onChange={(e) => actions.update({ ...row, feature: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `rows.${index}.feature`)}
              label="Kenmerk"
            />
            <div className="flex flex-wrap gap-2">
              {columns.map((col, i) => (
                <label key={`${col}-${i}`} className="flex items-center gap-1 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={row.values[i] === true}
                    onChange={(e) => {
                      const values = [...row.values];
                      values[i] = e.target.checked;
                      actions.update({ ...row, values });
                    }}
                  />
                  {col}
                </label>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  );
}

export function PortfolioBlockEditor({
  value,
  onChange,
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: PortfolioBlockData;
  onChange: (next: PortfolioBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  return (
    <div className="space-y-4">
      <Section title="Portfolio">
        <p className="text-[11px] text-white/45">
          Handmatige projectkaarten — geen automatische posts-feed.
        </p>
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
      </Section>
      <ObjectListEditor
        items={value.projects}
        onChange={(projects) => onChange({ ...value, projects })}
        createItem={() => ({
          id: createItemId("project"),
          title: "Project",
          category: "",
        })}
        addLabel="Project toevoegen"
        renderItem={(item, actions, index) => (
          <div className="grid gap-2">
            <input
              className={inputClass}
              placeholder="Titel"
              value={item.title}
              onChange={(e) => actions.update({ ...item, title: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `projects.${index}.title`)}
              label="Titel"
            />
            <input
              className={inputClass}
              placeholder="Categorie"
              value={item.category ?? ""}
              onChange={(e) => actions.update({ ...item, category: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `projects.${index}.category`)}
              label="Categorie"
            />
            <BlockImageField
              label="Afbeelding"
              value={item.image}
              preferTags={["portfolio", "work"]}
              enAltPath={blockEnPath(blockId, `projects.${index}.image.alt`)}
              {...imageProps}
              onChange={(image) => actions.update({ ...item, image })}
            />
          </div>
        )}
      />
    </div>
  );
}

export function LatestPostsBlockEditor({
  value,
  onChange,
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: LatestPostsBlockData;
  onChange: (next: LatestPostsBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  return (
    <div className="space-y-4">
      <Section title="Uitgelichte artikelen">
        <p className="text-[11px] text-white/45">
          Handmatige kaarten — geen CMS-postsfeed. Vul artikelen hier in.
        </p>
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
      </Section>
      <ObjectListEditor
        items={value.posts}
        onChange={(posts) => onChange({ ...value, posts })}
        createItem={() => ({
          id: createItemId("post"),
          title: "Artikel",
          excerpt: "",
          date: "",
        })}
        addLabel="Artikel toevoegen"
        renderItem={(item, actions, index) => (
          <div className="grid gap-2">
            <input
              className={inputClass}
              placeholder="Titel"
              value={item.title}
              onChange={(e) => actions.update({ ...item, title: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `posts.${index}.title`)}
              label="Titel"
            />
            <textarea
              className={inputClass}
              placeholder="Samenvatting"
              value={item.excerpt ?? ""}
              onChange={(e) => actions.update({ ...item, excerpt: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `posts.${index}.excerpt`)}
              label="Samenvatting"
              multiline
            />
            <input
              className={inputClass}
              placeholder="Datum"
              value={item.date ?? ""}
              onChange={(e) => actions.update({ ...item, date: e.target.value })}
            />
            <EnDraftFor
              fieldPath={blockEnPath(blockId, `posts.${index}.date`)}
              label="Datum"
            />
            <BlockImageField
              label="Afbeelding"
              value={item.image}
              preferTags={["blog", "cms"]}
              enAltPath={blockEnPath(blockId, `posts.${index}.image.alt`)}
              {...imageProps}
              onChange={(image) => actions.update({ ...item, image })}
            />
          </div>
        )}
      />
    </div>
  );
}
