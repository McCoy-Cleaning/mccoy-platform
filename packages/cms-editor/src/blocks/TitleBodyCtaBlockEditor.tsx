import * as React from "react";
import type { BlockEditorPresentation, CmsButton } from "@mccoy/cms-schema";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { CmsButtonEditor, Section, inputClass } from "./shared-fields";

export type TitleBodyCtaBlockData = {
  title: string;
  body?: string;
  cta?: CmsButton;
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
  return (
    <div className="space-y-6">
      <Section title="Inhoud">
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
        <NlEnField label="Tekst" enPath={blockEnPath(blockId, "body")} multiline>
          <textarea
            className={`${inputClass} min-h-[5rem]`}
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
          />
        </NlEnField>
      </Section>
      <CmsButtonEditor
        label="Knop"
        value={value.cta}
        enLabelPath={blockEnPath(blockId, "cta.label")}
        onChange={(cta) => onChange({ ...value, cta })}
      />
    </div>
  );
}
