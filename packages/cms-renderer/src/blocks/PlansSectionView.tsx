import * as React from "react";
import {
  planFeatureInclusionLabel,
  type CmsButton,
  type PlansBlockData,
} from "@mccoy/cms-schema";
import { SECTION_TITLE, SECTION_TITLE_TIGHT } from "../sectionLayout";
import { SectionShell } from "../SectionShell";
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
 * Markup must stay byte-equivalent to the prior inline case.
 */
export function PlansSectionView({ data, pages = [] }: PlansSectionViewProps) {
  if (!data.plans.length) {
    return (
      <SectionShell blockType="plans">
        <h2 className={cn(SECTION_TITLE_TIGHT, "text-center")}>{data.title}</h2>
        <p className="text-center text-sm text-white/55">Nog geen plannen toegevoegd.</p>
      </SectionShell>
    );
  }
  return (
    <SectionShell blockType="plans">
      <SectionTitle className="text-center">{data.title}</SectionTitle>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm text-white/80">
          <caption className="sr-only">{data.title} — kenmerkenmatrix</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] bg-[#0b0d12] p-3 font-medium text-white/55">
                Kenmerk
              </th>
              {data.plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={cn(
                    "min-w-[9rem] p-3 align-bottom font-semibold text-white",
                    plan.highlighted && "bg-primary/10",
                  )}
                >
                  <span className="block break-words">{plan.name}</span>
                  {plan.price ? (
                    <span className="mt-1 block text-base font-bold text-primary">{plan.price}</span>
                  ) : null}
                  {plan.description ? (
                    <span className="mt-1 block text-xs font-normal text-white/55 break-words">
                      {plan.description}
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.features.length === 0 ? (
              <tr>
                <td colSpan={data.plans.length + 1} className="p-3 text-white/55">
                  Nog geen kenmerken.
                </td>
              </tr>
            ) : (
              data.features.map((f) => (
                <tr key={f.id} className="border-t border-white/10">
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] bg-[#0b0d12] p-3 font-medium text-white break-words"
                  >
                    {f.label}
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
          {data.plans.some((p) => p.cta) ? (
            <tfoot>
              <tr className="border-t border-white/10">
                <td className="sticky left-0 z-[1] bg-[#0b0d12] p-3" />
                {data.plans.map((plan) => (
                  <td key={`cta-${plan.id}`} className={cn("p-3", plan.highlighted && "bg-primary/5")}>
                    <OptionalCta
                      cta={plan.cta}
                      pages={pages}
                      className="inline-flex w-full justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    />
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </SectionShell>
  );
}
