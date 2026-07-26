import { partners } from "@/lib/partners";
import { useI18n } from "@/lib/i18n";

export function PartnersSlider() {
  const { t } = useI18n();
  const rows = [partners, partners, partners];

  return (
    <section className="content-auto relative border-y border-white/5 bg-card/40 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {t.partners.kicker}
        </p>
        <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">{t.partners.title}</h2>
      </div>

      <div className="marquee-mask mt-12 overflow-hidden py-2">
        <div className="animate-marquee flex w-max items-center will-change-transform">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex shrink-0 items-center gap-5 pr-5 sm:gap-8 sm:pr-8">
              {row.map((p) => (
                <div
                  key={`${p.name}-${rowIndex}`}
                  className="partner-logo-card group flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/95 p-3 transition hover:bg-white sm:h-28 sm:w-48"
                  title={p.name}
                >
                  <img
                    src={p.src}
                    alt={p.name}
                    width={300}
                    height={100}
                    loading="eager"
                    decoding="async"
                    fetchPriority="low"
                    className="block max-h-full max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
