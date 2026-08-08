/**
 * Fixed-section views for Producten (`products.main` / `products.info`).
 * Dual-read with presentation-mode blocks via ProductsBlockViews until MG5.
 */

import { ProductsAssortmentView, ProductsIntroView } from "./ProductsBlockViews";
import { useI18n } from "@/lib/i18n";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import {
  cmsTextOrFallback,
  defaultSectionContent,
  resolveLegacyLinkAsCmsButton,
} from "@mccoy/cms-schema";

export function ProductsMain() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_products", "products.main");
  const isEn = lang === "en";
  const productsDef = defaultSectionContent("products.main") as import("@mccoy/cms-schema").ProductsMainContent;

  const eyebrow = cmsTextOrFallback(content.eyebrow, t.products.kicker, productsDef.eyebrow);
  const headingFallback = isEn
    ? "Fragrance products with a premium sanitary experience."
    : productsDef.heading;
  const heading = cmsTextOrFallback(content.heading, headingFallback, productsDef.heading);
  const introFallback = isEn
    ? "An important part of McCoy Cleaning is McCoy Products, our wholesale division. In our range you will find: hygiene paper, professional soaps, cleaning agents for hospitality, and equipment and hardware for cleaning.\n\nTo obtain our products, you can call or contact us via the contact form; we will be happy to help you."
    : productsDef.intro;
  // Empty CMS copy falls through to locale/static fallbacks via cmsTextOrFallback.
  const intro = cmsTextOrFallback(content.intro, introFallback, productsDef.intro);
  const noticeFallback = isEn
    ? "We are currently busy behind the scenes with the online webshop! Coming soon."
    : productsDef.body ?? "";
  const notice = cmsTextOrFallback(content.body, noticeFallback, productsDef.body);
  const image = content.image ?? productsDef.image;

  return (
    <ProductsIntroView
      eyebrow={eyebrow}
      heading={heading}
      intro={intro}
      notice={notice}
      image={image}
      ctaLabel={t.products.cta}
      isEn={isEn}
    />
  );
}

/** Assortment cards — icon + text; movable above/below Intro. */
export function ProductsInfo() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_products", "products.info");
  const productsInfoDef = defaultSectionContent("products.info") as import("@mccoy/cms-schema").ProductsInfoContent;
  const isEn = lang === "en";
  const eyebrow = cmsTextOrFallback(
    content.eyebrow,
    isEn ? "Our range" : (productsInfoDef.eyebrow ?? ""),
    productsInfoDef.eyebrow ?? "",
  );
  const heading = cmsTextOrFallback(content.heading, t.products.title, productsInfoDef.heading);
  const intro = cmsTextOrFallback(
    content.intro,
    isEn
      ? "Hygiene paper, professional soaps, cleaning agents and hardware for a fresh, presentable environment."
      : (productsInfoDef.intro ?? ""),
    productsInfoDef.intro ?? "",
  );

  const cardEn: Record<string, { title: string; body: string }> = {
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

  return (
    <ProductsAssortmentView
      eyebrow={eyebrow}
      heading={heading}
      intro={intro}
      cards={content.cards.map((card) => {
        const factory = productsInfoDef.cards.find((c) => c.id === card.id);
        const en = cardEn[card.id];
        const defaultCtaLabel = isEn ? t.products.cta : "Productofferte aanvragen";
        const cta = resolveLegacyLinkAsCmsButton(card.cta, card.link, defaultCtaLabel);
        return {
          id: card.id,
          title: cmsTextOrFallback(
            card.title,
            isEn && en ? en.title : card.title,
            factory?.title,
          ),
          description: cmsTextOrFallback(
            card.description ?? "",
            isEn && en ? en.body : card.description ?? "",
            factory?.description,
          ),
          cta: cta
            ? {
                ...cta,
                label: cmsTextOrFallback(
                  cta.label,
                  isEn ? t.products.cta : cta.label,
                  factory?.cta?.label ?? defaultCtaLabel,
                ),
              }
            : null,
        };
      })}
    />
  );
}

/** @deprecated Prefer ProductsMain + ProductsInfo. */
export function Products() {
  return (
    <>
      <ProductsMain />
      <ProductsInfo />
    </>
  );
}
