import * as React from "react";
import {
  createItemId,
  resolveLogoBackdrop,
  type LogoBackdropPreference,
  type PartnersContent,
} from "@mccoy/cms-schema";
import {
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { BulkImageAddButton, ImageStripPreview } from "../BulkImageAdd";
import type { ImagePickerProps } from "../inspector-types";
import { Field, inputClass } from "../inspector-chrome";
import { removeById } from "../list-helpers";

export function PartnersInspector({
  content,
  onPatch,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: PartnersContent;
  onPatch: (patch: Partial<PartnersContent>) => void;
} & ImagePickerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = content.items.find((i) => i.id === selectedId) ?? null;
  const selectedIndex = selected ? content.items.findIndex((i) => i.id === selected.id) : -1;

  const patchItem = (id: string, patch: Partial<(typeof content.items)[number]>) => {
    onPatch({
      items: content.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix="section:home.partners"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop" }}
        onApplyDutch={(nl) => {
          const patch: Partial<PartnersContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:home.partners:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:home.partners:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
          Logo&apos;s ({content.items.length})
        </p>
        <ImageStripPreview
          assetBaseUrl={assetBaseUrl}
          size="large"
          emptyLabel="Nog geen partnerlogo's — upload er hieronder meerdere tegelijk."
          removeLabel={(item) => `Verwijder logo${item.title || item.alt ? ` ${item.title || item.alt}` : ""}`}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          onRemove={(id) => {
            onPatch({ items: removeById(content.items, id) });
            if (selectedId === id) setSelectedId(null);
          }}
          items={content.items.map((item) => {
            const backdrop = resolveLogoBackdrop(item);
            return {
              id: item.id,
              src: item.image.src,
              alt: item.image.alt,
              title: item.name,
              cardStyle: { backgroundColor: backdrop },
            };
          })}
        />
        {selected && selectedIndex >= 0 ? (
          <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2.5">
            <p className="text-[11px] font-medium text-white/60">
              Geselecteerd: <span className="text-white/90">{selected.name || "Logo"}</span>
            </p>
            <Field label="Naam">
              <input
                className={inputClass}
                value={selected.name}
                onChange={(e) => patchItem(selected.id, { name: e.target.value })}
              />
            </Field>
            <ManualEnDraftField
              fieldPath={`section:home.partners:items.${selectedIndex}.name`}
              label="Naam"
            />
            <Field label="Logo-achtergrond">
              <select
                className={inputClass}
                value={
                  selected.logoBackdrop === "white"
                    ? "light"
                    : selected.logoBackdrop === "black"
                      ? "dark"
                      : (selected.logoBackdrop ?? "auto")
                }
                onChange={(e) => {
                  const logoBackdrop = e.target.value as LogoBackdropPreference;
                  patchItem(selected.id, { logoBackdrop });
                }}
                aria-describedby={`partner-backdrop-hint-${selected.id}`}
              >
                <option value="auto">Automatisch (plaatkleur)</option>
                <option value="light">Wit</option>
                <option value="dark">Zwart</option>
              </select>
            </Field>
            <p id={`partner-backdrop-hint-${selected.id}`} className="text-[10px] leading-snug text-white/40">
              Automatisch gebruikt de plaatkleur van de upload
              {selected.resolvedBackdrop
                ? ` (nu: ${resolveLogoBackdrop(selected)})`
                : " (standaard wit voor bestaande logo's)"}
              . Kies wit of zwart om handmatig te corrigeren.
            </p>
          </div>
        ) : content.items.length > 0 ? (
          <p className="text-[10px] text-white/40">Klik een logo om naam of achtergrond te wijzigen.</p>
        ) : null}
        <BulkImageAddButton
          label="Meerdere logo's uploaden"
          profile="logo"
          tags={["partners", "logo"]}
          uploadToMediaLibrary={uploadToMediaLibrary}
          onAdded={(uploaded) => {
            const added = uploaded.map((u) => ({
              id: createItemId("partner"),
              name: u.label,
              logoBackdrop: "auto" as const,
              resolvedBackdrop: u.logoBackdrop ?? "#ffffff",
              image: { ...u.image, alt: u.label, decorative: false },
            }));
            onPatch({ items: [...content.items, ...added] });
          }}
        />
      </div>
    </div>
  );
}
