import * as React from "react";
import { createItemId, type ProductsInfoContent } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import {
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { CmsButtonEditor } from "../blocks/shared-fields";
import { Field, inputClass, addBtnClass, listItemClass } from "../inspector-chrome";
import { RemoveIconButton, updateCardAt, removeById } from "../list-helpers";

export function ProductsInfoInspector({
  content,
  onPatch,
}: {
  content: ProductsInfoContent;
  onPatch: (patch: Partial<ProductsInfoContent>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-white/50">
        Sectiekop + introtekst, daarna de assortimentskaarten. Kaarten hebben icoon + tekst (geen
        foto&apos;s).
      </p>
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:products.info:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietitel"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:products.info:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietekst"
        value={content.intro ?? ""}
        onChange={(v) => onPatch({ intro: v })}
        fieldPath="section:products.info:intro"
        fieldHint="intro"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-white/50">Kaarten ({content.cards.length})</p>
        {content.cards.map((card, index) => (
          <div key={card.id} className={listItemClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/40">#{index + 1}</span>
              <RemoveIconButton
                label={`Kaart ${index + 1} verwijderen`}
                onClick={() => onPatch({ cards: removeById(content.cards, card.id) })}
              />
            </div>
            <Field label="Titel">
              <input
                className={inputClass}
                value={card.title}
                onChange={(e) =>
                  onPatch({ cards: updateCardAt(content.cards, card.id, { title: e.target.value }) })
                }
              />
            </Field>
            <ManualEnDraftField
              fieldPath={`section:products.info:cards.${index}.title`}
              label="Titel"
            />
            <Field label="Beschrijving">
              <textarea
                className={cn(inputClass, "min-h-[64px]")}
                value={card.description}
                onChange={(e) =>
                  onPatch({
                    cards: updateCardAt(content.cards, card.id, { description: e.target.value }),
                  })
                }
              />
            </Field>
            <ManualEnDraftField
              fieldPath={`section:products.info:cards.${index}.description`}
              label="Beschrijving"
              multiline
            />
            <CmsButtonEditor
              label="Knop op deze kaart"
              value={
                card.cta ??
                (card.link
                  ? {
                      label: "Productofferte aanvragen",
                      action: "link" as const,
                      link: card.link,
                    }
                  : undefined)
              }
              defaultLabel="Productofferte aanvragen"
              enLabelPath={`section:products.info:cards.${index}.cta.label`}
              onChange={(cta) =>
                onPatch({
                  cards: content.cards.map((c) => {
                    if (c.id !== card.id) return c;
                    const { link: _legacy, ...rest } = c;
                    return { ...rest, cta };
                  }),
                })
              }
            />
          </div>
        ))}
        <button
          type="button"
          className={addBtnClass}
          onClick={() =>
            onPatch({
              cards: [
                ...content.cards,
                {
                  id: createItemId("card"),
                  title: "Nieuwe kaart",
                  description: "",
                  cta: {
                    label: "Productofferte aanvragen",
                    action: "link",
                    link: { type: "internal_route", route: "contact" },
                  },
                },
              ],
            })
          }
        >
          Kaart toevoegen
        </button>
        {content.cards.length === 0 ? (
          <p className="text-[11px] text-white/40">Nog geen kaarten — voeg hierboven een kaart toe.</p>
        ) : null}
      </div>
      <SectionAiToolbar
        pathPrefix="section:products.info"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "intro"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Sectietitel", intro: "Sectietekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<ProductsInfoContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.intro === "string") patch.intro = nl.intro;
          onPatch(patch);
        }}
      />
    </div>
  );
}
