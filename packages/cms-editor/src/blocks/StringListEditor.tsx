import * as React from "react";
import {
  createTextListItem,
  type TextListItem,
} from "@mccoy/cms-schema";
import { EnDraftFor } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";

export type StringListEditorProps = {
  value: TextListItem[];
  onChange: (items: TextListItem[]) => void;
  addLabel?: string;
  className?: string;
  /**
   * Prefix for EN drafts, e.g. `block:{id}:items` → `block:{id}:items.0.text`.
   * When omitted, no EN controls are shown.
   */
  enPathPrefix?: string;
  /**
   * Leaf key under each index. Default `"text"` for TextListItem lists.
   * Use `""` for plain string arrays synced as `columns.0` (not `columns.0.text`).
   */
  enItemField?: string;
};

export function StringListEditor({
  value,
  onChange,
  addLabel = "Punt toevoegen",
  className,
  enPathPrefix,
  enItemField = "text",
}: StringListEditorProps) {
  return (
    <ObjectListEditor
      className={className}
      items={value}
      onChange={onChange}
      createItem={() => createTextListItem("")}
      addLabel={addLabel}
      renderItem={(item, actions, index) => {
        const enPath = enPathPrefix
          ? enItemField
            ? `${enPathPrefix}.${index}.${enItemField}`
            : `${enPathPrefix}.${index}`
          : undefined;
        return (
          <div className="space-y-1.5">
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Tekst</span>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                value={item.text}
                onChange={(e) => actions.update({ ...item, text: e.target.value })}
              />
            </label>
            <EnDraftFor fieldPath={enPath} label="Tekst" />
          </div>
        );
      }}
    />
  );
}
