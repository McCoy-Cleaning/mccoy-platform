import * as React from "react";
import {
  createItemId,
  type ContactInfoCardsBlockData,
  type LegalArticlesBlockData,
  type PartnersMarqueeBlockData,
  type QuoteRequestFormBlockData,
  type StatsCountersBlockData,
} from "@mccoy/cms-schema";
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

export function QuoteRequestFormBlockEditor({
  value,
  onChange,
  blockId,
}: BaseProps<QuoteRequestFormBlockData>) {
  return (
    <div className="space-y-6">
      <Section title="Presentatie">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading}
            onChange={(e) => onChange({ ...value, heading: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Beschrijving" enPath={blockEnPath(blockId, "description")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.description ?? ""}
            onChange={(e) => onChange({ ...value, description: e.target.value || undefined })}
          />
        </NlEnField>
        <Field label="Standaard scope">
          <select
            className={selectClass}
            value={value.defaultScope}
            onChange={(e) =>
              onChange({
                ...value,
                defaultScope: e.target.value as QuoteRequestFormBlockData["defaultScope"],
              })
            }
          >
            <option value="glass_cleaning">Glasreiniging</option>
            <option value="furniture_cleaning">Meubelreiniging</option>
          </select>
        </Field>
        <Field label="Verzendknop">
          <input
            className={inputClass}
            value={value.submitLabel}
            onChange={(e) => onChange({ ...value, submitLabel: e.target.value })}
          />
        </Field>
        <Field label="Succesbericht">
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.successMessage}
            onChange={(e) => onChange({ ...value, successMessage: e.target.value })}
          />
        </Field>
        <p className="text-[11px] text-white/45">
          Ontvangers, mailbox en endpoints worden server-side bepaald — niet in dit blok.
        </p>
      </Section>
    </div>
  );
}

export function LegalArticlesBlockEditor({
  value,
  onChange,
  blockId,
}: BaseProps<LegalArticlesBlockData>) {
  return (
    <div className="space-y-6">
      <Section title="Kop">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "heading")}>
          <input
            className={inputClass}
            value={value.heading}
            onChange={(e) => onChange({ ...value, heading: e.target.value })}
          />
        </NlEnField>
        <Field label="Updated label">
          <input
            className={inputClass}
            value={value.updatedLabel ?? ""}
            onChange={(e) => onChange({ ...value, updatedLabel: e.target.value || undefined })}
          />
        </Field>
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
          renderItem={(item, actions) => (
            <div className="space-y-3">
              <Field label="Kop">
                <input
                  className={inputClass}
                  value={item.heading}
                  onChange={(e) => actions.update({ ...item, heading: e.target.value })}
                />
              </Field>
              <Field label="Anker">
                <input
                  className={inputClass}
                  value={item.anchor}
                  onChange={(e) => actions.update({ ...item, anchor: e.target.value })}
                />
              </Field>
              <Field label="Inhoud">
                <textarea
                  className={`${inputClass} min-h-[6rem]`}
                  value={item.content}
                  onChange={(e) => actions.update({ ...item, content: e.target.value })}
                />
              </Field>
            </div>
          )}
        />
      </Section>
    </div>
  );
}
