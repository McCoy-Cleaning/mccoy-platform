/**
 * Stage 5 family B — extracted from RegisteredBlockView switch.
 * Markup inside each view must remain byte-equivalent to the prior case body.
 */
import * as React from "react";
import {
  resolveCmsLinkHref,
  resolveSafeVideoEmbed,
  type BlockType,
  type CmsButton,
  type CmsImage,
  type RoadmapBlockData,
  type TimelineBlockData,
} from "@mccoy/cms-schema";
import { CmsButtonView } from "./CmsButtonView";
import { CmsImageView, type LinkResolverPages } from "./CmsImageView";
import { WorkMosaicGallery } from "./WorkMosaicGallery";
import { GalleryTextAndImageView } from "./GalleryTextAndImageView";
import {
  SECTION_GRID,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
} from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionEyebrow, SectionHeader, SectionIndex, SectionSurface } from "../sectionChromeUi";
import {
  cn,
  SectionTitle,
  OptionalImage,
  FitImage,
  CoverFillImage,
  OptionalCta,
  type BlockSectionViewProps,
} from "./blockViewShared";


export function ColumnsSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "columns" as BlockType;
const columns = (d.columns as Array<{ id: string; title: string; body: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "md:grid-cols-2 lg:grid-cols-3")}>
            {columns.map((c) => (
              <SectionSurface key={c.id} variant="outlined" className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground">{c.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}

export function BenefitsSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "benefits" as BlockType;
const items = (d.items as Array<{ id: string; text: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <ul className={cn(SECTION_GRID, "sm:grid-cols-2")}>
            {items.map((item, index) => (
              <li key={item.id}>
                <SectionSurface variant="outlined" className="flex h-full gap-3 p-5">
                  <SectionIndex value={String(index + 1).padStart(2, "0")} />
                  <span className="text-foreground/90">{item.text}</span>
                </SectionSurface>
              </li>
            ))}
          </ul>
        </SectionShell>
      );
}

export function RoadmapSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "roadmap" as BlockType;
const data = d as unknown as RoadmapBlockData;
      if (!data.milestones.length) {
        return (
          <SectionShell blockType={type}>
            <h2 className={SECTION_TITLE_TIGHT}>{data.title}</h2>
            <p className="text-sm text-white/55">Nog geen mijlpalen toegevoegd.</p>
          </SectionShell>
        );
      }
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{data.title}</SectionTitle>
          <ol className="relative space-y-6 border-l border-border pl-6 sm:pl-8">
            {data.milestones.map((m, i) => (
              <li key={m.id} className="relative">
                <SectionSurface variant="outlined" className="p-5 sm:p-6">
                  <div className="mb-2 flex items-center gap-3">
                    <SectionIndex value={String(i + 1).padStart(2, "0")} />
                    {m.year ? (
                      <SectionEyebrow className="tracking-wider">{m.year}</SectionEyebrow>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground break-words">{m.title}</h3>
                  {m.body ? <p className="mt-1 text-muted-foreground break-words">{m.body}</p> : null}
                  {m.bullets.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {m.bullets.map((b) => (
                        <li key={b.id} className="break-words">
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </SectionSurface>
              </li>
            ))}
          </ol>
        </SectionShell>
      );
}

export function TimelineSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "timeline" as BlockType;
const data = d as unknown as TimelineBlockData;
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{data.title}</SectionTitle>
          <ol className="space-y-4 border-l border-border pl-6">
            {data.milestones.map((m, i) => (
              <li key={m.id}>
                <SectionSurface variant="outlined" className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <SectionIndex value={i + 1} />
                    {m.year ? <SectionEyebrow>{m.year}</SectionEyebrow> : null}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{m.title}</h3>
                  {m.body ? <p className="mt-1 text-muted-foreground">{m.body}</p> : null}
                </SectionSurface>
              </li>
            ))}
          </ol>
        </SectionShell>
      );
}

export function ComparisonTableSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "comparisonTable" as BlockType;
const columns = (d.columns as string[]) ?? [];
      const rows = (d.rows as Array<{ id: string; feature: string; values: boolean[] }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-muted-foreground">
              <thead>
                <tr>
                  <th className="border-b border-border p-3" />
                  {columns.map((c) => (
                    <th key={c} className="border-b border-border p-3 font-semibold text-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b border-border/60 p-3 text-foreground">{r.feature}</td>
                    {columns.map((_, i) => (
                      <td key={`${r.id}-${i}`} className="border-b border-border/60 p-3">
                        {r.values[i] ? "✓" : "✗"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionShell>
      );
}

export function ValuesSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "values" as BlockType;
const values = (d.values as Array<{ id: string; title: string; body: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
            {values.map((v, i) => (
              <SectionSurface key={v.id} variant="outlined" className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-3">
                  <SectionIndex value={String(i + 1).padStart(2, "0")} />
                  <h3 className="font-semibold text-foreground">{v.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{v.body}</p>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}

export function PortfolioSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "portfolio" as BlockType;
const projects = (d.projects as Array<{ id: string; title: string; category?: string; image?: CmsImage }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "sm:grid-cols-2 lg:grid-cols-3")}>
            {projects.map((p) => (
              <SectionSurface key={p.id} variant="media" className="overflow-hidden">
                <FitImage image={p.image} aspectClass="aspect-video" className="w-full" />
                <div className="p-4">
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                  {p.category ? <p className="text-xs text-muted-foreground">{p.category}</p> : null}
                </div>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}
