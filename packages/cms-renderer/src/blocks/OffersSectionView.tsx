import * as React from "react";
import {
  formatOfferPrice,
  normalizeOffersLayout,
  offerDiscountPercent,
  type CmsImage,
  type OffersBlockData,
  type OfferItem,
} from "@mccoy/cms-schema";
import { SectionShell } from "../SectionShell";
import { GallerySectionIntro, GalleryUnifiedPanel } from "./GallerySectionIntro";
import { CmsImageView } from "./CmsImageView";
import { offerUiCopy } from "../offerUiCopy";
import { useCmsUiLocale } from "../uiLocale";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type OffersSectionViewProps = {
  data: OffersBlockData;
};

function OfferBadge({ badge }: { badge?: string }) {
  if (!badge) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
      <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />
      {badge}
    </p>
  );
}

function DiscountChip({
  pct,
  className,
  ariaLabel,
}: {
  pct: number;
  className?: string;
  ariaLabel: string;
}) {
  if (pct <= 0) return null;
  return (
    <span className={cn("offer-pct-badge", className)} aria-label={ariaLabel}>
      −{pct}%
    </span>
  );
}

function OfferPrices({ offer, compact = false }: { offer: OfferItem; compact?: boolean }) {
  const locale = useCmsUiLocale();
  const copy = offerUiCopy(locale);
  const pct = offerDiscountPercent(offer.originalPrice, offer.discountPrice);
  const showStrike = offer.originalPrice > 0 && offer.discountPrice < offer.originalPrice;
  const mainPrice = offer.discountPrice > 0 ? offer.discountPrice : offer.originalPrice;
  if (!(mainPrice > 0)) return null;

  return (
    <div
      data-offer-prices=""
      className={cn(
        "rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-white/[0.04] to-transparent",
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          {showStrike ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:text-xs">
              {copy.was}{" "}
              <span className="ml-1 text-sm font-medium tracking-normal text-white/40 line-through sm:text-[15px]">
                {formatOfferPrice(offer.originalPrice, locale)}
              </span>
            </p>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45 sm:text-xs">
              {copy.price}
            </p>
          )}
          <p
            className={cn(
              "offer-price-glow font-display font-semibold tracking-tight",
              compact ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl lg:text-[3.25rem]",
            )}
          >
            {formatOfferPrice(mainPrice, locale)}
          </p>
          {showStrike ? (
            <p className="text-xs font-medium text-primary/90 sm:text-sm">{copy.nowDiscounted}</p>
          ) : null}
        </div>
        <DiscountChip
          pct={pct}
          className="mb-1 shrink-0"
          ariaLabel={copy.percentOffAria(pct)}
        />
      </div>
    </div>
  );
}

type OfferMediaLayout = "row" | "card";

type PhotoOrientation = "portrait" | "landscape" | "square" | "unknown";

function readPhotoOrientation(image?: CmsImage): PhotoOrientation {
  const w = image?.width;
  const h = image?.height;
  if (!(w && h)) return "unknown";
  if (h > w * 1.08) return "portrait";
  if (w > h * 1.08) return "landscape";
  return "square";
}

/** Stable frame that keeps the media column filled without forcing cover-crop zoom. */
function offerAspectClass(image: CmsImage | undefined, layout: OfferMediaLayout): string {
  const orientation = readPhotoOrientation(image);
  if (layout === "row") {
    // Keep a fixed aspect on all breakpoints — stretching to content height caused
    // extreme object-cover zoom on product shots.
    if (orientation === "portrait") return "aspect-[3/4]";
    if (orientation === "landscape") return "aspect-[4/3]";
    return "aspect-[4/5]";
  }
  if (orientation === "portrait") return "aspect-[3/4]";
  if (orientation === "landscape") return "aspect-[4/3]";
  return "aspect-[4/5]";
}

function offerMediaFitAttr(orientation: PhotoOrientation): string {
  if (orientation === "portrait") return "portrait-contain";
  if (orientation === "landscape") return "landscape-contain";
  return "balanced-contain";
}

/**
 * Promo media — show the full photo inside the frame (contain), not a cropped zoom.
 * Box still fills its grid cell; letterboxing uses the page background.
 */
function OfferMedia({
  offer,
  layout,
  className,
  imgClassName,
  children,
}: {
  offer: OfferItem;
  layout: OfferMediaLayout;
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
}) {
  const locale = useCmsUiLocale();
  const copy = offerUiCopy(locale);
  const orientation = readPhotoOrientation(offer.image);

  return (
    <div
      data-cms-media-fit={offerMediaFitAttr(orientation)}
      className={cn(
        "relative isolate overflow-hidden bg-transparent",
        offerAspectClass(offer.image, layout),
        layout === "row" && "md:self-center",
        className,
      )}
    >
      {offer.image ? (
        <CmsImageView
          image={offer.image}
          className={cn(
            "absolute inset-0 h-full w-full object-contain object-center p-3 sm:p-4",
            imgClassName,
          )}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm text-white/40"
          aria-hidden
        >
          {copy.noImage}
        </div>
      )}
      {children}
    </div>
  );
}

/** Wide editorial row: media beside content, premium framed plane. */
function OfferRowCard({ offer, index }: { offer: OfferItem; index: number }) {
  const locale = useCmsUiLocale();
  const copy = offerUiCopy(locale);
  const pct = offerDiscountPercent(offer.originalPrice, offer.discountPrice);
  const hasPrices = offer.originalPrice > 0 || offer.discountPrice > 0;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08]",
        "bg-transparent",
        "transition duration-300 hover:border-white/20",
        "grid grid-cols-1 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]",
      )}
      data-offer-card="side"
    >

      <OfferMedia offer={offer} layout="row">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/35 max-md:bg-gradient-to-t max-md:from-transparent max-md:to-black/40"
          aria-hidden
        />
        {pct > 0 ? (
          <DiscountChip
            pct={pct}
            className="absolute right-4 top-4 shadow-lg sm:right-5 sm:top-5"
            ariaLabel={copy.percentOffAria(pct)}
          />
        ) : null}
      </OfferMedia>

      {/* Content column */}
      <div className="relative flex flex-col justify-center gap-6 p-6 sm:gap-7 sm:p-8 md:gap-8 md:p-10 lg:p-12">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <span
              className="font-display text-sm font-semibold tracking-[0.2em] text-white/30"
              aria-hidden
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <OfferBadge badge={offer.badge} />
          </div>
          <h3 className="font-display max-w-[18ch] break-words text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.02]">
            {offer.title}
          </h3>
          {offer.description ? (
            <p className="max-w-md whitespace-pre-line text-base leading-relaxed text-white/70 sm:text-[1.0625rem]">
              {offer.description}
            </p>
          ) : null}
        </div>

        {hasPrices ? (
          <div className="border-t border-white/10 pt-6 sm:pt-7">
            <OfferPrices offer={offer} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Compact grid card: framed media on top, content below. */
function OfferGridCard({ offer }: { offer: OfferItem }) {
  const locale = useCmsUiLocale();
  const copy = offerUiCopy(locale);
  const pct = offerDiscountPercent(offer.originalPrice, offer.discountPrice);
  const hasPrices = offer.originalPrice > 0 || offer.discountPrice > 0;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08]",
        "bg-transparent",
        "transition duration-300 hover:border-white/20",
      )}
      data-offer-card="card"
    >
      <OfferMedia offer={offer} layout="card" className="w-full">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent"
          aria-hidden
        />
        {pct > 0 ? (
          <DiscountChip
            pct={pct}
            className="absolute right-4 top-4 shadow-lg"
            ariaLabel={copy.percentOffAria(pct)}
          />
        ) : null}
      </OfferMedia>

      <div className="relative flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <OfferBadge badge={offer.badge} />
        <h3 className="font-display break-words text-2xl font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          {offer.title}
        </h3>
        {offer.description ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-white/70 sm:text-[0.9375rem]">
            {offer.description}
          </p>
        ) : null}
        {hasPrices ? (
          <div className="mt-auto border-t border-white/10 pt-4 sm:pt-5">
            <OfferPrices offer={offer} compact />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function OffersSectionView({ data }: OffersSectionViewProps) {
  const locale = useCmsUiLocale();
  const copy = offerUiCopy(locale);
  const layout = normalizeOffersLayout(data.layout);
  const hasOffers = data.offers.length > 0;

  return (
    <SectionShell blockType="offers">
      <GalleryUnifiedPanel unit="open">
        <GallerySectionIntro title={data.title} intro={data.subtitle} />

        {!hasOffers ? (
          <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/50">
            {copy.empty}
          </p>
        ) : layout === "cards" ? (
          <div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8"
            data-offers-layout="cards"
          >
            {data.offers.map((offer) => (
              <OfferGridCard key={offer.id} offer={offer} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8 md:gap-10 lg:gap-12" data-offers-layout="side">
            {data.offers.map((offer, index) => (
              <OfferRowCard key={offer.id} offer={offer} index={index} />
            ))}
          </div>
        )}
      </GalleryUnifiedPanel>
    </SectionShell>
  );
}
