import type { BlockType } from "@mccoy/cms-schema";
import type { ComponentType } from "react";
import { JobsSectionView, type JobsSectionViewProps } from "./JobsSectionView";
import { OffersSectionView, type OffersSectionViewProps } from "./OffersSectionView";
import { PlansSectionView, type PlansSectionViewProps } from "./PlansSectionView";
import { StepsSectionView, type StepsSectionViewProps } from "./StepsSectionView";
import {
  ContactFormSectionView,
  NewsletterSectionView,
  PopupSectionView,
} from "./ConversionSectionViews";
import { HeroSectionView, RichTextSectionView, CenteredSectionView, CtaSectionView, TextImageSectionView, FeatureGridSectionView } from "./BasicContentSectionViews";
import { ColumnsSectionView, BenefitsSectionView, RoadmapSectionView, TimelineSectionView, ComparisonTableSectionView, ValuesSectionView, PortfolioSectionView } from "./StructuralSectionViews";
import { GallerySectionView, VideoSectionView, BeforeAfterSectionView, CarouselSectionView, SpacerSectionView, QuoteSectionView, TeamGridSectionView, TeamProfileSectionView, AnnouncementSectionView, LatestPostsSectionView, PartnersMarqueeSectionView, StatsCountersSectionView } from "./MediaSocialSectionViews";
import { ContactInfoCardsSectionView, LegalArticlesSectionView } from "./InformationLegalSectionViews";
import { QuoteRequestFormSectionView } from "./QuoteRequestFormSectionView";

/**
 * Canonical publishable block views. RegisteredBlockView looks up here only.
 */
export const blockViewRegistry: Partial<
  Record<BlockType, ComponentType<Record<string, unknown>>>
> = {
  jobs: JobsSectionView as unknown as ComponentType<Record<string, unknown>>,
  offers: OffersSectionView as unknown as ComponentType<Record<string, unknown>>,
  plans: PlansSectionView as unknown as ComponentType<Record<string, unknown>>,
  steps: StepsSectionView as unknown as ComponentType<Record<string, unknown>>,
  newsletter: NewsletterSectionView as unknown as ComponentType<Record<string, unknown>>,
  contactForm: ContactFormSectionView as unknown as ComponentType<Record<string, unknown>>,
  popup: PopupSectionView as unknown as ComponentType<Record<string, unknown>>,
  hero: HeroSectionView as unknown as ComponentType<Record<string, unknown>>,
  richText: RichTextSectionView as unknown as ComponentType<Record<string, unknown>>,
  centered: CenteredSectionView as unknown as ComponentType<Record<string, unknown>>,
  cta: CtaSectionView as unknown as ComponentType<Record<string, unknown>>,
  textImage: TextImageSectionView as unknown as ComponentType<Record<string, unknown>>,
  featureGrid: FeatureGridSectionView as unknown as ComponentType<Record<string, unknown>>,
  columns: ColumnsSectionView as unknown as ComponentType<Record<string, unknown>>,
  benefits: BenefitsSectionView as unknown as ComponentType<Record<string, unknown>>,
  roadmap: RoadmapSectionView as unknown as ComponentType<Record<string, unknown>>,
  timeline: TimelineSectionView as unknown as ComponentType<Record<string, unknown>>,
  comparisonTable: ComparisonTableSectionView as unknown as ComponentType<Record<string, unknown>>,
  values: ValuesSectionView as unknown as ComponentType<Record<string, unknown>>,
  portfolio: PortfolioSectionView as unknown as ComponentType<Record<string, unknown>>,
  gallery: GallerySectionView as unknown as ComponentType<Record<string, unknown>>,
  video: VideoSectionView as unknown as ComponentType<Record<string, unknown>>,
  beforeAfter: BeforeAfterSectionView as unknown as ComponentType<Record<string, unknown>>,
  carousel: CarouselSectionView as unknown as ComponentType<Record<string, unknown>>,
  spacer: SpacerSectionView as unknown as ComponentType<Record<string, unknown>>,
  quote: QuoteSectionView as unknown as ComponentType<Record<string, unknown>>,
  teamGrid: TeamGridSectionView as unknown as ComponentType<Record<string, unknown>>,
  teamProfile: TeamProfileSectionView as unknown as ComponentType<Record<string, unknown>>,
  announcement: AnnouncementSectionView as unknown as ComponentType<Record<string, unknown>>,
  latestPosts: LatestPostsSectionView as unknown as ComponentType<Record<string, unknown>>,
  partnersMarquee: PartnersMarqueeSectionView as unknown as ComponentType<Record<string, unknown>>,
  statsCounters: StatsCountersSectionView as unknown as ComponentType<Record<string, unknown>>,
  contactInfoCards: ContactInfoCardsSectionView as unknown as ComponentType<Record<string, unknown>>,
  legalArticles: LegalArticlesSectionView as unknown as ComponentType<Record<string, unknown>>,
  quoteRequestForm: QuoteRequestFormSectionView as unknown as ComponentType<Record<string, unknown>>,
};

export type {
  JobsSectionViewProps,
  OffersSectionViewProps,
  PlansSectionViewProps,
  StepsSectionViewProps,
};
