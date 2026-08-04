import { useI18n } from "@/lib/i18n";
import { CountUp } from "../CountUp";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedStatsCopy } from "@/lib/cms-i18n";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer/section-layout";
import {
  SectionAmbient,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

/**
 * Below-fold home stats — no Motion. Keeps the Motion package out of the
 * homepage dependency graph (route-tree sharing otherwise pulls it into the
 * main chunk and inflates TBT).
 */
export function Stats() {
  const { t } = useI18n();
  const content = useTypedSectionContent("page_home", "home.stats");
  const copy = localizedStatsCopy(content, t);
  const eyebrow = copy.eyebrow;
  const body = copy.body;
  const items = copy.items;

  return (
    <section className="relative isolate overflow-hidden py-24">
      <SectionAmbient />
      <div className={cn("relative", SECTION_PAGE_RAIL, "grid gap-16 lg:grid-cols-2")}>
        <div>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="font-display mt-4 text-4xl leading-tight text-foreground md:text-5xl lg:text-6xl">
            {copy.heading ? (
              copy.heading
            ) : (
              <>
                {t.stats.title} <span className="text-primary">{t.stats.titleAccent}</span>{" "}
                {t.stats.titleEnd}
              </>
            )}
          </h2>
          <p className="mt-6 max-w-lg whitespace-pre-line text-muted-foreground">{body}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 self-center sm:grid-cols-3">
          {items.map((s, i) => (
            <div key={`${s.value}-${s.label}-${i}`}>
              <SectionSurface variant="outlined" className="h-full p-6 transition hover:border-primary/40">
                <div className="font-display text-5xl text-primary md:text-6xl">
                  <CountUp value={s.value} duration={2.0 + i * 0.15} />
                </div>
                <div className="mt-2 text-sm font-bold text-muted-foreground">{s.label}</div>
              </SectionSurface>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
