import * as React from "react";
import {
  createOfferItem,
  DEFAULT_OFFER_DISCOUNT_BADGE,
  DEFAULT_OFFER_DISCOUNT_PRICE,
  DEFAULT_OFFER_ORIGINAL_PRICE,
  normalizeOffersLayout,
  type OffersBlockData,
  type OfferItem,
  type OffersLayout,
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

const LAYOUT_OPTIONS: Array<{ id: OffersLayout; label: string; hint: string }> = [
  {
    id: "rows",
    label: "Brede rijen",
    hint: "Grote redactionele kaarten met foto naast de tekst",
  },
  {
    id: "cards",
    label: "Rasterkaarten",
    hint: "Compacte kaarten in een raster van 2–3 kolommen",
  },
];

function LayoutChoice({
  value,
  onChange,
}: {
  value: OffersLayout;
  onChange: (next: OffersLayout) => void;
}) {
  return (
    <Field label="Lay-out" hint="Bepaalt hoe de aanbiedingen op de pagina worden getoond.">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Lay-out aanbiedingen">
        {LAYOUT_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={
                selected
                  ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-4 py-3 text-left"
                  : "rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-white/25"
              }
            >
              <span className="block text-sm font-semibold text-white">{opt.label}</span>
              <span className="mt-1 block text-xs leading-snug text-white/45">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function OffersBlockEditor({ value, onChange, blockId, ...imageProps }: Props) {
  const layout = normalizeOffersLayout(value.layout);
  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-white/55">
        Promotionele aanbiedingen voor op de site. Prijzen en kortingsbadge zijn weergavetekst uit de
        CMS (geen checkout of btw-berekening).
      </p>

      <Section title="Weergave">
        <LayoutChoice value={layout} onChange={(next) => onChange({ ...value, layout: next })} />
      </Section>

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
              discountBadge: item.discountBadge,
            })
          }
          addLabel="Aanbieding toevoegen"
          renderItem={(item, actions) => (
            <div className="space-y-3">
              <Field label="Titel">
                <input
                  className={inputClass}
                  value={item.title}
                  onChange={(e) => actions.update({ ...item, title: e.target.value })}
                />
              </Field>
              <EnDraftFor fieldPath={blockEnPath(blockId, `offers.${item.id}.title`)} label="Titel" />
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
              <EnDraftFor fieldPath={blockEnPath(blockId, `offers.${item.id}.badge`)} label="Badge" />
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
                fieldPath={blockEnPath(blockId, `offers.${item.id}.description`)}
                label="Beschrijving"
                multiline
              />
              <BlockImageField
                label="Afbeelding"
                value={item.image}
                preferTags={["cms", "product", "offer"]}
                enAltPath={blockEnPath(blockId, `offers.${item.id}.image.alt`)}
                {...imageProps}
                onChange={(image) => actions.update({ ...item, image: image ?? undefined })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <NlEnField
                  label="Oorspronkelijke prijs"
                  enPath={blockEnPath(blockId, `offers.${item.id}.originalPrice`)}
                >
                  <input
                    className={inputClass}
                    value={item.originalPrice}
                    placeholder={DEFAULT_OFFER_ORIGINAL_PRICE}
                    onChange={(e) => actions.update({ ...item, originalPrice: e.target.value })}
                  />
                </NlEnField>
                <NlEnField
                  label="Aanbiedingsprijs"
                  enPath={blockEnPath(blockId, `offers.${item.id}.discountPrice`)}
                >
                  <input
                    className={inputClass}
                    value={item.discountPrice}
                    placeholder={DEFAULT_OFFER_DISCOUNT_PRICE}
                    onChange={(e) => actions.update({ ...item, discountPrice: e.target.value })}
                  />
                </NlEnField>
              </div>
              <p className="text-[12px] text-white/40">
                Weergavetekst op de kaart (doorstreep + actieprijs) — geen orderbedrag.
              </p>
              <NlEnField
                label="Kortingsbadge"
                enPath={blockEnPath(blockId, `offers.${item.id}.discountBadge`)}
              >
                <input
                  className={inputClass}
                  value={item.discountBadge ?? ""}
                  placeholder={DEFAULT_OFFER_DISCOUNT_BADGE}
                  onChange={(e) =>
                    actions.update({
                      ...item,
                      discountBadge: e.target.value.trim() || undefined,
                    })
                  }
                />
              </NlEnField>
            </div>
          )}
        />
      </Section>
    </div>
  );
}
