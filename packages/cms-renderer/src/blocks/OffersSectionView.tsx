import * as React from "react";
import {
  formatOfferPriceNl,
  offerDiscountPercent,
  type OffersBlockData,
  type OfferItem,
} from "@mccoy/cms-schema";
import { SectionShell } from "../SectionShell";
import { SectionHeader } from "../sectionChromeUi";
import { CmsImageView } from "./CmsImageView";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type OffersSectionViewProps = {
  data: OffersBlockData;
};

function OfferCard({ offer }: { offer: OfferItem }) {
  const pct = offerDiscountPercent(offer.originalPrice, offer.discountPrice);
  const hasPrices = offer.originalPrice > 0 || offer.discountPrice > 0;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-white/10",
        "bg-gradient-to-br from-white/[0.07] via-white/[0.025] to-transparent",
        "grid grid-cols-1 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]",
      )}
      data-offer-card="side"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left_top,rgba(63,182,242,0.16),transparent_52%)] opacity-80 transition group-hover:opacity-100"
        aria-hidden
      />

      {/* Media plane — dominant on desktop (~50%), full-bleed object-cover */}
      <div className="relative isolate min-h-[280px] overflow-hidden bg-black/45 sm:min-h-[320px] md:min-h-[360px]">
        {offer.image ? (
          <CmsImageView
            image={offer.image}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm text-white/40"
            aria-hidden
          >
            Geen afbeelding
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/35 max-md:bg-gradient-to-t max-md:from-transparent max-md:to-black/40"
          aria-hidden
        />
      </div>

      {/* Content column */}
      <div className="relative flex flex-col justify-center gap-6 p-6 sm:gap-7 sm:p-8 md:gap-8 md:p-10 lg:p-12">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {offer.badge ? (
            <p className="inline-flex rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {offer.badge}
            </p>
          ) : null}
          <h3 className="font-display max-w-[18ch] text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white break-words sm:text-4xl lg:text-[2.65rem] lg:leading-[1.02]">
            {offer.title}
          </h3>
          {offer.description ? (
            <p className="max-w-md whitespace-pre-line text-base leading-relaxed text-white/70 sm:text-[1.0625rem]">
              {offer.description}
            </p>
          ) : null}
        </div>

        {hasPrices ? (
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-white/10 pt-6 sm:pt-7">
            <div className="flex min-w-0 flex-col gap-1.5">
              {offer.originalPrice > 0 && offer.discountPrice < offer.originalPrice ? (
                <p className="text-sm text-white/45 line-through sm:text-[15px]">
                  {formatOfferPriceNl(offer.originalPrice)}
                </p>
              ) : offer.originalPrice > 0 && offer.discountPrice <= 0 ? (
                <p className="offer-price-glow font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {formatOfferPriceNl(offer.originalPrice)}
                </p>
              ) : null}
              {offer.discountPrice > 0 ? (
                <p className="offer-price-glow font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  {formatOfferPriceNl(offer.discountPrice)}
                </p>
              ) : null}
            </div>
            {pct > 0 ? (
              <span className="offer-pct-badge mb-1.5" aria-label={`${pct} procent korting`}>
                −{pct}%
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function OffersSectionView({ data }: OffersSectionViewProps) {
  return (
    <SectionShell blockType="offers">
      <SectionHeader
        title={data.title}
        body={data.subtitle}
        align="left"
        className="mb-10 sm:mb-14"
      />

      {data.offers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-sm text-white/50">
          Nog geen aanbiedingen toegevoegd.
        </p>
      ) : (
        <div className="flex flex-col gap-8 md:gap-10 lg:gap-12" data-offers-layout="side">
          {data.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </SectionShell>
  );
}
