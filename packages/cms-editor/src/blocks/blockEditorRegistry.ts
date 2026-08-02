import {
  ALL_BLOCK_TYPES,
  getBlockDataDefinition,
  PUBLISHABLE_BLOCK_TYPES,
  type BlockType,
  type HeroBlockData,
  type JobsBlockData,
  type PlansBlockData,
  type RoadmapBlockData,
} from "@mccoy/cms-schema";
import type { ComponentType } from "react";
import {
  CTA_SUPPORTED_PATHS,
  imageSupportedPaths,
  type BlockEditorDefinition,
  type BlockEditorRegistryMap,
  type EditorQuality,
} from "./editor-definition";
import { CtaBlockEditor, type CtaBlockData } from "./CtaBlockEditor";
import { FeatureGridBlockEditor, type FeatureGridBlockData } from "./FeatureGridBlockEditor";
import { HeroBlockEditor } from "./HeroBlockEditor";
import { PlansBlockEditor } from "./PlansBlockEditor";
import { RoadmapBlockEditor } from "./RoadmapBlockEditor";
import { JobsBlockEditor, TeamGridBlockEditor, type TeamGridBlockData } from "./TeamJobsBlockEditor";
import { TextImageBlockEditor, type TextImageBlockData } from "./TextImageBlockEditor";
import {
  GalleryBlockEditor,
  CarouselBlockEditor,
  type GalleryBlockData,
  type CarouselBlockData,
} from "./GalleryBlockEditor";
import { TitleBodyCtaBlockEditor } from "./TitleBodyCtaBlockEditor";
import {
  BeforeAfterBlockEditor,
  VideoBlockEditor,
} from "./MediaBlockEditors";
import {
  AnnouncementBlockEditor,
  QuoteBlockEditor,
  SpacerBlockEditor,
  TeamProfileBlockEditor,
} from "./MiscBlockEditors";
import {
  ContactFormBlockEditor,
  NewsletterBlockEditor,
  PopupBlockEditor,
} from "./ConversionBlockEditors";
import {
  ContactInfoCardsBlockEditor,
  LegalArticlesBlockEditor,
  PartnersMarqueeBlockEditor,
  QuoteRequestFormBlockEditor,
  StatsCountersBlockEditor,
} from "./NewSectionsBlockEditors";
import {
  BenefitsBlockEditor,
  ColumnsBlockEditor,
  ComparisonTableBlockEditor,
  LatestPostsBlockEditor,
  PortfolioBlockEditor,
  StepsBlockEditor,
  TimelineBlockEditor,
  ValuesBlockEditor,
} from "./StructureBlockEditors";
import type { CmsImagePickerProps } from "../image-picker-props";
import type {
  ContactFormBlockData,
  ContactInfoCardsBlockData,
  LegalArticlesBlockData,
  NewsletterBlockData,
  PartnersMarqueeBlockData,
  PopupBlockData,
  QuoteRequestFormBlockData,
  StatsCountersBlockData,
} from "@mccoy/cms-schema";

export type BlockEditorProps<T = unknown> = {
  value: T;
  onChange: (next: T) => void;
  presentation?: "inspector" | "inline" | "compact";
  /** Stable block id for `block:{id}:{field}` EN draft paths. */
  blockId?: string;
} & CmsImagePickerProps;

type AnyEditor = ComponentType<BlockEditorProps<unknown>>;

function def<T>(
  Editor: ComponentType<BlockEditorProps<T>>,
  quality: Exclude<EditorQuality, "unsupported">,
  supportedPaths: readonly string[],
  nonEditablePaths?: Readonly<Record<string, string>>,
): BlockEditorDefinition<T> {
  return { Editor, quality, supportedPaths, nonEditablePaths };
}

/**
 * Typed editor registry — presence alone is not enough; `supportedPaths` must cover
 * editable schema fields (see field-coverage harness).
 */
export const blockEditorRegistry: BlockEditorRegistryMap = {
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
  roadmap: def(
    RoadmapBlockEditor as ComponentType<BlockEditorProps<RoadmapBlockData>>,
    "dedicated",
    ["title", "milestones", "milestones.id", "milestones.year", "milestones.title", "milestones.bullets"],
  ),
  plans: def(
    PlansBlockEditor as ComponentType<BlockEditorProps<PlansBlockData>>,
    "dedicated",
    ["title", "features", "plans"],
    {
      "plans.cta": "Edited via nested plan CTA controls in PlansBlockEditor",
    },
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
  spacer: def(SpacerBlockEditor, "typed-composed", ["size", "divider"]),
  teamProfile: def(TeamProfileBlockEditor, "typed-composed", [
    "name",
    "role",
    "bio",
    "email",
    ...imageSupportedPaths("photo"),
  ]),
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
  latestPosts: def(LatestPostsBlockEditor, "typed-composed", [
    "title",
    "posts",
    "posts.id",
    "posts.title",
    "posts.excerpt",
    "posts.date",
    ...imageSupportedPaths("posts.image"),
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
};

// Keep typed aliases available for callers that need them.
export type DedicatedEditorData =
  | HeroBlockData
  | CtaBlockData
  | FeatureGridBlockData
  | TextImageBlockData
  | GalleryBlockData
  | CarouselBlockData
  | JobsBlockData
  | TeamGridBlockData
  | RoadmapBlockData
  | PlansBlockData;

export function getBlockEditorDefinition(
  type: BlockType,
): BlockEditorDefinition<unknown> | null {
  return (blockEditorRegistry[type] as BlockEditorDefinition<unknown> | undefined) ?? null;
}

/** Backward-compatible: returns the Editor component only. */
export function getRegisteredBlockEditor(type: BlockType): AnyEditor | null {
  return getBlockEditorDefinition(type)?.Editor ?? null;
}

/**
 * Publishable types that still lack a dedicated/typed-composed editor registration.
 * Should be empty after production editor delivery.
 */
export function listUnsupportedPublishableBlockTypes(): BlockType[] {
  return PUBLISHABLE_BLOCK_TYPES.filter((t) => !blockEditorRegistry[t]);
}

/**
 * @deprecated Prefer {@link listUnsupportedPublishableBlockTypes} / quality checks.
 * Returns types without a registered Editor (stubs may be missing by design).
 */
export function listBlockTypesMissingDedicatedEditor(): BlockType[] {
  return ALL_BLOCK_TYPES.filter((t) => {
    const entry = blockEditorRegistry[t];
    if (!entry) return true;
    return entry.quality !== "dedicated" && entry.quality !== "typed-composed";
  });
}

export function blockEditorSummary(type: BlockType, data: unknown): string | null {
  const defn = getBlockDataDefinition(type);
  return defn.getSummary?.(data) ?? null;
}

export type { BlockEditorDefinition, EditorQuality, BlockEditorRegistryMap };
export { CTA_SUPPORTED_PATHS, imageSupportedPaths } from "./editor-definition";
