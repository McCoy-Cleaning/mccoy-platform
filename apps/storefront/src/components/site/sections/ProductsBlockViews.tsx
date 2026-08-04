/**
 * Producten presentation chrome — shared by fixed sections and migrated CMS blocks.
 * Keeps the premium Intro + Assortiment layout (flyer, CTAs, metrics, card grid).
 */

import { motion, useReducedMotion } from "motion/react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Phone,
  Droplets,
  Package,
  SprayCan,
  Wrench,
} from "lucide-react";
import {
  cmsTextOrFallback,
  DEFAULT_PRODUCTS_INTRO_METRICS,
  type CmsButton,
  type CmsImage,
  type CmsLink,
} from "@mccoy/cms-schema";
import { CmsLinkAnchor } from "../CmsLinkAnchor";
import {
  CmsButtonView,
  CmsImageView,
  SECTION_PAGE_RAIL,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

function isCmsPlaceholderSrc(src: string | undefined): boolean {
  return !src || src.includes("placeholder");
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export type ProductsIntroMetric = {
  id?: string;
  value: string;
  label: string;
};

export type ProductsIntroViewProps = {
  eyebrow: string;
  heading: string;
  /** Intro paragraphs (blank-line separated). */
  intro: string;
  /** Webshop aside notice. */
  notice: string;
  image?: CmsImage | null;
  ctaLabel: string;
  isEn: boolean;
  /** Optional CMS metrics strip; falls back to current NL/EN defaults. */
  metrics?: ProductsIntroMetric[] | null;
};

function defaultProductsIntroMetrics(isEn: boolean): ProductsIntroMetric[] {
  return [
    { id: "metric_products", value: "100+", label: isEn ? "Products" : "Producten" },
    { id: "metric_b2b", value: "B2B", label: isEn ? "Wholesale" : "Groothandel" },
    { id: "metric_contact", value: "24/7", label: isEn ? "Support" : "Contact" },
  ];
}

function localizedProductsIntroMetrics(
  metricsProp: ProductsIntroMetric[] | null | undefined,
  isEn: boolean,
): ProductsIntroMetric[] {
  const defaults = defaultProductsIntroMetrics(isEn);
  const source =
    Array.isArray(metricsProp) && metricsProp.length > 0 ? metricsProp : defaults;

  return source
    .map((m, index) => {
      const factory = DEFAULT_PRODUCTS_INTRO_METRICS[index];
      const fallback = defaults[index] ?? defaults[0]!;
      const rawValue = typeof m.value === "string" ? m.value.trim() : "";
      const rawLabel = typeof m.label === "string" ? m.label.trim() : "";
      return {
        id: m.id?.trim() || factory?.id || `metric-${index}`,
        value: cmsTextOrFallback(rawValue, fallback.value, factory?.value),
        label: cmsTextOrFallback(rawLabel, fallback.label, factory?.label),
      };
    })
    .filter((m) => m.value || m.label)
    .slice(0, 3);
}

/** Exact Producten intro layout (text + flyer + CTAs + metrics). */
export function ProductsIntroView({
  eyebrow,
  heading,
  intro,
  notice,
  image,
  ctaLabel,
  isEn,
  metrics: metricsProp,
}: ProductsIntroViewProps) {
  const reduced = useReducedMotion();
  const introParagraphs = intro
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const introGaps = (() => {
    const normalized = intro.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
    const tokens = normalized.split(/(\n{2,})/);
    const gaps: number[] = [];
    for (let i = 1; i < tokens.length; i += 2) {
      const newlineCount = (tokens[i]?.match(/\n/g) ?? []).length;
      gaps.push(Math.max(1, newlineCount - 1));
    }
    return gaps;
  })();

  const metrics = localizedProductsIntroMetrics(metricsProp, isEn);

  return (
    <section id="products" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/8 via-transparent to-transparent" />

      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <motion.div
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true }}
            className="lg:col-span-6"
          >
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            ) : null}
            <h1 className="font-display mt-4 max-w-xl text-4xl leading-[1.08] text-white md:text-5xl lg:text-6xl">
              {heading}
            </h1>
            <div className="mt-5 h-0.5 w-14 rounded-full bg-primary" aria-hidden />

            {introParagraphs.map((paragraph, index) => {
              const gap = index === 0 ? 0 : (introGaps[index - 1] ?? 1);
              const marginTop =
                index === 0 ? "1.5rem" : gap >= 2 ? `${1 + gap * 0.75}rem` : "1rem";
              return (
                <p
                  key={`products-intro-${index}`}
                  className="max-w-xl whitespace-pre-line text-base leading-relaxed text-white/70 md:text-[17px]"
                  style={{ marginTop }}
                >
                  {paragraph}
                </p>
              );
            })}

            <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden />
                {ctaLabel}
              </Link>
              <a
                href="tel:+31541534982"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-transparent px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-primary/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Phone className="h-4 w-4 text-primary" aria-hidden />
                0541 534 982
              </a>
            </div>

            {notice ? (
              <aside
                className="mt-10 flex gap-3 border-l-2 border-primary/60 pl-5"
                aria-label={isEn ? "Webshop notice" : "Webshop melding"}
              >
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">{notice}</p>
              </aside>
            ) : null}
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true }}
            transition={reduced ? undefined : { delay: 0.12 }}
            className="lg:col-span-6"
          >
            {image && !isCmsPlaceholderSrc(image.src) ? (
              <figure className="relative">
                <div
                  className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/15 blur-3xl"
                  aria-hidden
                />
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/40">
                  <CmsImageView image={image} className="h-auto w-full object-cover" />
                </div>
                <figcaption className="sr-only">{image.alt || heading}</figcaption>
              </figure>
            ) : null}

            {metrics.length > 0 ? (
              <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                {metrics.map((m) => (
                  <div key={m.id} className="bg-card/80 px-3 py-4 text-center sm:px-4 sm:py-5">
                    <dd className="font-display text-xl text-white sm:text-2xl">{m.value}</dd>
                    <dt className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/55 sm:text-xs">
                      {m.label}
                    </dt>
                  </div>
                ))}
              </dl>
            ) : null}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export type ProductsAssortmentCard = {
  id: string;
  title: string;
  description: string;
  /** Per-card CTA (label + geen link / pagina / extern / popup). */
  cta?: CmsButton | null;
};

export type ProductsAssortmentViewProps = {
  eyebrow: string;
  heading: string;
  intro: string;
  cards: ProductsAssortmentCard[];
};

/** Exact Producten assortment card grid. */
export function ProductsAssortmentView({
  eyebrow,
  heading,
  intro,
  cards,
}: ProductsAssortmentViewProps) {
  const reduced = useReducedMotion();
  const cardIcons = [Package, Droplets, SprayCan, Wrench] as const;

  return (
    <section id="products-info" className="relative overflow-hidden py-20 sm:py-24">
      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <motion.div
          variants={fadeUp}
          initial={reduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true }}
        >
          <div className="max-w-2xl">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            ) : null}
            {heading ? (
              <h2 className="font-display mt-4 text-3xl text-white md:text-4xl">{heading}</h2>
            ) : null}
            {intro ? (
              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-white/65">{intro}</p>
            ) : null}
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card, i) => {
              const Icon = cardIcons[i % cardIcons.length] ?? Package;
              return (
                <li key={card.id}>
                  <motion.div
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { delay: 0.06 * i, duration: 0.4 }}
                    className="h-full"
                  >
                    <SectionSurface
                      variant="outlined"
                      className="group flex h-full flex-col items-start gap-4 px-5 py-6 transition hover:border-primary/35"
                    >
                      <div className="flex w-full items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 pt-1">
                          <h3 className="text-sm font-semibold leading-snug text-foreground">{card.title}</h3>
                          {card.description ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {card.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {card.cta ? (
                        <CmsButtonView
                          button={card.cta}
                          className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition group-hover:gap-2.5"
                        >
                          {card.cta.label}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </CmsButtonView>
                      ) : null}
                    </SectionSurface>
                  </motion.div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
