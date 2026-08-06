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

/** Stage 5 editor registry family: specialised. */
export const specialisedEditorRegistry = {
  jobs: def(
    JobsBlockEditor as ComponentType<BlockEditorProps<JobsBlockData>>,
    "dedicated",
    [
      "heading",
      "introduction",
      "displayMode",
      "showFilters",
      "emptyStateText",
      "vacancies",
    ],
    {
      "vacancies.*": "Nested vacancy fields edited via JobsBlockEditor vacancy inspector",
    },
  ),
  plans: def(
    PlansBlockEditor as ComponentType<BlockEditorProps<PlansBlockData>>,
    "dedicated",
    ["title", "features", "plans"],
    {
      "plans.cta": "Edited via nested plan CTA controls in PlansBlockEditor",
    },
  ),
  offers: def(
    OffersBlockEditor as ComponentType<BlockEditorProps<OffersBlockData>>,
    "dedicated",
    [
      "title",
      "subtitle",
      "offers",
      "offers.id",
      "offers.badge",
      "offers.title",
      "offers.description",
      "offers.originalPrice",
      "offers.discountPrice",
      ...imageSupportedPaths("offers.image"),
    ],
  ),
} as const;
