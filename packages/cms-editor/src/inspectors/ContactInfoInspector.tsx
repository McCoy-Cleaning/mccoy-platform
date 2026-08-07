import * as React from "react";
import { createItemId, type ContactInfoContent, type ContactInfoItem } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import { ManualEnDraftField } from "../ai-assist";
import {
  Field,
  inputClass,
  selectClass,
  listItemClass,
  smallBtnClass,
} from "../inspector-chrome";
import { RemoveIconButton, removeById } from "../list-helpers";

export function ContactInfoInspector({
  content,
  onPatch,
}: {
  content: ContactInfoContent;
  onPatch: (patch: Partial<ContactInfoContent>) => void;
}) {
  const updateItem = (id: string, patch: Partial<ContactInfoItem>) => {
    onPatch({
      items: content.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/50">
        Infokaarten op de contactpagina (e-mail, telefoon, adres, openingstijden).
      </p>
      {content.items.map((item, index) => (
        <div key={item.id} className={listItemClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">#{index + 1}</span>
            <RemoveIconButton
              label={`Kaart ${index + 1} verwijderen`}
              onClick={() => onPatch({ items: removeById(content.items, item.id) })}
            />
          </div>
          <Field label="Icoon">
            <select
              className={selectClass}
              value={item.icon}
              onChange={(e) =>
                updateItem(item.id, {
                  icon: e.target.value as ContactInfoItem["icon"],
                })
              }
            >
              <option value="mail">E-mail</option>
              <option value="phone">Telefoon</option>
              <option value="map">Adres</option>
              <option value="clock">Openingstijden</option>
            </select>
          </Field>
          <Field label="Label">
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) => updateItem(item.id, { label: e.target.value })}
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:contact.info:items.${index}.label`}
            label="Label"
          />
          <Field label="Waarde">
            <textarea
              className={cn(inputClass, "min-h-[56px]")}
              value={item.value}
              onChange={(e) => updateItem(item.id, { value: e.target.value })}
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:contact.info:items.${index}.value`}
            label="Waarde"
            multiline
          />
          <Field label="Link (optioneel)">
            <input
              className={inputClass}
              value={item.href ?? ""}
              placeholder="mailto:… of tel:…"
              onChange={(e) =>
                updateItem(item.id, { href: e.target.value.trim() ? e.target.value.trim() : undefined })
              }
            />
          </Field>
        </div>
      ))}
      <button
        type="button"
        className={smallBtnClass}
        onClick={() =>
          onPatch({
            items: [
              ...content.items,
              {
                id: createItemId("contact"),
                icon: "mail",
                label: "Nieuw",
                value: "",
              },
            ],
          })
        }
      >
        Kaart toevoegen
      </button>
    </div>
  );
}
