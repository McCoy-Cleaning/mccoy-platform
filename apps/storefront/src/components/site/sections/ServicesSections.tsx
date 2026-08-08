/**
 * Fixed-section views for Diensten (`services.main` / `services.cards`).
 * Compatibility path until MG5; not a reusable BlockType switch.
 */

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Sparkles,
  Wind,
  UtensilsCrossed,
  Hammer,
  Sofa,
  GlassWater,
  Building2,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { CompositePartSelectChrome } from "../PageLayoutRenderer";
import { localizedServicesCopy } from "@/lib/cms-i18n";
import {
  cmsTextOrFallback,
  DEFAULT_SERVICE_CARD_CTA_LABEL,
  DEFAULT_SERVICE_CARD_QUOTE_CTA_LABEL,
  defaultSectionContent,
  isCmsButtonInteractive,
  resolveLegacyLinkAsCmsButton,
} from "@mccoy/cms-schema";
import {
  CmsButtonView,
  SECTION_PAGE_RAIL,
  SectionAmbient,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { DeliveryImage } from "@/components/site/DeliveryImage";
import { SERVICES_CARD_IMAGE_SIZES } from "@/lib/image-delivery";
import { cn } from "@/lib/utils";

function isCmsPlaceholderSrc(src: string | undefined): boolean {
  return !src || src.includes("placeholder");
}

const serviceIcons = [Wind, UtensilsCrossed, Hammer, Building2, Sofa, GlassWater];
/**
 * Public CMS delivery paths (not Vite-bundled masters). DeliveryImage can then
 * serve allowlisted WebP siblings instead of 150–470KB PNG/JPEG chunk assets.
 * Order matches cms-schema ORIGINAL_SERVICE_IMAGE_BY_ID / defaultServiceCards.
 */
const SERVICE_CARD_FALLBACK_SRCS = [
  "/images/cms/work-regular-sander.png",
  "/images/cms/work-horeca.jpg",
  "/images/cms/work-oplevering-hal.png",
  "/images/cms/work-floor-scrubber.jpg",
  "/images/cms/work-furniture-bank.jpg",
  "/images/cms/work-glass-van.jpg",
] as const;

function useLocalizedServiceCards() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_services", "services.main");
  const cardsContent = useTypedSectionContent("page_services", "services.cards");
  const localized = localizedServicesCopy(content, cardsContent, t);
  const defCards = defaultSectionContent("services.cards") as import("@mccoy/cms-schema").ServicesCardsContent;
  const isEn = lang === "en";
  const cards = localized.cards.map((card, i) => {
    const i18nItem = t.work.items[i];
    const usedFallback = isCmsPlaceholderSrc(card.image.src);
    const imageSrc = usedFallback
      ? SERVICE_CARD_FALLBACK_SRCS[i] ?? SERVICE_CARD_FALLBACK_SRCS[0]
      : card.image.src;
    const factory = defCards.cards.find((c) => c.id === card.id);
    const linkHint = card.cta?.link ?? card.link;
    const routeDefaultNl =
      linkHint?.type === "internal_route" && linkHint.route === "offerte"
        ? DEFAULT_SERVICE_CARD_QUOTE_CTA_LABEL
        : DEFAULT_SERVICE_CARD_CTA_LABEL;
    const routeDefaultI18n =
      linkHint?.type === "internal_route" && linkHint.route === "offerte"
        ? t.services.quoteCta
        : t.services.contactCta;
    const cta = resolveLegacyLinkAsCmsButton(card.cta, card.link, routeDefaultNl);
    const resolvedCta = cta
      ? {
          ...cta,
          label: cmsTextOrFallback(
            cta.label,
            isEn ? routeDefaultI18n : cta.label,
            factory?.cta?.label ?? routeDefaultNl,
          ),
        }
      : null;
    return {
      id: card.id,
      title: card.title,
      desc: card.description,
      full: i18nItem?.full ?? (card.description ? [card.description] : []),
      imageSrc,
      cta: resolvedCta && isCmsButtonInteractive(resolvedCta) ? resolvedCta : null,
      Icon: serviceIcons[i] ?? Wind,
    };
  });
  return { t, localized, cards };
}

/** Services intro chrome — cards live on `services.cards`. */
export function ServicesMain() {
  const { localized } = useLocalizedServiceCards();
  const { eyebrow, heading, intro } = localized;
  return (
    <section id="services" className="relative isolate overflow-hidden py-20 sm:py-24">
      <SectionAmbient />
      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <CompositePartSelectChrome sectionKey="services.main" part="header" label="Intro">
          <div className="max-w-2xl">
            <SectionEyebrow>{eyebrow}</SectionEyebrow>
            <h1 className="font-display mt-4 text-4xl text-foreground md:text-5xl">{heading}</h1>
            {intro ? <p className="mt-4 whitespace-pre-line text-muted-foreground">{intro}</p> : null}
          </div>
        </CompositePartSelectChrome>
      </div>
    </section>
  );
}

/**
 * Service cards grid + detail modal (fixed section `services.cards`).
 * Template: [Lees meer → detail modal] + [Contact CTA → CmsButton].
 */
export function ServicesCards() {
  const { t, localized, cards } = useLocalizedServiceCards();
  const eyebrow = localized.eyebrow;
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const prev = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  return (
    <section id="services-cards" className="relative isolate overflow-hidden pb-20 sm:pb-24">
      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <CompositePartSelectChrome sectionKey="services.cards" part="cards" label="Dienstkaarten">
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.Icon;
            return (
              <SectionSurface
                key={card.id}
                variant="media"
                className="group relative flex h-full flex-col transition hover:border-primary/40"
              >
              <article className="flex h-full flex-col">
                <div className="relative h-44 shrink-0 overflow-hidden bg-black/35">
                  <DeliveryImage
                    src={card.imageSrc}
                    alt={card.title}
                    variant="gallery"
                    width={600}
                    height={360}
                    // First desktop row is above/near fold; keep below-fold lazy.
                    loading={i < 3 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : i < 3 ? "low" : undefined}
                    sizes={SERVICES_CARD_IMAGE_SIZES}
                    className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <div className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>

                  <div className="mt-auto flex w-full items-center justify-between gap-3 pt-5">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground/80 transition hover:border-primary/40 hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      {t.services.readMore}
                    </button>
                    {card.cta ? (
                      <CmsButtonView
                        button={card.cta}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition group-hover:gap-2.5"
                      >
                        {card.cta.label}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </CmsButtonView>
                    ) : null}
                  </div>
                </div>
              </article>
              </SectionSurface>
            );
          })}
        </div>
        </CompositePartSelectChrome>
      </div>

      {/* Detail modal — fixed Lees meer content (not CMS popup-block) */}
      {typeof document !== "undefined" &&
        createPortal(
          open !== null
            ? (() => {
                const card = cards[open];
                if (!card) return null;
                const Icon = card.Icon;
                return (
                  <div key="svc-modal" className="fixed inset-0 z-[100] overflow-hidden bg-background/92">
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="service-modal-title"
                      onClick={(e) => e.stopPropagation()}
                      className="service-modal-panel fixed z-[101] grid max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-[0_40px_120px_-20px_rgba(63,182,242,0.5)] sm:rounded-[2rem] md:grid-cols-2 md:grid-rows-1"
                    >
                      <div className="relative h-40 shrink-0 overflow-hidden bg-black/35 sm:h-64 md:h-auto">
                        <DeliveryImage
                          src={card.imageSrc}
                          alt={card.title}
                          variant="gallery"
                          width={800}
                          height={1000}
                          loading="eager"
                          sizes="(min-width: 768px) 50vw, 100vw"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent md:bg-gradient-to-r" />
                        <div className="absolute left-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/50 sm:left-6 sm:top-6 sm:h-14 sm:w-14">
                          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                      </div>
                      <div className="relative min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8 md:p-10">
                        <button
                          type="button"
                          onClick={() => setOpen(null)}
                          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-primary/50 hover:text-white sm:right-5 sm:top-5"
                          aria-label="Sluiten"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <motion.p
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          className="pr-12 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary sm:text-xs"
                        >
                          {eyebrow}
                        </motion.p>
                        <motion.h3
                          id="service-modal-title"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.28, duration: 0.5 }}
                          className="font-display mt-2 text-2xl text-white sm:mt-3 sm:text-3xl md:text-4xl"
                        >
                          {card.title}
                        </motion.h3>
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="mt-4 h-0.5 w-16 origin-left rounded-full bg-primary"
                        />
                        <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/75 sm:mt-6 sm:space-y-4 sm:text-[15px]">
                          {card.full.map((p, idx) => (
                            <motion.p
                              key={idx}
                              initial={{ opacity: 0, y: 14 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 + idx * 0.08, duration: 0.45 }}
                            >
                              {p}
                            </motion.p>
                          ))}
                        </div>
                        {card.cta ? (
                          <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7, duration: 0.5 }}
                            className="mt-6 sm:mt-8"
                            onClick={() => setOpen(null)}
                          >
                            <CmsButtonView
                              button={card.cta}
                              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03] sm:px-6"
                            >
                              {card.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
                            </CmsButtonView>
                          </motion.div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })()
            : null,
          document.body,
        )}
    </section>
  );
}

/** @deprecated Prefer ServicesMain + ServicesCards (services.cards split). */
export function Services() {
  return (
    <>
      <ServicesMain />
      <ServicesCards />
    </>
  );
}
