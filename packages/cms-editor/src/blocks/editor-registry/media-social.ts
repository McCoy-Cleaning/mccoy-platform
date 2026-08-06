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

/** Stage 5 editor registry family: media-social. */
export const mediaSocialEditorRegistry = {
  gallery: def(
    GalleryBlockEditor as ComponentType<BlockEditorProps<GalleryBlockData>>,
    "dedicated",
    [
      "title",
      "eyebrow",
      "body",
      "layout",
      "images",
      "images.id",
      "images.title",
      "images.caption",
      "images.shape",
      ...imageSupportedPaths("images.image"),
    ],
  ),
  carousel: def(
    CarouselBlockEditor as ComponentType<BlockEditorProps<CarouselBlockData>>,
    "dedicated",
    [
      "slides",
      "slides.id",
      "slides.title",
      "slides.body",
      ...imageSupportedPaths("slides.image"),
    ],
  ),
  video: def(VideoBlockEditor, "typed-composed", [
    "title",
    "description",
    "videoUrl",
    ...imageSupportedPaths("poster"),
  ]),
  beforeAfter: def(BeforeAfterBlockEditor, "typed-composed", [
    "title",
    "beforeLabel",
    "afterLabel",
    ...imageSupportedPaths("before"),
    ...imageSupportedPaths("after"),
  ]),
  quote: def(QuoteBlockEditor, "typed-composed", [
    "items",
    "items.id",
    "items.quote",
    "items.author",
    "items.role",
    "items.company",
    ...imageSupportedPaths("items.avatar"),
  ]),
  announcement: def(AnnouncementBlockEditor, "typed-composed", [
    "message",
    "linkLabel",
    "link",
  ]),
  spacer: def(SpacerBlockEditor, "typed-composed", ["size", "divider"]),
  teamGrid: def(
    TeamGridBlockEditor as ComponentType<BlockEditorProps<TeamGridBlockData>>,
    "dedicated",
    [
      "title",
      "members",
      "members.id",
      "members.name",
      "members.role",
      "members.bio",
      ...imageSupportedPaths("members.photo"),
    ],
  ),
  teamProfile: def(TeamProfileBlockEditor, "typed-composed", [
    "name",
    "role",
    "bio",
    "email",
    ...imageSupportedPaths("photo"),
  ]),
  partnersMarquee: def(
    PartnersMarqueeBlockEditor as ComponentType<BlockEditorProps<PartnersMarqueeBlockData>>,
    "dedicated",
    [
      "eyebrow",
      "heading",
      "animate",
      "items",
      "items.id",
      "items.name",
      "items.href",
      "items.logoBackdrop",
      ...imageSupportedPaths("items.logo"),
    ],
  ),
  statsCounters: def(
    StatsCountersBlockEditor as ComponentType<BlockEditorProps<StatsCountersBlockData>>,
    "dedicated",
    [
      "eyebrow",
      "heading",
      "body",
      "items",
      "items.id",
      "items.prefix",
      "items.value",
      "items.suffix",
      "items.label",
      "items.supportingText",
      "items.animate",
    ],
  ),
} as const;
