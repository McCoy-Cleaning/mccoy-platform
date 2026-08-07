import * as React from "react";
import {
  createItemId,
  DEFAULT_ABOUT_INTRO_PILLARS_NL,
  type BlockEditorPresentation,
  type CmsButton,
} from "@mccoy/cms-schema";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { CmsButtonEditor, Field, Section, inputClass } from "./shared-fields";

export type AboutIntroPillar = { id: string; icon: string; label: string };

export type TitleBodyCtaBlockData = {
  title: string;
  body?: string;
  cta?: CmsButton;
  presentation?: "default" | "aboutIntro";
  eyebrow?: string;
  pillars?: AboutIntroPillar[];
};

/** Shared inspector for richText + centered (and similar title/body/cta shapes). */
export function TitleBodyCtaBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: TitleBodyCtaBlockData;
  onChange: (next: TitleBodyCtaBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  void presentation;
  const aboutIntro = value.presentation === "aboutIntro";
  const pillars =
    value.pillars && value.pillars.length > 0
      ? value.pillars
      : DEFAULT_ABOUT_INTRO_PILLARS_NL.map((p) => ({ ...p }));

  return (
    <div className="space-y-6">
      <Section title="Inhoud">
        {aboutIntro ? (
          <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
            <input
              className={inputClass}
              value={value.eyebrow ?? ""}
              onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
            />
          </NlEnField>
        ) : null}
        <NlEnField
          label="Titel"
          enPath={blockEnPath(blockId, "title")}
          hint={!value.title.trim() ? "Voeg een titel toe" : undefined}
        >
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        {!aboutIntro ? (
          <NlEnField label="Tekst" enPath={blockEnPath(blockId, "body")} multiline>
            <textarea
              className={`${inputClass} min-h-[5rem]`}
              value={value.body ?? ""}
              onChange={(e) => onChange({ ...value, body: e.target.value })}
            />
          </NlEnField>
        ) : null}
      </Section>

      {aboutIntro ? (
        <Section title="Tegelknoppen">
          <p className="text-[11px] text-white/50">
            De vier tegelknoppen naast de Over ons-kop (Premium kwaliteit, …).
          </p>
          <ObjectListEditor<AboutIntroPillar>
            items={pillars}
            onChange={(next) => onChange({ ...value, pillars: next })}
            createItem={() => ({
              id: createItemId("pillar"),
              icon: "award",
              label: "Nieuwe tegel",
            })}
            cloneItem={(item) => ({ ...item, id: createItemId("pillar") })}
            addLabel="Tegel toevoegen"
            renderItem={(item, actions) => (
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/10 p-2">
                <Field label="Label">
                  <input
                    className={inputClass}
                    value={item.label}
                    onChange={(e) => actions.update({ ...item, label: e.target.value })}
                  />
                </Field>
                <Field label="Icoon" hint="award | shield | users | leaf">
                  <input
                    className={inputClass}
                    value={item.icon}
                    onChange={(e) => actions.update({ ...item, icon: e.target.value })}
                  />
                </Field>
                <div className="flex gap-2">
                  <button type="button" className="text-xs text-white/50 hover:text-white" onClick={actions.moveUp}>
                    Omhoog
                  </button>
                  <button type="button" className="text-xs text-white/50 hover:text-white" onClick={actions.moveDown}>
                    Omlaag
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-300/80 hover:text-rose-200"
                    onClick={actions.remove}
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            )}
          />
        </Section>
      ) : null}

      <CmsButtonEditor
        label="Knop"
        value={value.cta}
        enLabelPath={blockEnPath(blockId, "cta.label")}
        onChange={(cta) => onChange({ ...value, cta })}
      />
    </div>
  );
}
