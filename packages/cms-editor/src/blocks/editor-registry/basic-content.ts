import type { ComponentType } from "react";
import type {
  HeroBlockData,
  JobsBlockData,
  PlansBlockData,
  RoadmapBlockData,
  ContactFormBlockData,
  ContactInfoCardsBlockData,
  LegalArticlesBlockData,
  NewsletterBlockData,
  OffersBlockData,
  PartnersMarqueeBlockData,
  PopupBlockData,
  QuoteRequestFormBlockData,
  StatsCountersBlockData,
} from "@mccoy/cms-schema";
import {
  CTA_SUPPORTED_PATHS,
  imageSupportedPaths,
  type BlockEditorProps,
} from "../editor-definition";
import { def } from "./def";
import { CtaBlockEditor, type CtaBlockData } from "../CtaBlockEditor";
import { FeatureGridBlockEditor, type FeatureGridBlockData } from "../FeatureGridBlockEditor";
import { HeroBlockEditor } from "../HeroBlockEditor";
import { PlansBlockEditor } from "../PlansBlockEditor";
import { RoadmapBlockEditor } from "../RoadmapBlockEditor";
import { JobsBlockEditor, TeamGridBlockEditor, type TeamGridBlockData } from "../TeamJobsBlockEditor";
import { TextImageBlockEditor, type TextImageBlockData } from "../TextImageBlockEditor";
import {
  GalleryBlockEditor,
  CarouselBlockEditor,
  type GalleryBlockData,
  type CarouselBlockData,
} from "../GalleryBlockEditor";
import { TitleBodyCtaBlockEditor } from "../TitleBodyCtaBlockEditor";
import { BeforeAfterBlockEditor, VideoBlockEditor } from "../MediaBlockEditors";
import {
  AnnouncementBlockEditor,
  QuoteBlockEditor,
  SpacerBlockEditor,
  TeamProfileBlockEditor,
} from "../MiscBlockEditors";
import {
  ContactFormBlockEditor,
  NewsletterBlockEditor,
  PopupBlockEditor,
} from "../ConversionBlockEditors";
import {
  ContactInfoCardsBlockEditor,
  LegalArticlesBlockEditor,
  PartnersMarqueeBlockEditor,
  QuoteRequestFormBlockEditor,
  StatsCountersBlockEditor,
} from "../NewSectionsBlockEditors";
import { OffersBlockEditor } from "../OffersBlockEditor";
import {
  BenefitsBlockEditor,
  ColumnsBlockEditor,
  ComparisonTableBlockEditor,
  LatestPostsBlockEditor,
  PortfolioBlockEditor,
  StepsBlockEditor,
  TimelineBlockEditor,
  ValuesBlockEditor,
} from "../StructureBlockEditors";

/** Stage 5 editor registry family: basic-content. */
export const basicContentEditorRegistry = {
  hero: def(
    HeroBlockEditor as ComponentType<BlockEditorProps<HeroBlockData>>,
    "dedicated",
    [
      "eyebrow",
      "title",
      "subtitle",
      "align",
      ...CTA_SUPPORTED_PATHS,
      ...imageSupportedPaths("image"),
    ],
  ),
  cta: def(
    CtaBlockEditor as ComponentType<BlockEditorProps<CtaBlockData>>,
    "dedicated",
    ["title", "body", ...CTA_SUPPORTED_PATHS],
  ),
  richText: def(TitleBodyCtaBlockEditor, "typed-composed", [
    "title",
    "body",
    ...CTA_SUPPORTED_PATHS,
  ]),
  centered: def(TitleBodyCtaBlockEditor, "typed-composed", [
    "title",
    "body",
    ...CTA_SUPPORTED_PATHS,
  ]),
  featureGrid: def(
    FeatureGridBlockEditor as ComponentType<BlockEditorProps<FeatureGridBlockData>>,
    "dedicated",
    [
      "title",
      "eyebrow",
      "intro",
      "presentation",
      "features",
      "features.id",
      "features.icon",
      "features.title",
      "features.body",
      "features.cta",
      "features.cta.label",
      "features.cta.link",
      "features.cta.action",
      "features.cta.popup",
    ],
  ),
  textImage: def(
    TextImageBlockEditor as ComponentType<BlockEditorProps<TextImageBlockData>>,
    "dedicated",
    [
      "title",
      "body",
      "eyebrow",
      "notice",
      "presentation",
      "reverse",
      ...imageSupportedPaths("image"),
    ],
  ),
} as const;
