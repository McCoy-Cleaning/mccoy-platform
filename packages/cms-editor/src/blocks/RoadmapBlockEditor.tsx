import * as React from "react";
import {
  createRoadmapMilestone,
  type BlockEditorPresentation,
  type RoadmapBlockData,
  type RoadmapMilestone,
} from "@mccoy/cms-schema";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { StringListEditor } from "./StringListEditor";
import { EmptyHint, Section, inputClass } from "./shared-fields";

export function RoadmapBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: RoadmapBlockData;
  onChange: (next: RoadmapBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
}) {
  const compact = presentation === "inline" || presentation === "compact";
  return (
    <div className="space-y-6">
      <Section title="Kop">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
      </Section>
      <Section title="Mijlpalen">
        {value.milestones.length === 0 ? (
          <EmptyHint>Nog geen mijlpalen — voeg er een toe om de roadmap te starten.</EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.milestones}
          onChange={(milestones) => onChange({ ...value, milestones })}
          createItem={() => createRoadmapMilestone()}
          addLabel="Mijlpaal toevoegen"
          renderItem={(milestone, actions, index) => (
            <RoadmapMilestoneFields
              milestone={milestone}
              compact={compact}
              blockId={blockId}
              index={index}
              onChange={actions.update}
            />
          )}
        />
      </Section>
    </div>
  );
}

function RoadmapMilestoneFields({
  milestone,
  onChange,
  compact,
  blockId,
  index,
}: {
  milestone: RoadmapMilestone;
  onChange: (next: RoadmapMilestone) => void;
  compact?: boolean;
  blockId?: string;
  index: number;
}) {
  return (
    <div className="space-y-3">
      <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
        <NlEnField label="Jaar (optioneel)" enPath={blockEnPath(blockId, `milestones.${index}.year`)}>
          <input
            className={inputClass}
            value={milestone.year ?? ""}
            onChange={(e) => onChange({ ...milestone, year: e.target.value })}
          />
        </NlEnField>
        <NlEnField
          label="Titel"
          enPath={blockEnPath(blockId, `milestones.${index}.title`)}
          hint={!milestone.title.trim() ? "Titel is verplicht voor publicatie" : undefined}
        >
          <input
            className={inputClass}
            value={milestone.title}
            onChange={(e) => onChange({ ...milestone, title: e.target.value })}
          />
        </NlEnField>
      </div>
      <NlEnField
        label="Toelichting"
        enPath={blockEnPath(blockId, `milestones.${index}.body`)}
        multiline
      >
        <textarea
          className={`${inputClass} min-h-[4rem]`}
          value={milestone.body ?? ""}
          onChange={(e) => onChange({ ...milestone, body: e.target.value })}
        />
      </NlEnField>
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">Bullet points</p>
        {milestone.bullets.length === 0 ? (
          <p className="mb-2 text-xs text-white/45">Geen bullets — optioneel.</p>
        ) : null}
        <StringListEditor
          value={milestone.bullets}
          onChange={(bullets) => onChange({ ...milestone, bullets })}
          addLabel="Bullet toevoegen"
          enPathPrefix={blockEnPath(blockId, `milestones.${index}.bullets`)}
        />
      </div>
    </div>
  );
}
