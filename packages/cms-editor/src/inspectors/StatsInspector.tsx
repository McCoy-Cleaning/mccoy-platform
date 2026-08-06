import * as React from "react";
import { createItemId, type StatsContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { Field, inputClass, addBtnClass, listItemClass } from "../inspector-chrome";
import { RemoveIconButton, removeById } from "../list-helpers";

export function StatsInspector({
  content,
  onPatch,
}: {
  content: StatsContent;
  onPatch: (patch: Partial<StatsContent>) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix="section:home.stats"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", body: "Tekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<StatsContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:home.stats:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading ?? ""}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:home.stats:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Tekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath="section:home.stats:body"
        fieldHint="body"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <p className="text-[11px] font-medium text-white/50">Statistieken ({content.items.length})</p>
      {content.items.map((item, index) => (
        <div key={item.id} className={listItemClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">#{index + 1}</span>
            <RemoveIconButton
              label={`Statistiek ${index + 1} verwijderen`}
              onClick={() => onPatch({ items: removeById(content.items, item.id) })}
            />
          </div>
          <Field label="Waarde">
            <input
              className={inputClass}
              value={item.value}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((s) => (s.id === item.id ? { ...s, value: e.target.value } : s)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.stats:items.${index}.value`}
            label="Waarde"
          />
          <Field label="Label">
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((s) => (s.id === item.id ? { ...s, label: e.target.value } : s)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.stats:items.${index}.label`}
            label="Label"
          />
        </div>
      ))}
      <button
        type="button"
        className={addBtnClass}
        onClick={() =>
          onPatch({
            items: [
              ...content.items,
              {
                id: createItemId("stat"),
                value: "0",
                label: "Nieuw",
              },
            ],
          })
        }
      >
        Item toevoegen
      </button>
    </div>
  );
}
