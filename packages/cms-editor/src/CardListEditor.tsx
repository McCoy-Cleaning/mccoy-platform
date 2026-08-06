import * as React from "react";
import { createItemId, type ProductCard, type ServiceCard } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import { ManualEnDraftField } from "./ai-assist";
import { PrototypeImageField, TypedLinkField } from "./PrototypeImageField";
import type { ImagePickerProps } from "./inspector-types";
import {
  Field,
  inputClass,
  addBtnClass,
  listItemClass,
  smallBtnClass,
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
  cards: Array<ServiceCard | ProductCard>;
  onChange: (cards: Array<ServiceCard | ProductCard>) => void;
  /** e.g. `section:services.main:cards` for nested EN draft paths */
  enPathPrefix?: string;
} & ImagePickerProps & { preferTags?: string[] }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-white/50">Kaarten ({cards.length})</p>
      {cards.map((card, index) => (
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
            <ManualEnDraftField
              fieldPath={`${enPathPrefix}.${index}.title`}
              label="Titel"
            />
          ) : null}
          <Field label="Beschrijving">
            <textarea
              className={cn(inputClass, "min-h-[64px]")}
              value={card.description}
              onChange={(e) => onChange(updateCardAt(cards, card.id, { description: e.target.value }))}
            />
          </Field>
          {enPathPrefix ? (
            <ManualEnDraftField
              fieldPath={`${enPathPrefix}.${index}.description`}
              label="Beschrijving"
              multiline
            />
          ) : null}
          {card.link ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-white/50">Kaartlink</p>
                <button
                  type="button"
                  className={smallBtnClass}
                  onClick={() => {
                    const next = cards.map((c) => {
                      if (c.id !== card.id) return c;
                      const { link: _removed, ...rest } = c;
                      return rest;
                    });
                    onChange(next);
                  }}
                >
                  Link verwijderen
                </button>
              </div>
              <TypedLinkField
                label="Link"
                value={card.link}
                onChange={(link) => onChange(updateCardAt(cards, card.id, { link: link ?? undefined }))}
              />
            </div>
          ) : (
            <p className="text-[11px] text-white/40">Kaartlink is verwijderd.</p>
          )}
        </div>
      ))}
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
