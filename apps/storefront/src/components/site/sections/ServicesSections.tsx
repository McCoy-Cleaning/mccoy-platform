/**
 * Fixed-section views for Diensten (`services.main` / `services.cards`).
 * Compatibility path until MG5; not a reusable BlockType switch.
 *
 * Phase 7: each service `full` body is SSR'd once inside ServiceDetailPanel.
 * Client JS only toggles open / hidden / inert / hash — no sr-only crawler clone.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Wind,
  UtensilsCrossed,
  Hammer,
  Sofa,
  GlassWater,
  Building2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useOverlayHeading } from "@/lib/cms/aether-edge-overlay-context";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { CompositePartSelectChrome } from "../PageLayoutRenderer";
import { localizedServicesCopy } from "@/lib/cms-i18n";
import {
  cmsTextOrFallback,
  DEFAULT_SERVICE_CARD_CTA_LABEL,
  DEFAULT_SERVICE_CARD_QUOTE_CTA_LABEL,
  DEFAULT_SERVICE_DETAIL_BODY_BY_ID,
  DEFAULT_SERVICES_CLOSE_LABEL,
  DEFAULT_SERVICES_READ_MORE_LABEL,
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
import { ServiceDetailPanel } from "./ServiceDetailPanel";
import {
  serviceDetailAnchorForCard,
  serviceDetailHref,
} from "./service-detail-anchors";
import { WysiwygInlineText } from "../cms-editor/WysiwygInlineText";
import { WysiwygButtonEditor, WysiwygMediaFrame } from "../cms-editor/WysiwygMediaButton";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import type { ServiceCard, ServicesCardsContent } from "@mccoy/cms-schema";

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

/** SSR in-place, then portal to body after mount (escape section overflow stacking). */
function BodyPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.body);
  }, []);
  if (!target) return <>{children}</>;
  return createPortal(children, target);
}

function clearLocationHash() {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  if (!hash) return;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

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
    const detailBody = cmsTextOrFallback(
      card.detailBody,
      (i18nItem?.full ?? []).join("\n\n"),
      factory?.detailBody ?? DEFAULT_SERVICE_DETAIL_BODY_BY_ID[card.id] ?? card.description,
    );
    return {
      id: card.id,
      title: card.title,
      desc: card.description,
      full: detailBody
        .replace(/\r\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
      detailBody,
      imageSrc,
      cta: resolvedCta && isCmsButtonInteractive(resolvedCta) ? resolvedCta : null,
      Icon: serviceIcons[i] ?? Wind,
    };
  });
  const readMoreLabel = cmsTextOrFallback(
    cardsContent.readMoreLabel,
    t.services.readMore,
    DEFAULT_SERVICES_READ_MORE_LABEL,
  );
  const closeLabel = cmsTextOrFallback(
    cardsContent.closeLabel,
    "Sluiten",
    DEFAULT_SERVICES_CLOSE_LABEL,
  );
  return { t, localized, cards, readMoreLabel, closeLabel, cardsContent };
}

/** Services intro chrome — cards live on `services.cards`. */
export function ServicesMain() {
  const { localized } = useLocalizedServiceCards();
  const { eyebrow, heading: sectionHeading, intro } = localized;
  const heading = useOverlayHeading(sectionHeading);
  return (
    <section id="services" className="relative isolate overflow-hidden py-20 sm:py-24">
      <SectionAmbient />
      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <CompositePartSelectChrome sectionKey="services.main" part="header" label="Intro">
          <div className="max-w-2xl">
            <SectionEyebrow>
              <WysiwygInlineText
                label="Eyebrow"
                value={eyebrow ?? ""}
                enFieldPath="section:services.main:eyebrow"
                target={{ kind: "section", sectionKey: "services.main", field: "eyebrow" }}
              />
            </SectionEyebrow>
            <h1 className="font-display mt-4 text-4xl text-foreground md:text-5xl">
              <WysiwygInlineText
                as="span"
                label="Kop"
                value={heading}
                enFieldPath="section:services.main:heading"
                target={{ kind: "section", sectionKey: "services.main", field: "heading" }}
              />
            </h1>
            <p className="mt-4 whitespace-pre-line text-muted-foreground">
              <WysiwygInlineText
                as="span"
                multiline
                label="Intro"
                value={intro ?? ""}
                enFieldPath="section:services.main:intro"
                target={{ kind: "section", sectionKey: "services.main", field: "intro" }}
              />
            </p>
          </div>
        </CompositePartSelectChrome>
      </div>
    </section>
  );
}

/**
 * Service cards grid + detail panels (fixed section `services.cards`).
 * Template: [Lees meer → hash link + detail panel] + [Contact CTA → CmsButton].
 */
export function ServicesCards() {
  const { t, localized, cards, readMoreLabel, closeLabel, cardsContent } = useLocalizedServiceCards();
  const { sendMutation, showEditorChrome } = useLiveEditApi();
  const eyebrow = localized.eyebrow;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState<number | null>(null);

  const patchCard = (id: string, patch: Partial<ServiceCard>) => {
    sendMutation({
      kind: "section",
      sectionKey: "services.cards",
      patch: {
        cards: cardsContent.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    });
  };

  const patchCardsSection = (patch: Partial<ServicesCardsContent>) => {
    sendMutation({ kind: "section", sectionKey: "services.cards", patch });
  };

  const openService = (index: number, anchor: string) => {
    setOpen(index);
    if (typeof window === "undefined") return;
    const next = `#${anchor}`;
    if (window.location.hash !== next) {
      window.history.pushState(null, "", next);
    }
  };

  const closeService = () => {
    setOpen(null);
    clearLocationHash();
  };

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

  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const cardAnchorKey = cards
    .map((card, i) => `${card.id}:${serviceDetailAnchorForCard(card.id, i)}`)
    .join("|");

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (!raw) {
        setOpen(null);
        return;
      }
      const list = cardsRef.current;
      const idx = list.findIndex((card, i) => serviceDetailAnchorForCard(card.id, i) === raw);
      if (idx >= 0) setOpen(idx);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
    };
  }, [cardAnchorKey]);

  return (
    <section id="services-cards" className="relative isolate overflow-hidden pb-20 sm:pb-24">
      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <CompositePartSelectChrome sectionKey="services.cards" part="cards" label="Dienstkaarten">
        <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.Icon;
            const anchor = serviceDetailAnchorForCard(card.id, i);
            const href = serviceDetailHref(pathname, anchor);
            return (
              <SectionSurface
                key={card.id}
                variant="media"
                className="group relative flex h-full flex-col transition hover:border-primary/40"
              >
              <article className="flex h-full flex-col">
                <div className="relative h-44 shrink-0 overflow-hidden bg-black/35">
                  <WysiwygMediaFrame
                    className="absolute inset-0"
                    target={{
                      kind: "section",
                      sectionKey: "services.cards",
                      field: "cards",
                      listItemId: card.id,
                      listImageKey: "image",
                    }}
                  >
                    <DeliveryImage
                      src={card.imageSrc}
                      alt={card.title}
                      variant="gallery"
                      width={600}
                      height={360}
                      loading={i < 3 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : i < 3 ? "low" : undefined}
                      sizes={SERVICES_CARD_IMAGE_SIZES}
                      className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                    />
                  </WysiwygMediaFrame>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <div className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl text-foreground">
                    <WysiwygInlineText
                      as="span"
                      label="Titel"
                      value={card.title}
                      target={{
                        kind: "custom",
                        onCommit: (next) => patchCard(card.id, { title: next }),
                      }}
                    />
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    <WysiwygInlineText
                      as="span"
                      multiline
                      label="Beschrijving"
                      value={card.desc}
                      target={{
                        kind: "custom",
                        onCommit: (next) => patchCard(card.id, { description: next }),
                      }}
                    />
                  </p>

                  <div className="mt-auto flex w-full items-center justify-between gap-3 pt-5">
                    <a
                      href={href}
                      aria-label={`${readMoreLabel}: ${card.title}`}
                      onClick={(e) => {
                        if (showEditorChrome) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        openService(i, anchor);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground/80 transition hover:border-primary/40 hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      <WysiwygInlineText
                        as="span"
                        label="Lees meer"
                        value={readMoreLabel}
                        target={{
                          kind: "custom",
                          onCommit: (next) => patchCardsSection({ readMoreLabel: next }),
                        }}
                      />
                    </a>
                    {card.cta ? (
                      <WysiwygButtonEditor
                        button={card.cta}
                        onChange={(next) => patchCard(card.id, { cta: next })}
                      >
                        <CmsButtonView
                          button={card.cta}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition group-hover:gap-2.5"
                        >
                          {card.cta.label}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </CmsButtonView>
                      </WysiwygButtonEditor>
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

      {/* One SSR instance of each service `full` body — visibility only, no crawler clone */}
      <BodyPortal>
        {cards.map((card, i) => {
          const anchor = serviceDetailAnchorForCard(card.id, i);
          return (
            <ServiceDetailPanel
              key={card.id}
              card={card}
              anchor={anchor}
              open={open === i}
              eyebrow={eyebrow}
              closeLabel={closeLabel}
              onClose={closeService}
              onPatchDetailBody={
                showEditorChrome
                  ? (next) => patchCard(card.id, { detailBody: next })
                  : undefined
              }
              onPatchCloseLabel={
                showEditorChrome
                  ? (next) => patchCardsSection({ closeLabel: next })
                  : undefined
              }
            />
          );
        })}
      </BodyPortal>
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