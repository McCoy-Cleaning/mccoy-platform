import * as React from "react";
import { createItemId, type LegalArticle, type LegalMainContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { ObjectListEditor } from "../blocks/ObjectListEditor";

export function LegalMainInspector({
  content,
  onPatch,
  sectionKey,
  itemNoun = "Sectie",
  itemNounPlural,
}: {
  content: LegalMainContent;
  onPatch: (patch: Partial<LegalMainContent>) => void;
  sectionKey: "privacy.main" | "terms.main";
  itemNoun?: string;
  itemNounPlural?: string;
}) {
  const pathPrefix = `section:${sectionKey}`;
  const plural = itemNounPlural ?? `${itemNoun}s`;

  return (
    <div className="space-y-5">
      <p className="text-[11px] leading-relaxed text-white/50">
        Bewerk de paginatitel en voeg tekstblokken toe. Elk blok is een kop met tekst — sleep
        volgorde met omhoog/omlaag. Extra lay-outblokken kun je via &quot;Sectie toevoegen&quot; in
        de lijst plaatsen.
      </p>

      <SectionAiToolbar
        pathPrefix={pathPrefix}
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "updatedLabel"],
          { includeEmpty: true },
        )}
        fieldLabels={{
          eyebrow: "Eyebrow",
          heading: "Paginakop",
          updatedLabel: "Bijgewerkt-label",
        }}
        onApplyDutch={(nl) => {
          const patch: Partial<LegalMainContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.updatedLabel === "string") patch.updatedLabel = nl.updatedLabel;
          onPatch(patch);
        }}
      />

      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Paginakop
        </p>
        <InspectTextField
          label="Eyebrow"
          value={content.eyebrow ?? ""}
          onChange={(v) => onPatch({ eyebrow: v })}
          fieldPath={`${pathPrefix}:eyebrow`}
          fieldHint="eyebrow"
          maxChars={60}
          enableAi={false}
        />
        <InspectTextField
          label="Paginakop"
          value={content.heading}
          onChange={(v) => onPatch({ heading: v })}
          fieldPath={`${pathPrefix}:heading`}
          fieldHint="heading"
          maxChars={120}
          enableAi={false}
        />
        <InspectTextField
          label="Bijgewerkt-label"
          value={content.updatedLabel ?? ""}
          onChange={(v) => onPatch({ updatedLabel: v })}
          fieldPath={`${pathPrefix}:updatedLabel`}
          fieldHint="updatedLabel"
          maxChars={160}
          enableAi={false}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {plural} ({content.articles.length})
          </p>
        </div>
        <ObjectListEditor<LegalArticle>
          items={content.articles}
          onChange={(articles) => onPatch({ articles })}
          createItem={() => ({
            id: createItemId("legal"),
            title: `Nieuw ${itemNoun.toLowerCase()}`,
            body: "",
          })}
          cloneItem={(item) => ({
            ...item,
            id: createItemId("legal"),
            title: `${item.title} (kopie)`,
          })}
          addLabel={`${itemNoun} toevoegen`}
          renderItem={(item, actions, index) => (
            <div className="grid gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {itemNoun} {index + 1}
              </p>
              <InspectTextField
                label="Titel"
                value={item.title}
                onChange={(v) => actions.update({ ...item, title: v })}
                fieldPath={`${pathPrefix}:articles.${index}.title`}
                fieldHint="title"
                maxChars={160}
                enableAi={false}
              />
              <InspectTextField
                label="Tekst"
                value={item.body}
                onChange={(v) => actions.update({ ...item, body: v })}
                fieldPath={`${pathPrefix}:articles.${index}.body`}
                fieldHint="body"
                multiline
                maxChars={8000}
                enableAi={false}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
