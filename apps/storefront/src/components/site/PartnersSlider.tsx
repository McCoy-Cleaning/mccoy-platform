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
  type PartnerItem,
} from "@mccoy/cms-schema";
import {
  PARTNER_LOGO_SIZES,
  partnerLogoWebpSrc,
  supabaseLogoSrc,
} from "@/lib/image-delivery";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { WysiwygInlineText } from "./cms-editor/WysiwygInlineText";
import {
  WysiwygPartnerAddButton,
  WysiwygPartnerLogoChrome,
} from "./cms-editor/WysiwygPartnerLogo";

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
  const { showEditorChrome } = useLiveEditApi();
  const content = useTypedSectionContent("page_home", "home.partners");
  const copy = localizedPartnersCopy(content, t);
  const eyebrow = copy.eyebrow;
  const heading = copy.heading;

  const cmsItems: PartnerItem[] = content.items;
  const displayItems = cmsItems.length > 0
    ? cmsItems.map((item) => ({
        id: item.id,
        name: item.name,
        src: item.image.src,
        logoBackdrop: item.logoBackdrop as LogoBackdropPreference | undefined,
        resolvedBackdrop: item.resolvedBackdrop as LogoBackdropResolved | undefined,
      }))
    : partners.map((p, i) => ({
        id: `fallback-partner-${i}`,
        name: p.name,
        src: p.src,
        logoBackdrop: undefined as LogoBackdropPreference | undefined,
        resolvedBackdrop: p.backdrop as LogoBackdropResolved,
      }));

  return (
    <section className="relative border-y border-white/5 bg-card/40 py-14 sm:py-16">
      <SectionInner className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          <WysiwygInlineText
            label="Eyebrow"
            value={eyebrow ?? ""}
            enFieldPath="section:home.partners:eyebrow"
            target={{ kind: "section", sectionKey: "home.partners", field: "eyebrow" }}
          />
        </p>
        <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">
          <WysiwygInlineText
            as="span"
            label="Kop"
            value={heading}
            enFieldPath="section:home.partners:heading"
            target={{ kind: "section", sectionKey: "home.partners", field: "heading" }}
          />
        </h2>
      </SectionInner>

      {showEditorChrome ? (
        <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-center gap-5 px-4 sm:gap-8">
          {cmsItems.map((item, i) => {
            const backdrop = partnerCardBackdrop({
              name: item.name,
              src: item.image.src,
              logoBackdrop: item.logoBackdrop as LogoBackdropPreference | undefined,
              resolvedBackdrop: item.resolvedBackdrop as LogoBackdropResolved | undefined,
            });
            return (
              <WysiwygPartnerLogoChrome key={item.id} item={item} items={cmsItems}>
                <div
                  className={PARTNER_CARD_CLASS}
                  title={item.name}
                  style={{ backgroundColor: backdrop }}
                >
                  <PartnerLogoImg name={item.name} src={item.image.src} eager={i < 3} />
                </div>
              </WysiwygPartnerLogoChrome>
            );
          })}
          <WysiwygPartnerAddButton items={cmsItems} />
        </div>
      ) : (
        <div className="marquee-mask mt-12 overflow-hidden py-2">
          <div className="animate-marquee flex w-max items-center">
            {[displayItems, displayItems].map((row, rowIndex) => (
              <div key={rowIndex} className="flex shrink-0 items-center gap-5 pr-5 sm:gap-8 sm:pr-8">
                {row.map((p, i) => {
                  const backdrop = partnerCardBackdrop(p);
                  return (
                    <div
                      key={`${p.id}-${rowIndex}`}
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
      )}
    </section>
  );
}
