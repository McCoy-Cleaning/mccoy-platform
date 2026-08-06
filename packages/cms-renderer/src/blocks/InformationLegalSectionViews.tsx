/**
 * Stage 5 family D — extracted from RegisteredBlockView switch.
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


export function ContactInfoCardsSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "contactInfoCards" as BlockType;
const items =
        (d.items as Array<{
          id: string;
          label: string;
          value: string;
          secondaryValue?: string;
          action?: { kind: string; href: string; label?: string };
        }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionHeader
            title={typeof d.heading === "string" ? d.heading : undefined}
            className="mb-10 sm:mb-12"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const href = item.action?.href;
              const safe =
                href &&
                (href.startsWith("/") ||
                  href.startsWith("https://") ||
                  href.startsWith("http://") ||
                  href.startsWith("mailto:") ||
                  href.startsWith("tel:"))
                  ? href
                  : null;
              const inner = (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-medium text-foreground">{item.value}</p>
                  {item.secondaryValue ? (
                    <p className="mt-1 text-sm text-muted-foreground">{item.secondaryValue}</p>
                  ) : null}
                </>
              );
              return safe ? (
                <a key={item.id} href={safe} className="block transition hover:opacity-95">
                  <SectionSurface variant="outlined" className="h-full p-5 hover:border-primary/35">
                    {inner}
                  </SectionSurface>
                </a>
              ) : (
                <SectionSurface key={item.id} variant="outlined" className="p-5">
                  {inner}
                </SectionSurface>
              );
            })}
          </div>
        </SectionShell>
      );
}

export function LegalArticlesSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "legalArticles" as BlockType;
const articles =
        (d.articles as Array<{ id: string; heading: string; anchor: string; content: string }>) ??
        [];
      return (
        <SectionShell blockType={type} innerMaxWidth="3xl">
          <h1 className="font-display text-4xl text-foreground">{String(d.heading ?? "")}</h1>
          {typeof d.updatedLabel === "string" && d.updatedAt ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {d.updatedLabel}: {String(d.updatedAt)}
            </p>
          ) : null}
          {articles.length > 1 ? (
            <SectionSurface variant="outlined" className="mt-8 p-4">
              <nav aria-label="Inhoudsopgave">
                <ol className="space-y-2 text-sm">
                  {articles.map((a) => (
                    <li key={a.id}>
                      <a className="text-primary hover:underline" href={`#${a.anchor}`}>
                        {a.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </SectionSurface>
          ) : null}
          <div className="mt-10 space-y-10">
            {articles.map((a) => (
              <SectionSurface key={a.id} variant="outlined" className="p-5 sm:p-6">
                <article id={a.anchor}>
                  <h2 className="font-display text-2xl text-foreground">{a.heading}</h2>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
                    {a.content}
                  </p>
                </article>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}
