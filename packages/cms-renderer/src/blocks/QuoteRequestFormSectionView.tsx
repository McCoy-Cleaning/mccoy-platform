/**
 * Stage 5 family E — extracted from RegisteredBlockView switch.
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


export function QuoteRequestFormSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "quoteRequestForm" as BlockType;
return (
        <SectionShell blockType={type}>
          <SectionHeader
            title={String(d.heading ?? "Offerte")}
            body={typeof d.description === "string" ? d.description : undefined}
            className="mb-8 sm:mb-10"
          />
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            Offerteformulier (presentatie) — server bepaalt bron en scope. Knop:{" "}
            {String(d.submitLabel ?? "Verstuur")}
          </p>
        </SectionShell>
      );
}
