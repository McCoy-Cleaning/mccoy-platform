import * as React from "react";
import {
  createItemId,
  DEFAULT_SERVICE_CARD_CTA_LABEL,
  type ServiceCard,
} from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import { ManualEnDraftField } from "./ai-assist";
import { CmsButtonEditor } from "./blocks/shared-fields";
import { PrototypeImageField } from "./PrototypeImageField";
import type { ImagePickerProps } from "./inspector-types";
import {
  Field,
  inputClass,
  addBtnClass,
  listItemClass,
} from "./inspector-chrome";
import { RemoveIconButton, updateCardAt, removeById } from "./list-helpers";
import { PLACEHOLDER_IMAGE } from "./placeholder-image";

export function CardListEditor({
  cards,
  onChange,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  preferTags = ["services", "work"],
  enPathPrefix,
}: {
  cards: ServiceCard[];
  onChange: (cards: ServiceCard[]) => void;
  /** e.g. `section:services.cards:cards` — item fields use stable card ids */
  enPathPrefix?: string;
} & ImagePickerProps & { preferTags?: string[] }) {
  const cardEn = (cardId: string, field: string) =>
    enPathPrefix ? `${enPathPrefix}.${cardId}.${field}` : undefined;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-white/50">Kaarten ({cards.length})</p>
      <p className="text-[11px] leading-relaxed text-white/40">
        Elke kaart toont altijd <span className="text-white/60">Lees meer</span> (opent de
        detailpopup met de kaartinhoud). De contactknop hieronder is optioneel — kies{" "}
        <span className="text-white/60">Geen link</span> om alleen die knop te verbergen.
      </p>
      {cards.map((card, index) => {
        const ctaValue =
          card.cta ??
          (card.link
            ? {
                label: DEFAULT_SERVICE_CARD_CTA_LABEL,
                action: "link" as const,
                link: card.link,
              }
            : undefined);

        return (
          <div key={card.id} className={listItemClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/40">#{index + 1}</span>
              <RemoveIconButton
                label={`Kaart ${index + 1} verwijderen`}
                onClick={() => onChange(removeById(cards, card.id))}
              />
            </div>
            <PrototypeImageField
              label={`Kaartfoto #${index + 1}`}
              compact
              value={card.image ?? PLACEHOLDER_IMAGE}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={preferTags}
              onChange={(image) => onChange(updateCardAt(cards, card.id, { image }))}
            />
            <Field label="Titel">
              <input
                className={inputClass}
                value={card.title}
                onChange={(e) => onChange(updateCardAt(cards, card.id, { title: e.target.value }))}
              />
            </Field>
            {enPathPrefix ? (
              <ManualEnDraftField fieldPath={cardEn(card.id, "title")!} label="Titel" />
            ) : null}
            <Field label="Beschrijving">
              <textarea
                className={cn(inputClass, "min-h-[64px]")}
                value={card.description}
                onChange={(e) =>
                  onChange(updateCardAt(cards, card.id, { description: e.target.value }))
                }
              />
            </Field>
            {enPathPrefix ? (
              <ManualEnDraftField
                fieldPath={cardEn(card.id, "description")!}
                label="Beschrijving"
                multiline
              />
            ) : null}
            <CmsButtonEditor
              label="Contactknop (naast Lees meer)"
              value={ctaValue}
              defaultLabel={DEFAULT_SERVICE_CARD_CTA_LABEL}
              enLabelPath={cardEn(card.id, "cta.label")}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              onChange={(cta) =>
                onChange(
                  cards.map((c) => {
                    if (c.id !== card.id) return c;
                    const { link: _legacy, ...rest } = c;
                    return { ...rest, cta };
                  }),
                )
              }
            />
          </div>
        );
      })}
      <button
        type="button"
        className={addBtnClass}
        onClick={() =>
          onChange([
            ...cards,
            {
              id: createItemId("card"),
              title: "Nieuwe kaart",
              description: "",
              image: PLACEHOLDER_IMAGE,
              cta: {
                label: DEFAULT_SERVICE_CARD_CTA_LABEL,
                action: "link",
                link: { type: "internal_route", route: "contact" },
              },
            },
          ])
        }
      >
        Foto / kaart toevoegen
      </button>
      {cards.length === 0 ? (
        <p className="text-[11px] text-white/40">Nog geen kaarten — voeg hierboven een foto toe.</p>
      ) : null}
    </div>
  );
}
