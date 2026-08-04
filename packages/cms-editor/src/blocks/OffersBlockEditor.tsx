import * as React from "react";
import {
  createOfferItem,
  type OffersBlockData,
  type OfferItem,
} from "@mccoy/cms-schema";
import { EnDraftFor, NlEnField, blockEnPath } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { BlockImageField, Field, Section, inputClass } from "./shared-fields";
import type { CmsImagePickerProps } from "../image-picker-props";

type Props = {
  value: OffersBlockData;
  onChange: (next: OffersBlockData) => void;
  blockId?: string;
} & CmsImagePickerProps;

function PriceField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={inputClass}
        type="number"
        inputMode="decimal"
        min={0}
        max={1_000_000}
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
      />
    </Field>
  );
}

export function OffersBlockEditor({ value, onChange, blockId, ...imageProps }: Props) {
  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/55">
        Promotionele aanbiedingen voor op de site. Prijzen zijn weergaveprijzen uit de CMS (geen
        checkout of btw-berekening).
      </p>

      <Section title="Kop">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="Aanbiedingen"
          />
        </NlEnField>
        <NlEnField label="Subtitel" enPath={blockEnPath(blockId, "subtitle")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.subtitle ?? ""}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value || undefined })}
            placeholder="Korte introductie bij de aanbiedingen"
          />
        </NlEnField>
      </Section>

      <Section title="Aanbiedingen">
        <ObjectListEditor<OfferItem>
          items={value.offers}
          onChange={(offers) => onChange({ ...value, offers })}
          createItem={() => createOfferItem()}
          cloneItem={(item) =>
            createOfferItem({
              image: item.image,
              badge: item.badge,
              title: item.title,
              description: item.description,
              originalPrice: item.originalPrice,
              discountPrice: item.discountPrice,
            })
          }
          addLabel="Aanbieding toevoegen"
          renderItem={(item, actions, index) => (
            <div className="space-y-3">
              <Field label="Titel">
                <input
                  className={inputClass}
                  value={item.title}
                  onChange={(e) => actions.update({ ...item, title: e.target.value })}
                />
              </Field>
              <EnDraftFor fieldPath={blockEnPath(blockId, `offers.${index}.title`)} label="Titel" />
              <Field label="Badge (optioneel)">
                <input
                  className={inputClass}
                  value={item.badge ?? ""}
                  placeholder="Actie"
                  onChange={(e) =>
                    actions.update({ ...item, badge: e.target.value.trim() || undefined })
                  }
                />
              </Field>
              <EnDraftFor fieldPath={blockEnPath(blockId, `offers.${index}.badge`)} label="Badge" />
              <Field label="Beschrijving">
                <textarea
                  className={`${inputClass} min-h-[4rem]`}
                  value={item.description ?? ""}
                  onChange={(e) =>
                    actions.update({ ...item, description: e.target.value || undefined })
                  }
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `offers.${index}.description`)}
                label="Beschrijving"
                multiline
              />
              <BlockImageField
                label="Afbeelding"
                value={item.image}
                preferTags={["cms", "product", "offer"]}
                enAltPath={blockEnPath(blockId, `offers.${index}.image.alt`)}
                {...imageProps}
                onChange={(image) => actions.update({ ...item, image: image ?? undefined })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <PriceField
                  label="Oorspronkelijke prijs (€)"
                  value={item.originalPrice}
                  hint="Weergaveprijs — geen orderbedrag"
                  onChange={(originalPrice) => actions.update({ ...item, originalPrice })}
                />
                <PriceField
                  label="Aanbiedingsprijs (€)"
                  value={item.discountPrice}
                  hint="Weergaveprijs — geen orderbedrag"
                  onChange={(discountPrice) => actions.update({ ...item, discountPrice })}
                />
              </div>
              {item.originalPrice > 0 && item.discountPrice > item.originalPrice ? (
                <p className="text-[13px] text-amber-200" role="alert">
                  Aanbiedingsprijs is hoger dan de oorspronkelijke prijs.
                </p>
              ) : null}
            </div>
          )}
        />
      </Section>
    </div>
  );
}
