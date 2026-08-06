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

/** Stage 5 editor registry family: information-legal. */
export const informationLegalEditorRegistry = {
  contactInfoCards: def(
    ContactInfoCardsBlockEditor as ComponentType<BlockEditorProps<ContactInfoCardsBlockData>>,
    "dedicated",
    [
      "eyebrow",
      "heading",
      "items",
      "items.id",
      "items.type",
      "items.label",
      "items.value",
      "items.secondaryValue",
      "items.icon",
      "items.action",
      "items.action.kind",
      "items.action.href",
      "items.action.label",
    ],
  ),
  legalArticles: def(
    LegalArticlesBlockEditor as ComponentType<BlockEditorProps<LegalArticlesBlockData>>,
    "dedicated",
    [
      "heading",
      "updatedLabel",
      "updatedAt",
      "articles",
      "articles.id",
      "articles.heading",
      "articles.anchor",
      "articles.content",
    ],
  ),
} as const;
