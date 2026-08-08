import type { ReactNode } from "react";
import {
  cmsTextOrFallback,
  DEFAULT_ABOUT_INTRO_PILLARS_EN,
  DEFAULT_ABOUT_INTRO_PILLARS_NL,
  parseBlockData,
  productAssortmentTemplateData,
  productIntroTemplateData,
  resolveLegacyLinkAsCmsButton,
  type Block,
  type CmsButton,
  type CmsImage,
  type CmsLink,
} from "@mccoy/cms-schema";
import { useI18n } from "@/lib/i18n";
import {
  ProductsAssortmentView,
  ProductsIntroView,
} from "@/components/site/sections/ProductsBlockViews";
import {
  AboutIntroView,
  AboutPillarRowView,
} from "@/components/site/sections/AboutBlockViews";
import { usesStorefrontPresentationAdapter } from "./block-presentation";

export { usesStorefrontPresentationAdapter } from "./block-presentation";

/**
 * Storefront presentation adapters for migrated Producten/About blocks.
 *
 * These are NOT a BlockType mega-switch. They intercept specific `presentation`
 * variants that keep brand chrome shared with fixed-section dual-read until MG5.
 * Default reusable blocks always go through `@mccoy/cms-renderer` RegisteredBlockView.
 */

const ASSORTMENT_CARD_EN: Record<string, { title: string; body: string }> = {
  prod_hygiene: {
    title: "Hygiene paper",
    body: "Professional hygiene paper for washrooms, kitchens and commercial buildings.",
  },
  prod_soaps: {
    title: "Professional soaps",
    body: "High-quality soaps and dispensers for a fresh, presentable sanitary space.",
  },
  prod_agents: {
    title: "Cleaning agents & hardware",
    body: "Cleaning agents for hospitality plus equipment and hardware for cleaning.",
  },
};

const ASSORTMENT_INTRO_EN =
  "Hygiene paper, professional soaps, cleaning agents and hardware for a fresh, presentable environment.";
const ASSORTMENT_EYEBROW_EN = "Our range";

function ProductsPresentationBlock({ block }: { block: Block }) {
  const { t, lang } = useI18n();
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return null;
  const d = parsed.data as Record<string, unknown>;

  if (block.type === "textImage" && d.presentation === "productsIntro") {
    const isEn = lang === "en";
    const def = productIntroTemplateData;
    const metrics = Array.isArray(d.metrics)
      ? (d.metrics as Array<{ id?: string; value?: string; label?: string }>).map((m) => ({
          id: typeof m.id === "string" ? m.id : undefined,
          value: typeof m.value === "string" ? m.value : "",
          label: typeof m.label === "string" ? m.label : "",
        }))
      : null;
    const rawEyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
    const rawTitle = String(d.title ?? "");
    const rawBody = typeof d.body === "string" ? d.body : "";
    const rawNotice = typeof d.notice === "string" ? d.notice : "";
    const headingFallback = isEn
      ? "Fragrance products with a premium sanitary experience."
      : def.title;
    const introFallback = isEn
      ? "An important part of McCoy Cleaning is McCoy Products, our wholesale division. In our range you will find: hygiene paper, professional soaps, cleaning agents for hospitality, and equipment and hardware for cleaning.\n\nTo obtain our products, you can call or contact us via the contact form; we will be happy to help you."
      : def.body;
    const noticeFallback = isEn
      ? "We are currently busy behind the scenes with the online webshop! Coming soon."
      : def.notice;
    return (
      <ProductsIntroView
        eyebrow={cmsTextOrFallback(rawEyebrow, t.products.kicker, def.eyebrow)}
        heading={cmsTextOrFallback(rawTitle, headingFallback, def.title)}
        intro={cmsTextOrFallback(rawBody, introFallback, def.body)}
        notice={cmsTextOrFallback(rawNotice, noticeFallback, def.notice)}
        image={(d.image as CmsImage | undefined) ?? null}
        ctaLabel={t.products.cta}
        isEn={isEn}
        metrics={metrics}
      />
    );
  }

  if (block.type === "featureGrid" && d.presentation === "productsAssortment") {
    const isEn = lang === "en";
    const def = productAssortmentTemplateData;
    const features =
      (d.features as Array<{
        id: string;
        title: string;
        body: string;
        link?: CmsLink;
        cta?: CmsButton;
      }>) ?? [];
    const rawEyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
    const rawTitle = String(d.title ?? "");
    const rawIntro = typeof d.intro === "string" ? d.intro : "";
    const eyebrowFallback = isEn ? ASSORTMENT_EYEBROW_EN : def.eyebrow;
    const introFallback = isEn ? ASSORTMENT_INTRO_EN : def.intro;
    const defaultCtaLabel = isEn ? t.products.cta : "Productofferte aanvragen";
    const cards = features.map((f) => {
      const factory = def.features.find((item) => item.id === f.id);
      const enCard = ASSORTMENT_CARD_EN[f.id];
      const titleFallback = isEn && enCard ? enCard.title : f.title;
      const bodyFallback = isEn && enCard ? enCard.body : f.body;
      const cta = resolveLegacyLinkAsCmsButton(f.cta, f.link, defaultCtaLabel);
      return {
        id: f.id,
        title: cmsTextOrFallback(f.title, titleFallback, factory?.title),
        description: cmsTextOrFallback(f.body, bodyFallback, factory?.body),
        cta: cta
          ? {
              ...cta,
              label: cmsTextOrFallback(cta.label, isEn ? t.products.cta : cta.label, factory?.cta?.label),
            }
          : null,
      };
    });

    return (
      <ProductsAssortmentView
        eyebrow={cmsTextOrFallback(rawEyebrow, eyebrowFallback, def.eyebrow)}
        heading={cmsTextOrFallback(rawTitle, t.products.title, def.title)}
        intro={cmsTextOrFallback(rawIntro, introFallback, def.intro)}
        cards={cards}
      />
    );
  }

  return null;
}

function AboutPresentationBlock({ block }: { block: Block }) {
  const { lang } = useI18n();
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return null;
  const d = parsed.data as Record<string, unknown>;

  if (block.type === "centered" && d.presentation === "aboutIntro") {
    const defaults = lang === "en" ? DEFAULT_ABOUT_INTRO_PILLARS_EN : DEFAULT_ABOUT_INTRO_PILLARS_NL;
    const pillarsRaw = Array.isArray(d.pillars) ? d.pillars : defaults;
    const pillars = pillarsRaw.map((p, i) => {
      const row = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
      const fallback = defaults[i] ?? defaults[0]!;
      return {
        id: typeof row.id === "string" ? row.id : fallback.id,
        icon: typeof row.icon === "string" ? row.icon : fallback.icon,
        label: typeof row.label === "string" && row.label.trim() ? row.label : fallback.label,
      };
    });
    return (
      <AboutIntroView
        eyebrow={typeof d.eyebrow === "string" ? d.eyebrow : lang === "en" ? "About us" : "Over ons"}
        heading={String(d.title ?? "")}
        pillars={pillars}
        cta={(d.cta as CmsButton | undefined) ?? null}
      />
    );
  }

  if (block.type === "textImage" && d.presentation === "aboutPillar") {
    const tag = typeof d.tag === "string" && d.tag.trim() ? d.tag : "01";
    const index = tag === "02" ? 1 : tag === "03" ? 2 : 0;
    return (
      <AboutPillarRowView
        title={String(d.title ?? "")}
        body={typeof d.body === "string" ? d.body : ""}
        iconKey={typeof d.icon === "string" ? d.icon : "target"}
        image={(d.image as CmsImage | undefined) ?? null}
        tag={tag}
        index={typeof d.reverse === "boolean" ? (d.reverse ? 1 : 0) : index}
        aspectClassName={typeof d.aspectClassName === "string" ? d.aspectClassName : undefined}
        objectPosition={typeof d.objectPosition === "string" ? d.objectPosition : undefined}
        scaleValues={
          d.scaleMode === "soft" ? ([1.05, 1, 1.05] as [number, number, number]) : undefined
        }
      />
    );
  }

  return null;
}

/** Render brand presentation adapter, or null when the block is not an adapter target. */
export function renderStorefrontPresentationAdapter(block: Block): ReactNode {
  if (!usesStorefrontPresentationAdapter(block)) return null;
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return null;
  const presentation = (parsed.data as { presentation?: string }).presentation;
  if (
    presentation === "productsIntro" ||
    presentation === "productsAssortment"
  ) {
    return <ProductsPresentationBlock block={block} />;
  }
  return <AboutPresentationBlock block={block} />;
}
