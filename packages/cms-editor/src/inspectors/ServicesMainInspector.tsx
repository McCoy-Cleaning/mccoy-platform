import * as React from "react";
import type { ServicesMainContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";

export function ServicesMainInspector({
  content,
  onPatch,
}: {
  content: ServicesMainContent;
  onPatch: (patch: Partial<ServicesMainContent>) => void;
  part?: string;
}) {
  return (
    <div className="space-y-3">
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:services.main:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:services.main:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Intro"
        value={content.intro}
        onChange={(v) => onPatch({ intro: v })}
        fieldPath="section:services.main:intro"
        fieldHint="intro"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <SectionAiToolbar
        pathPrefix="section:services.main"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "intro"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", intro: "Intro" }}
        onApplyDutch={(nl) => {
          const patch: Partial<ServicesMainContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.intro === "string") patch.intro = nl.intro;
          onPatch(patch);
        }}
      />
    </div>
  );
}
