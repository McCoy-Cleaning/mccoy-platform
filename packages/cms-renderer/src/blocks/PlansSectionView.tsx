import * as React from "react";
import {
  createPlanFeature,
  createPlanItem,
  planFeatureInclusionLabel,
  type CmsButton,
  type PlansBlockData,
} from "@mccoy/cms-schema";
import { SECTION_TITLE, SECTION_TITLE_TIGHT } from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import {
  CmsListAddButton,
  CmsListRemoveButton,
  EditableCta,
  EditableText,
  useCmsBlockEditScope,
  useCmsEditSurface,
  useCmsTypedListEditor,
} from "../edit-surface";
import { CmsButtonView } from "./CmsButtonView";
import type { LinkResolverPages } from "./CmsImageView";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn(SECTION_TITLE, className)}>{children}</h2>;
}

function OptionalCta({
  cta,
  pages,
  className,
}: {
  cta?: CmsButton;
  pages: LinkResolverPages;
  className?: string;
}) {
  if (!cta) return null;
  return <CmsButtonView button={cta} pages={pages} className={className} />;
}

export type PlansSectionViewProps = {
  data: PlansBlockData;
  pages?: LinkResolverPages;
};

/**
 * Plans comparison matrix — extracted from RegisteredBlockView switch (Stage 5).
 */
export function PlansSectionView({ data, pages = [] }: PlansSectionViewProps) {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();
  const featuresList = useCmsTypedListEditor<PlansBlockData["features"][number]>("features");
  const plansList = useCmsTypedListEditor<PlansBlockData["plans"][number]>("plans");
  const editing = featuresList.editing || plansList.editing;
  const featuresColumnLabel =
    typeof data.featuresColumnLabel === "string" && data.featuresColumnLabel.trim()
      ? data.featuresColumnLabel.trim()
      : "Kenmerk";

  const patchPlansMatrix = (
    features: PlansBlockData["features"],
    plans: PlansBlockData["plans"],
  ) => {
    if (!scope || !surface?.sendBlockPatch) return;
    surface.sendBlockPatch(scope.blockId, { features, plans });
  };

  if (!data.plans.length && !editing) {
    return (
      <SectionShell blockType="plans">
        <h2 className={cn(SECTION_TITLE_TIGHT, "text-center")}>
          <EditableText path="title" value={data.title}>
            {data.title}
          </EditableText>
        </h2>
        <p className="text-center text-sm text-white/55">Nog geen plannen toegevoegd.</p>
      </SectionShell>
    );
  }
  return (
    <SectionShell blockType="plans">
      <SectionTitle className="text-center">
        <EditableText path="title" value={data.title}>
          {data.title}
        </EditableText>
      </SectionTitle>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm text-white/80">
          <caption className="sr-only">{data.title} — kenmerkenmatrix</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] bg-[#0b0d12] p-3 font-medium text-white/55">
                <EditableText path="featuresColumnLabel" value={featuresColumnLabel}>
                  {featuresColumnLabel}
                </EditableText>
              </th>
              {data.plans.map((plan, planIndex) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={cn(
                    "relative min-w-[9rem] p-3 align-bottom font-semibold text-white",
                    plan.highlighted && "bg-primary/10",
                  )}
                >
                  {editing ? (
                    <CmsListRemoveButton
                      label={`Plan verwijderen: ${plan.name}`}
                      className="right-1 top-1"
                      onRemove={() =>
                        patchPlansMatrix(
                          data.features,
                          data.plans.filter((p) => p.id !== plan.id),
                        )
                      }
                    />
                  ) : null}
                  <span className="block break-words">
                    <EditableText path={`plans.${planIndex}.name`} value={plan.name}>
                      {plan.name}
                    </EditableText>
                  </span>
                  {plan.price || editing ? (
                    <span className="mt-1 block text-base font-bold text-primary">
                      <EditableText path={`plans.${planIndex}.price`} value={plan.price ?? ""}>
                        {plan.price ?? ""}
                      </EditableText>
                    </span>
                  ) : null}
                  {plan.description || editing ? (
                    <span className="mt-1 block text-xs font-normal text-white/55 break-words">
                      <EditableText
                        path={`plans.${planIndex}.description`}
                        value={plan.description ?? ""}
                        multiline
                      >
                        {plan.description ?? ""}
                      </EditableText>
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.features.length === 0 ? (
              <tr>
                <td colSpan={Math.max(data.plans.length, 1) + 1} className="p-3 text-white/55">
                  Nog geen kenmerken.
                </td>
              </tr>
            ) : (
              data.features.map((f, featureIndex) => (
                <tr key={f.id} className="border-t border-white/10">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] relative bg-[#0b0d12] p-3 font-medium text-white break-words"
                  >
                    {editing ? (
                      <CmsListRemoveButton
                        label={`Kenmerk verwijderen: ${f.label}`}
                        className="right-1 top-1"
                        onRemove={() => {
                          const nextFeatures = data.features.filter((x) => x.id !== f.id);
                          const nextPlans = data.plans.map((p) => ({
                            ...p,
                            includedFeatureIds: p.includedFeatureIds.filter((id) => id !== f.id),
                          }));
                          patchPlansMatrix(nextFeatures, nextPlans);
                        }}
                      />
                    ) : null}
                    <EditableText path={`features.${featureIndex}.label`} value={f.label}>
                      {f.label}
                    </EditableText>
                  </th>
                  {data.plans.map((plan) => {
                    const ok = plan.includedFeatureIds.includes(f.id);
                    const label = planFeatureInclusionLabel(plan.name, f.label, ok);
                    return (
                      <td
                        key={`${plan.id}-${f.id}`}
                        className={cn("p-3 text-center", plan.highlighted && "bg-primary/5")}
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          <span
                            aria-hidden
                            className={ok ? "text-emerald-400" : "text-white/35"}
                          >
                            {ok ? "✓" : "✗"}
                          </span>
                          <span className="sr-only">{label}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {data.plans.some((p) => p.cta) || editing ? (
            <tfoot>
              <tr className="border-t border-white/10">
                <td className="sticky left-0 z-[1] bg-[#0b0d12] p-3" />
                {data.plans.map((plan, planIndex) => (
                  <td key={`cta-${plan.id}`} className={cn("p-3", plan.highlighted && "bg-primary/5")}>
                    {plan.cta ? (
                      <EditableCta path={`plans.${planIndex}.cta`} button={plan.cta}>
                        <OptionalCta
                          cta={plan.cta}
                          pages={pages}
                          className="inline-flex w-full justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                        />
                      </EditableCta>
                    ) : (
                      <OptionalCta
                        cta={plan.cta}
                        pages={pages}
                        className="inline-flex w-full justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                      />
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {editing ? (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <CmsListAddButton
            compact
            label="Kenmerk toevoegen"
            onAdd={() =>
              patchPlansMatrix([...data.features, createPlanFeature("Nieuw kenmerk")], data.plans)
            }
          />
          <CmsListAddButton
            compact
            label="Plan toevoegen"
            onAdd={() =>
              patchPlansMatrix(data.features, [
                ...data.plans,
                createPlanItem({ name: "Nieuw plan", includedFeatureIds: [] }),
              ])
            }
          />
        </div>
      ) : null}
    </SectionShell>
  );
}
