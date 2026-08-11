import { SectionInner } from "@mccoy/cms-renderer";
import { partners } from "@/lib/partners";
import { useI18n } from "@/lib/i18n";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedPartnersCopy } from "@/lib/cms-i18n";
import {
  defaultPartnerResolvedBackdrop,
  resolveLogoBackdrop,
  type LogoBackdropPreference,
  type LogoBackdropResolved,
} from "@mccoy/cms-schema";
import {
  PARTNER_LOGO_SIZES,
  partnerLogoWebpSrc,
  supabaseLogoSrc,
} from "@/lib/image-delivery";

const PARTNER_CARD_CLASS =
  "partner-logo-card group flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 transition hover:border-white/25";

function PartnerLogoImg({
  name,
  src,
  eager,
}: {
  name: string;
  src: string;
  eager: boolean;
}) {
  const localWebp = partnerLogoWebpSrc(src);
  const remote = supabaseLogoSrc(src, 480);
  const webp = localWebp ?? remote?.webpSrc;
  // Match DeliveryImage: use WebP as <img src> so Chromium does not paint the
  // PNG/origin fallback first and then swap (reads as a delayed zoom).
  const imgSrc = webp ?? remote?.fallbackSrc ?? src;

  return (
    <picture className="partner-logo-picture">
      {webp ? (
        <source
          type="image/webp"
          srcSet={localWebp ? `${localWebp} 480w` : webp}
          sizes={PARTNER_LOGO_SIZES}
        />
      ) : null}
      <img
        src={imgSrc}
        alt={name.trim() || "Partner"}
        width={160}
        height={64}
        sizes={PARTNER_LOGO_SIZES}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority="low"
        className="partner-logo-img block"
      />
    </picture>
  );
}

function partnerCardBackdrop(item: {
  name: string;
  src: string;
  logoBackdrop?: LogoBackdropPreference;
  resolvedBackdrop?: LogoBackdropResolved;
}): string {
  return resolveLogoBackdrop({
    logoBackdrop: item.logoBackdrop,
    resolvedBackdrop:
      item.resolvedBackdrop ??
      defaultPartnerResolvedBackdrop(item.src) ??
      defaultPartnerResolvedBackdrop(item.name),
  });
}

export function PartnersSlider() {
  const { t } = useI18n();
  const content = useTypedSectionContent("page_home", "home.partners");
  const copy = localizedPartnersCopy(content, t);
  const eyebrow = copy.eyebrow;
  const heading = copy.heading;
  const partnerItems =
    content.items.length > 0
      ? content.items.map((item) => ({
          name: item.name,
          src: item.image.src,
          logoBackdrop: item.logoBackdrop as LogoBackdropPreference | undefined,
          resolvedBackdrop: item.resolvedBackdrop as LogoBackdropResolved | undefined,
        }))
      : partners.map((p) => ({
          name: p.name,
          src: p.src,
          logoBackdrop: undefined as LogoBackdropPreference | undefined,
          resolvedBackdrop: p.backdrop as LogoBackdropResolved,
        }));
  const rows = [partnerItems, partnerItems];

  return (
    <section className="relative border-y border-white/5 bg-card/40 py-14 sm:py-16">
      <SectionInner className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
        <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">{heading}</h2>
      </SectionInner>

      <div className="marquee-mask mt-12 overflow-hidden py-2">
        <div className="animate-marquee flex w-max items-center">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex shrink-0 items-center gap-5 pr-5 sm:gap-8 sm:pr-8">
              {row.map((p, i) => {
                const backdrop = partnerCardBackdrop(p);
                return (
                  <div
                    key={`${p.name}-${rowIndex}`}
                    className={PARTNER_CARD_CLASS}
                    title={p.name}
                    style={{ backgroundColor: backdrop }}
                  >
                    <PartnerLogoImg name={p.name} src={p.src} eager={rowIndex === 0 && i < 3} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
