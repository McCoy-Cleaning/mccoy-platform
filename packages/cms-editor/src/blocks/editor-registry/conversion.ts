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

/** Stage 5 editor registry family: conversion. */
export const conversionEditorRegistry = {
  newsletter: def(
    NewsletterBlockEditor as ComponentType<BlockEditorProps<NewsletterBlockData>>,
    "dedicated",
    ["title", "body", "buttonLabel", "consent"],
  ),
  contactForm: def(
    ContactFormBlockEditor as ComponentType<BlockEditorProps<ContactFormBlockData>>,
    "dedicated",
    [
      "title",
      "body",
      "fields",
      "fields.id",
      "fields.label",
      "fields.type",
      "fields.required",
      "fields.options",
      "fields.options.id",
      "fields.options.label",
    ],
    {
      recipient:
        "Ontvanger is server-config (FORM_TO_EMAIL); browser mag geen willekeurig adres kiezen.",
    },
  ),
  popup: def(
    PopupBlockEditor as ComponentType<BlockEditorProps<PopupBlockData>>,
    "typed-composed",
    ["title", "body", ...CTA_SUPPORTED_PATHS],
  ),
  quoteRequestForm: def(
    QuoteRequestFormBlockEditor as ComponentType<BlockEditorProps<QuoteRequestFormBlockData>>,
    "dedicated",
    [
      "heading",
      "description",
      "enabledScopes",
      "defaultScope",
      "submitLabel",
      "successMessage",
    ],
  ),
} as const;
