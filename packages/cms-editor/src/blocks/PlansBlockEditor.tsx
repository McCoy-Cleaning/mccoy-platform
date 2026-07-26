import * as React from "react";
import {
  addPlan,
  addPlanFeature,
  createPlanFeature,
  createPlanItem,
  planFeatureInclusionLabel,
  removePlan,
  removePlanFeature,
  togglePlanFeature,
  type BlockEditorPresentation,
  type CmsButton,
  type PlansBlockData,
} from "@mccoy/cms-schema";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { CmsButtonEditor, Field, Section, inputClass } from "./shared-fields";

export function PlansBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
}: {
  value: PlansBlockData;
  onChange: (next: PlansBlockData) => void;
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

      <Section title="Kenmerken (gedeelde lijst)">
        {value.features.length === 0 ? (
          <p className="text-xs text-white/50">Nog geen kenmerken — voeg er een toe voor de matrix.</p>
        ) : null}
        <ObjectListEditor
          items={value.features}
          onChange={(features) => onChange({ ...value, features })}
          createItem={() => createPlanFeature("Nieuw kenmerk")}
          addLabel="Kenmerk toevoegen"
          renderItem={(feature, actions, index) => (
            <div className="space-y-2">
              <Field label="Label">
                <input
                  className={inputClass}
                  value={feature.label}
                  onChange={(e) => actions.update({ ...feature, label: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `features.${index}.label`)}
                label="Label"
              />
              <button
                type="button"
                className="text-[11px] text-red-300"
                onClick={() => onChange(removePlanFeature(value, feature.id))}
              >
                Verwijder kenmerk (ook uit alle plannen)
              </button>
            </div>
          )}
        />
      </Section>

      <Section title="Plannen">
        {value.plans.length === 0 ? (
          <p className="text-xs text-white/50">Nog geen plannen — voeg een plan toe om de matrix te vullen.</p>
        ) : null}
        <ObjectListEditor
          items={value.plans}
          onChange={(plans) => onChange({ ...value, plans })}
          createItem={() => createPlanItem()}
          addLabel="Plan toevoegen"
          renderItem={(plan, actions, index) => (
            <div className="space-y-3">
              <div className={compact ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
                <div className="space-y-1.5">
                  <Field label="Naam">
                    <input
                      className={inputClass}
                      value={plan.name}
                      onChange={(e) => actions.update({ ...plan, name: e.target.value })}
                    />
                  </Field>
                  <EnDraftFor
                    fieldPath={blockEnPath(blockId, `plans.${index}.name`)}
                    label="Naam"
                  />
                </div>
                <div className="space-y-1.5">
                  <Field label="Prijs (weergavetekst)">
                    <input
                      className={inputClass}
                      value={plan.price ?? ""}
                      onChange={(e) => actions.update({ ...plan, price: e.target.value })}
                      placeholder="Op aanvraag"
                    />
                  </Field>
                  <EnDraftFor
                    fieldPath={blockEnPath(blockId, `plans.${index}.price`)}
                    label="Prijs"
                  />
                </div>
              </div>
              <Field label="Beschrijving">
                <textarea
                  className={`${inputClass} min-h-[3rem]`}
                  value={plan.description ?? ""}
                  onChange={(e) => actions.update({ ...plan, description: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `plans.${index}.description`)}
                label="Beschrijving"
                multiline
              />
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input
                  type="checkbox"
                  checked={plan.highlighted === true}
                  onChange={(e) => actions.update({ ...plan, highlighted: e.target.checked })}
                />
                Uitgelicht plan
              </label>

              <fieldset className="space-y-2 rounded-lg border border-white/10 p-3">
                <legend className="px-1 text-[10px] uppercase tracking-wider text-white/40">
                  Kenmerkenmatrix
                </legend>
                {value.features.length === 0 ? (
                  <p className="text-xs text-white/50">Voeg eerst kenmerken toe.</p>
                ) : (
                  <div
                    className="overflow-x-auto"
                    role="group"
                    aria-label={`Inbegrepen kenmerken voor ${plan.name}`}
                  >
                    <table className="w-full min-w-[16rem] border-collapse text-left text-sm">
                      <thead>
                        <tr>
                          <th scope="col" className="p-2 text-[10px] uppercase tracking-wider text-white/40">
                            Kenmerk
                          </th>
                          <th scope="col" className="p-2 text-[10px] uppercase tracking-wider text-white/40">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.features.map((f) => {
                          const on = plan.includedFeatureIds.includes(f.id);
                          const accessibleName = planFeatureInclusionLabel(plan.name, f.label, on);
                          return (
                            <tr key={f.id} className="border-t border-white/10">
                              <th scope="row" className="p-2 font-medium text-white/85">
                                {f.label}
                              </th>
                              <td className="p-2">
                                <label className="inline-flex cursor-pointer items-center gap-2 text-white/80">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    aria-label={accessibleName}
                                    onChange={() => onChange(togglePlanFeature(value, plan.id, f.id))}
                                  />
                                  <span aria-hidden className={on ? "text-emerald-400" : "text-white/35"}>
                                    {on ? "✓" : "✗"}
                                  </span>
                                  <span className="text-xs text-white/60">
                                    {on ? "Inbegrepen" : "Niet inbegrepen"}
                                  </span>
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </fieldset>

              {!compact ? (
                <CmsButtonEditor
                  label="CTA-knop"
                  value={plan.cta}
                  enLabelPath={blockEnPath(blockId, `plans.${index}.cta.label`)}
                  onChange={(cta: CmsButton | undefined) => actions.update({ ...plan, cta })}
                />
              ) : null}

              <button
                type="button"
                className="text-[11px] text-red-300"
                onClick={() => onChange(removePlan(value, plan.id))}
              >
                Verwijder plan
              </button>
            </div>
          )}
        />
        <button
          type="button"
          className="mt-2 text-xs text-sky-300"
          onClick={() => onChange(addPlan(value, createPlanItem()))}
        >
          Snel plan toevoegen
        </button>
        <button
          type="button"
          className="ml-3 mt-2 text-xs text-sky-300"
          onClick={() => onChange(addPlanFeature(value, createPlanFeature()))}
        >
          Snel kenmerk toevoegen
        </button>
      </Section>
    </div>
  );
}
