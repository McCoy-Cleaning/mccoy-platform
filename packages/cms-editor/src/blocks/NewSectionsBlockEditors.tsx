import * as React from "react";
import {
  createFormFieldItem,
  createItemId,
  normalizeQuoteRequestForm,
  seedDefaultFurnitureCleaningFields,
  seedDefaultGlassWashingFields,
  type ContactInfoCardsBlockData,
  type LegalArticlesBlockData,
  type PartnersMarqueeBlockData,
  type QuoteFormKind,
  type QuoteRequestFormBlockData,
  type QuoteRequestFormTab,
  type StatsCountersBlockData,
} from "@mccoy/cms-schema";
import { SectionAiToolbar, collectShallowStringFields } from "../ai-assist";
import { ContactFormFieldsEditor } from "./ContactFormFieldsEditor";
import { NlEnField, blockEnPath } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { BlockImageField, Field, Section, inputClass, selectClass } from "./shared-fields";
import type { CmsImagePickerProps } from "../image-picker-props";

type BaseProps<T> = {
  value: T;
  onChange: (next: T) => void;
  blockId?: string;
} & CmsImagePickerProps;

export function PartnersMarqueeBlockEditor({
  value,
  onChange,
  blockId,
  ...imageProps
}: BaseProps<PartnersMarqueeBlockData>) {
  return (
    <div className="space-y-6">
      <Section title="Kop">
        <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
          <input
            className={inputClass}
            value={value.eyebrow ?? ""}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading ?? ""}
            onChange={(e) => onChange({ ...value, heading: e.target.value || undefined })}
          />
        </NlEnField>
        <Field label="Animatie">
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={value.animate !== false}
              onChange={(e) => onChange({ ...value, animate: e.target.checked })}
            />
            Marquee (uit bij weinig logo&apos;s / reduced motion)
          </label>
        </Field>
      </Section>
      <Section title="Partners">
        <ObjectListEditor
          items={value.items}
          onChange={(items) => onChange({ ...value, items })}
          createItem={() =>
            ({
              id: createItemId("partner"),
              name: "Partner",
            }) as PartnersMarqueeBlockData["items"][number]
          }
          addLabel="Partner toevoegen"
          renderItem={(item, actions) => (
            <div className="space-y-3">
              <Field label="Naam">
                <input
                  className={inputClass}
                  value={item.name}
                  onChange={(e) => actions.update({ ...item, name: e.target.value })}
                />
              </Field>
              <BlockImageField
                label="Logo"
                value={item.logo}
                preferTags={["partner", "logo"]}
                {...imageProps}
                onChange={(logo) => actions.update({ ...item, logo: logo ?? undefined })}
              />
              <Field label="Link (optioneel)">
                <input
                  className={inputClass}
                  value={item.href ?? ""}
                  placeholder="/ of https://"
                  onChange={(e) => actions.update({ ...item, href: e.target.value || undefined })}
                />
              </Field>
            </div>
          )}
        />
      </Section>
    </div>
  );
}

export function StatsCountersBlockEditor({
  value,
  onChange,
  blockId,
}: BaseProps<StatsCountersBlockData>) {
  return (
    <div className="space-y-6">
      <Section title="Kop">
        <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
          <input
            className={inputClass}
            value={value.eyebrow ?? ""}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading ?? ""}
            onChange={(e) => onChange({ ...value, heading: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Tekst" enPath={blockEnPath(blockId, "body")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value || undefined })}
          />
        </NlEnField>
      </Section>
      <Section title="Cijfers">
        <ObjectListEditor
          items={value.items}
          onChange={(items) => onChange({ ...value, items })}
          createItem={() => ({
            id: createItemId("stat"),
            value: "0",
            label: "Label",
            animate: true,
          })}
          addLabel="Cijfer toevoegen"
          renderItem={(item, actions) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prefix">
                <input
                  className={inputClass}
                  value={item.prefix ?? ""}
                  onChange={(e) => actions.update({ ...item, prefix: e.target.value || undefined })}
                />
              </Field>
              <Field label="Waarde">
                <input
                  className={inputClass}
                  value={item.value}
                  onChange={(e) => actions.update({ ...item, value: e.target.value })}
                />
              </Field>
              <Field label="Suffix">
                <input
                  className={inputClass}
                  value={item.suffix ?? ""}
                  onChange={(e) => actions.update({ ...item, suffix: e.target.value || undefined })}
                />
              </Field>
              <Field label="Label">
                <input
                  className={inputClass}
                  value={item.label}
                  onChange={(e) => actions.update({ ...item, label: e.target.value })}
                />
              </Field>
              <Field label="Toelichting">
                <input
                  className={inputClass}
                  value={item.supportingText ?? ""}
                  onChange={(e) =>
                    actions.update({ ...item, supportingText: e.target.value || undefined })
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={item.animate !== false}
                  onChange={(e) => actions.update({ ...item, animate: e.target.checked })}
                />
                Tel-animatie (decoratief)
              </label>
            </div>
          )}
        />
      </Section>
    </div>
  );
}

export function ContactInfoCardsBlockEditor({
  value,
  onChange,
  blockId,
}: BaseProps<ContactInfoCardsBlockData>) {
  return (
    <div className="space-y-6">
      <Section title="Kop">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading ?? ""}
            onChange={(e) => onChange({ ...value, heading: e.target.value || undefined })}
          />
        </NlEnField>
      </Section>
      <Section title="Kaarten">
        <ObjectListEditor
          items={value.items}
          onChange={(items) => onChange({ ...value, items })}
          createItem={() => ({
            id: createItemId("cinfo"),
            type: "custom" as const,
            label: "Label",
            value: "Waarde",
          })}
          addLabel="Kaart toevoegen"
          renderItem={(item, actions) => (
            <div className="space-y-3">
              <Field label="Type">
                <select
                  className={selectClass}
                  value={item.type}
                  onChange={(e) =>
                    actions.update({
                      ...item,
                      type: e.target.value as ContactInfoCardsBlockData["items"][number]["type"],
                    })
                  }
                >
                  <option value="address">Adres</option>
                  <option value="phone">Telefoon</option>
                  <option value="email">E-mail</option>
                  <option value="hours">Openingstijden</option>
                  <option value="custom">Overig</option>
                </select>
              </Field>
              <Field label="Label">
                <input
                  className={inputClass}
                  value={item.label}
                  onChange={(e) => actions.update({ ...item, label: e.target.value })}
                />
              </Field>
              <Field label="Waarde">
                <input
                  className={inputClass}
                  value={item.value}
                  onChange={(e) => actions.update({ ...item, value: e.target.value })}
                />
              </Field>
              <Field label="Actie-href (optioneel)">
                <input
                  className={inputClass}
                  value={item.action?.href ?? ""}
                  placeholder="tel: / mailto: / https:// / /pad"
                  onChange={(e) => {
                    const href = e.target.value.trim();
                    if (!href) {
                      actions.update({ ...item, action: undefined });
                      return;
                    }
                    const kind = href.startsWith("tel:")
                      ? "tel"
                      : href.startsWith("mailto:")
                        ? "mailto"
                        : href.startsWith("/")
                          ? "internal"
                          : "external";
                    actions.update({ ...item, action: { kind, href } });
                  }}
                />
              </Field>
            </div>
          )}
        />
      </Section>
    </div>
  );
}

function emptyQuoteTab(kind: QuoteFormKind): QuoteRequestFormTab {
  if (kind === "furniture_cleaning") {
    return {
      id: createItemId("tab"),
      kind,
      tag: "Vloer- & meubelreiniging",
      title: "Vloer- & meubelonderhoud",
      description: "",
      icon: "sofa",
      fields: seedDefaultFurnitureCleaningFields(),
    };
  }
  return {
    id: createItemId("tab"),
    kind: "glass_washing",
    tag: "Glasbewassing",
    title: "Glasbewassing & gevelreiniging",
    description: "",
    icon: "glass",
    fields: seedDefaultGlassWashingFields(),
  };
}

export function QuoteRequestFormBlockEditor({
  value,
  onChange,
  blockId,
}: BaseProps<QuoteRequestFormBlockData>) {
  const data = normalizeQuoteRequestForm(value);

  const updateTab = (index: number, patch: Partial<QuoteRequestFormTab>) => {
    const tabs = data.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab));
    onChange({ ...data, tabs });
  };

  return (
    <div className="space-y-6">
      <Section title="Presentatie">
        <NlEnField label="Titel (optioneel)" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={data.heading ?? ""}
            onChange={(e) => onChange({ ...data, heading: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Beschrijving (optioneel)" enPath={blockEnPath(blockId, "description")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={data.description ?? ""}
            onChange={(e) => onChange({ ...data, description: e.target.value || undefined })}
          />
        </NlEnField>
        <Field label="Standaard tab">
          <select
            className={selectClass}
            value={data.defaultTabId ?? data.tabs[0]?.id ?? ""}
            onChange={(e) => onChange({ ...data, defaultTabId: e.target.value || undefined })}
          >
            {data.tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.title || tab.tag || tab.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Verzendknop (standaard)">
          <input
            className={inputClass}
            value={data.submitLabel}
            onChange={(e) => onChange({ ...data, submitLabel: e.target.value })}
          />
        </Field>
        <Field label="Succesbericht (standaard)">
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={data.successMessage}
            onChange={(e) => onChange({ ...data, successMessage: e.target.value })}
          />
        </Field>
        <p className="text-[11px] text-white/45">
          Ontvangers, mailbox en endpoints worden server-side bepaald — niet in dit blok.
        </p>
      </Section>

      <Section title="Tabs">
        <ObjectListEditor<QuoteRequestFormTab>
          items={data.tabs}
          onChange={(tabs) => onChange({ ...data, tabs })}
          createItem={() => emptyQuoteTab("glass_washing")}
          cloneItem={(tab) => ({
            ...tab,
            id: createItemId("tab"),
            fields: tab.fields.map((f) => ({
              ...f,
              id: createFormFieldItem(f.label, f.type).id,
            })),
          })}
          addLabel="Tab toevoegen"
          renderItem={(tab, actions, index) => (
            <div className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-3">
              <Field label="Formuliertype">
                <select
                  className={selectClass}
                  value={tab.kind}
                  onChange={(e) => updateTab(index, { kind: e.target.value as QuoteFormKind })}
                >
                  <option value="glass_washing">Glasbewassing</option>
                  <option value="furniture_cleaning">Meubelreiniging</option>
                </select>
              </Field>
              <NlEnField label="Tag" enPath={blockEnPath(blockId, `tabs.${index}.tag`)}>
                <input
                  className={inputClass}
                  value={tab.tag}
                  onChange={(e) => updateTab(index, { tag: e.target.value })}
                />
              </NlEnField>
              <NlEnField label="Titel" enPath={blockEnPath(blockId, `tabs.${index}.title`)}>
                <input
                  className={inputClass}
                  value={tab.title}
                  onChange={(e) => updateTab(index, { title: e.target.value })}
                />
              </NlEnField>
              <NlEnField
                label="Beschrijving"
                enPath={blockEnPath(blockId, `tabs.${index}.description`)}
                multiline
              >
                <textarea
                  className={`${inputClass} min-h-[4rem]`}
                  value={tab.description}
                  onChange={(e) => updateTab(index, { description: e.target.value })}
                />
              </NlEnField>
              <ContactFormFieldsEditor
                fields={tab.fields}
                blockId={blockId}
                onChange={(fields) => updateTab(index, { fields })}
              />
              <div className="flex gap-2 pt-1">
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
                  Tab verwijderen
                </button>
              </div>
            </div>
          )}
        />
      </Section>
    </div>
  );
}

export function LegalArticlesBlockEditor({
  value,
  onChange,
  blockId,
}: BaseProps<LegalArticlesBlockData>) {
  const pathPrefix = blockId ? `block:${blockId}` : undefined;
  return (
    <div className="space-y-6">
      {pathPrefix ? (
        <SectionAiToolbar
          pathPrefix={pathPrefix}
          fields={collectShallowStringFields(
            value as unknown as Record<string, unknown>,
            ["eyebrow", "heading", "updatedLabel"],
            { includeEmpty: true },
          )}
          fieldLabels={{
            eyebrow: "Eyebrow",
            heading: "Paginakop",
            updatedLabel: "Bijgewerkt-label",
          }}
          onApplyDutch={(nl) => {
            const patch: Partial<LegalArticlesBlockData> = {};
            if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow || undefined;
            if (typeof nl.heading === "string") patch.heading = nl.heading;
            if (typeof nl.updatedLabel === "string") {
              patch.updatedLabel = nl.updatedLabel || undefined;
            }
            onChange({ ...value, ...patch });
          }}
        />
      ) : null}
      <Section title="Kop">
        <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
          <input
            className={inputClass}
            value={value.eyebrow ?? ""}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value || undefined })}
          />
        </NlEnField>
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading}
            onChange={(e) => onChange({ ...value, heading: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Bijgewerkt-label" enPath={blockEnPath(blockId, "updatedLabel")}>
          <input
            className={inputClass}
            value={value.updatedLabel ?? ""}
            onChange={(e) => onChange({ ...value, updatedLabel: e.target.value || undefined })}
          />
        </NlEnField>
        <Field label="Updated at (YYYY-MM-DD)">
          <input
            className={inputClass}
            value={value.updatedAt ?? ""}
            onChange={(e) => onChange({ ...value, updatedAt: e.target.value || undefined })}
          />
        </Field>
      </Section>
      <Section title="Artikelen">
        <ObjectListEditor
          items={value.articles}
          onChange={(articles) => onChange({ ...value, articles })}
          createItem={() => ({
            id: createItemId("legal"),
            heading: "Nieuw artikel",
            anchor: "nieuw-artikel",
            content: "",
          })}
          addLabel="Artikel toevoegen"
          renderItem={(item, actions, index) => (
            <div className="space-y-3">
              <NlEnField
                label="Kop"
                enPath={blockEnPath(blockId, `articles.${index}.heading`)}
              >
                <input
                  className={inputClass}
                  value={item.heading}
                  onChange={(e) => actions.update({ ...item, heading: e.target.value })}
                />
              </NlEnField>
              <Field label="Anker">
                <input
                  className={inputClass}
                  value={item.anchor}
                  onChange={(e) => actions.update({ ...item, anchor: e.target.value })}
                />
              </Field>
              <NlEnField
                label="Inhoud"
                enPath={blockEnPath(blockId, `articles.${index}.content`)}
                multiline
              >
                <textarea
                  className={`${inputClass} min-h-[6rem]`}
                  value={item.content}
                  onChange={(e) => actions.update({ ...item, content: e.target.value })}
                />
              </NlEnField>
            </div>
          )}
        />
      </Section>
    </div>
  );
}
