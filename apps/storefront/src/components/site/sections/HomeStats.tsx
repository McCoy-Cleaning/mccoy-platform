import { motion } from "motion/react";
import { useI18n } from "@/lib/i18n";
import { CountUp } from "../CountUp";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedStatsCopy } from "@/lib/cms-i18n";
import {
  SECTION_PAGE_RAIL,
  SectionAmbient,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

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
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h2 className="font-display mt-4 text-4xl leading-tight text-foreground md:text-5xl lg:text-6xl">
            {copy.heading ? (
              copy.heading
            ) : (
              <>
                {t.stats.title} <span className="text-primary">{t.stats.titleAccent}</span> {t.stats.titleEnd}
              </>
            )}
          </h2>
          <p className="mt-6 max-w-lg text-muted-foreground">{body}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 self-center sm:grid-cols-3">
          {items.map((s, i) => (
            <motion.div
              key={`${s.value}-${s.label}-${i}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
            >
              <SectionSurface variant="outlined" className="h-full p-6 transition hover:border-primary/40">
                <div className="font-display text-5xl text-primary md:text-6xl">
                  <CountUp value={s.value} duration={2.0 + i * 0.15} />
                </div>
                <div className="mt-2 text-sm font-bold text-muted-foreground">{s.label}</div>
              </SectionSurface>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
