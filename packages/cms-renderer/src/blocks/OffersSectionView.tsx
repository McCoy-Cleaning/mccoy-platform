import * as React from "react";
import {
  createOfferItem,
  normalizeOfferPriceDisplay,
  type OffersBlockData,
  type OfferItem,
} from "@mccoy/cms-schema";
import { SectionShell } from "../SectionShell";
import { SectionHeader } from "../sectionChromeUi";
import {
  CmsListAddButton,
  CmsListRemoveButton,
  EditableMedia,
  EditableText,
  useCmsTypedListEditor,
} from "../edit-surface";
import { CmsImageView } from "./CmsImageView";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type OffersSectionViewProps = {
  data: OffersBlockData;
};

function OfferCard({
  offer,
  index,
  editing,
  onRemove,
}: {
  offer: OfferItem;
  index: number;
  editing: boolean;
  onRemove?: () => void;
}) {
  // Coerce legacy numeric prices; CMS copy is display strings only (not checkout money).
  // Fresh "Nieuwe aanbieding" blanks are healed in normalizeOffers before this view.
  const originalPrice = normalizeOfferPriceDisplay(offer.originalPrice, "");
  const discountPrice = normalizeOfferPriceDisplay(offer.discountPrice, "");
  const discountBadge =
    typeof offer.discountBadge === "string" ? offer.discountBadge : "";
  const hasOriginal = originalPrice.trim().length > 0;
  const hasDiscount = discountPrice.trim().length > 0;
  const hasBadge = discountBadge.trim().length > 0;
  const hasPrices = hasOriginal || hasDiscount || hasBadge;
  const badge = offer.badge ?? "";
  const description = offer.description ?? "";
  /** Strikethrough when a sale price is also shown; alone = primary glow price. */
  const originalIsStrike = hasOriginal && hasDiscount;
  const showOriginal = hasOriginal || editing;
  const showDiscount = hasDiscount || editing;
  // Never paint an empty offer-pct-badge (reads as a broken blue oval).
  const showBadgePill = hasBadge;
  const showBadgeEditor = editing && !hasBadge;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-white/10",
        "bg-gradient-to-br from-white/[0.07] via-white/[0.025] to-transparent",
        "grid grid-cols-1 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]",
      )}
      data-offer-card="side"
    >
      {editing && onRemove ? (
        <CmsListRemoveButton
          label={`Aanbieding verwijderen: ${offer.title}`}
          onRemove={onRemove}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left_top,rgba(63,182,242,0.16),transparent_52%)] opacity-80 transition group-hover:opacity-100"
        aria-hidden
      />

      <div className="relative isolate min-h-[280px] overflow-hidden bg-black/45 sm:min-h-[320px] md:min-h-[360px]">
        <EditableMedia
          path="offers"
          image={offer.image}
          listItemId={offer.id}
          listImageKey="image"
          emptyPlaceholder={editing}
          className="absolute inset-0 h-full w-full"
        >
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
        </EditableMedia>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/35 max-md:bg-gradient-to-t max-md:from-transparent max-md:to-black/40"
          aria-hidden
        />
      </div>

      <div className="relative flex flex-col justify-center gap-6 p-6 sm:gap-7 sm:p-8 md:gap-8 md:p-10 lg:p-12">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {badge || editing ? (
            <p className="inline-flex rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <EditableText path={`offers.${index}.badge`} value={badge}>
                {badge}
              </EditableText>
            </p>
          ) : null}
          <h3 className="font-display max-w-[18ch] text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white break-words sm:text-4xl lg:text-[2.65rem] lg:leading-[1.02]">
            <EditableText path={`offers.${index}.title`} value={offer.title}>
              {offer.title}
            </EditableText>
          </h3>
          {description || editing ? (
            <p className="max-w-md whitespace-pre-line text-base leading-relaxed text-white/70 sm:text-[1.0625rem]">
              <EditableText path={`offers.${index}.description`} value={description} multiline>
                {description}
              </EditableText>
            </p>
          ) : null}
        </div>

        {hasPrices || editing ? (
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-white/10 pt-6 sm:pt-7">
            <div className="flex min-w-0 flex-col gap-1.5">
              {showOriginal ? (
                <p
                  className={
                    originalIsStrike || (editing && showDiscount)
                      ? "min-h-[1.25rem] text-sm text-white/45 line-through sm:text-[15px]"
                      : "offer-price-glow font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
                  }
                >
                  <EditableText path={`offers.${index}.originalPrice`} value={originalPrice}>
                    {originalPrice}
                  </EditableText>
                </p>
              ) : null}
              {showDiscount ? (
                <p className="offer-price-glow min-h-[2.5rem] font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  <EditableText path={`offers.${index}.discountPrice`} value={discountPrice}>
                    {discountPrice}
                  </EditableText>
                </p>
              ) : null}
            </div>
            {showBadgePill ? (
              <span className="offer-pct-badge mb-1.5" aria-label={discountBadge}>
                <EditableText path={`offers.${index}.discountBadge`} value={discountBadge}>
                  {discountBadge}
                </EditableText>
              </span>
            ) : null}
            {showBadgeEditor ? (
              <span
                className="mb-1.5 inline-flex min-h-[2rem] min-w-[3.5rem] items-center justify-center rounded-full border border-dashed border-sky-400/45 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100/70"
                aria-label="Kortingsbadge"
                data-offer-badge-empty=""
              >
                <EditableText path={`offers.${index}.discountBadge`} value={discountBadge}>
                  {discountBadge}
                </EditableText>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function OffersSectionView({ data }: OffersSectionViewProps) {
  const list = useCmsTypedListEditor<OfferItem>("offers");
  const editing = list.editing;
  const title = data.title;
  const subtitle = data.subtitle ?? "";

  return (
    <SectionShell blockType="offers">
      <SectionHeader
        title={
          <EditableText path="title" value={title}>
            {title}
          </EditableText>
        }
        body={
          editing || subtitle ? (
            <EditableText path="subtitle" value={subtitle} multiline>
              {subtitle}
            </EditableText>
          ) : undefined
        }
        align="left"
        className="mb-10 sm:mb-14"
      />

      {data.offers.length === 0 && !editing ? (
        <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-sm text-white/50">
          Nog geen aanbiedingen toegevoegd.
        </p>
      ) : (
        <div className="flex flex-col gap-8 md:gap-10 lg:gap-12" data-offers-layout="side">
          {data.offers.map((offer, index) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              index={index}
              editing={editing}
              onRemove={editing ? () => list.removeById(data.offers, offer.id) : undefined}
            />
          ))}
          {editing ? (
            <CmsListAddButton
              label="Aanbieding toevoegen"
              onAdd={() => list.append(data.offers, createOfferItem())}
              className="min-h-[10rem]"
            />
          ) : null}
        </div>
      )}
    </SectionShell>
  );
}
