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

/** Stage 5 editor registry family: structural. */
export const structuralEditorRegistry = {
  columns: def(ColumnsBlockEditor, "typed-composed", [
    "title",
    "columns",
    "columns.id",
    "columns.title",
    "columns.body",
  ]),
  steps: def(StepsBlockEditor, "typed-composed", [
    "title",
    "steps",
    "steps.id",
    "steps.title",
    "steps.body",
    ...imageSupportedPaths("steps.image"),
  ]),
  values: def(ValuesBlockEditor, "typed-composed", [
    "title",
    "values",
    "values.id",
    "values.title",
    "values.body",
  ]),
  benefits: def(BenefitsBlockEditor, "typed-composed", [
    "title",
    "items",
    "items.id",
    "items.text",
  ]),
  timeline: def(TimelineBlockEditor, "typed-composed", [
    "title",
    "milestones",
    "milestones.id",
    "milestones.year",
    "milestones.title",
    "milestones.body",
  ]),
  comparisonTable: def(ComparisonTableBlockEditor, "typed-composed", [
    "title",
    "columns",
    "rows",
    "rows.id",
    "rows.feature",
    "rows.values",
  ]),
  portfolio: def(PortfolioBlockEditor, "typed-composed", [
    "title",
    "projects",
    "projects.id",
    "projects.title",
    "projects.category",
    ...imageSupportedPaths("projects.image"),
  ]),
  roadmap: def(
    RoadmapBlockEditor as ComponentType<BlockEditorProps<RoadmapBlockData>>,
    "dedicated",
    ["title", "milestones", "milestones.id", "milestones.year", "milestones.title", "milestones.bullets"],
  ),
  latestPosts: def(LatestPostsBlockEditor, "typed-composed", [
    "title",
    "posts",
    "posts.id",
    "posts.title",
    "posts.excerpt",
    "posts.date",
    ...imageSupportedPaths("posts.image"),
  ]),
} as const;
