import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  Wind,
  UtensilsCrossed,
  Hammer,
  Sofa,
  GlassWater,
  Building2,
  ShoppingBag,
  CheckCircle2,
  X,
  Award,
  Target,
  Eye,
  Users,
  ShieldCheck,
  Leaf,
  History,
} from "lucide-react";
import hero from "@/assets/hero-cleaning.jpg";
import wHorecaAsset from "@/assets/work-horeca-new.jpg.asset.json";
import wRegular from "@/assets/work-regular.jpg";
import wOpl from "@/assets/work-oplevering.jpg";
import wFloor from "@/assets/work-floor.jpg";
import wGlassLadder from "@/assets/work-glass.jpg";
import flyerAsset from "@/assets/mccoy-products-flyer.png.asset.json";
import serviceGlassAsset from "@/assets/mccoy-service-glass-van.jpg.asset.json";
import aboutMissionAsset from "@/assets/mccoy-mission-before-after.png.asset.json";
import aboutVisionAsset from "@/assets/mccoy-about-vision.png.asset.json";
import aboutVisionChurchAsset from "@/assets/mccoy-vision-church.jpg.asset.json";
import aboutHistoryAsset from "@/assets/mccoy-about-history-new.jpg.asset.json";
import svcRegularAsset from "@/assets/mccoy-regular-sander.png.asset.json";
import svcOpleveringAsset from "@/assets/mccoy-oplevering-hal.png.asset.json";
import svcFloorAsset from "@/assets/mccoy-floor-scrubber.jpg.asset.json";
import svcFurnitureAsset from "@/assets/mccoy-furniture-bank.jpg.asset.json";
import { useI18n } from "@/lib/i18n";
import { CountUp } from "./CountUp";
import { Editable, EditableImg } from "@/lib/cms/edit-context";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

/* ============= HERO ============= */
export function Hero() {
  const { t, lang } = useI18n();
  const isEn = lang === "en";

  return (
    <section id="home" className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24">
      <div className="absolute inset-0 -z-10 bg-grid opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-background/90" />

      {/* Animated accent blobs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.9, scale: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        className="pointer-events-none absolute -top-32 -right-24 -z-10 hidden h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-[90px] md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-10 left-1/3 -z-10 hidden h-72 w-72 rounded-full bg-primary/12 blur-[80px] lg:block"
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 1 }}
        className="pointer-events-none absolute right-10 top-1/4 -z-10 hidden lg:block"
      >
        <div className="relative h-72 w-72">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border border-primary/30"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
            className="absolute inset-6 rounded-full border border-primary/20"
          />
          <div className="absolute inset-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/0 blur-2xl" />
        </div>
      </motion.div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-[0_0_40px_-10px_rgba(63,182,242,0.6)] backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Sparkles className="h-3.5 w-3.5" />
            <Editable k="hero.kicker">{t.hero.kicker}</Editable>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-display mt-6 text-6xl leading-[0.98] tracking-tight text-white sm:text-7xl lg:text-[5.75rem] xl:text-[6.5rem]"
          >
            <Editable k="hero.title">{t.hero.title}</Editable>{" "}
            <span className="relative inline-block bg-gradient-to-br from-primary via-primary to-white/90 bg-clip-text text-transparent">
              <Editable k="hero.titleAccent">{t.hero.titleAccent}</Editable>
              <motion.span
                aria-hidden
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="absolute -bottom-2 left-0 h-1 w-full origin-left rounded-full bg-primary/70"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-8 max-w-xl text-lg text-white/75 md:text-xl"
          >
            <Editable k="hero.sub" multiline>{t.hero.sub}</Editable>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur transition hover:border-primary/40 hover:bg-white/10"
            >
              <Editable k="hero.ctaSecondary">{t.hero.ctaSecondary}</Editable>
            </Link>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.2em] text-white/55"
          >
            {t.stats.items.map((it) => (
              <span key={it.label} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {it.value} {it.label}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Right side image card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative lg:col-span-5"
        >
          <div className="relative mx-auto max-w-md">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(63,182,242,0.4)]">
              <EditableImg
                k="hero.image"
                src={hero}
                alt="McCoy Cleaning professional at work"
                className="h-[460px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-white/15 bg-card/95 px-5 py-4 shadow-2xl sm:block"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-2xl text-white leading-none">25+</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-1">
                    {t.stats.items[0]?.label ?? ""}
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="absolute -top-4 -right-4 hidden rounded-2xl border border-primary/30 bg-primary/20 px-4 py-3 sm:block"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                <ShieldCheck className="h-4 w-4 text-primary" /> {isEn ? "Certified" : "Gecertificeerd"}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2"
      >
        <div className="h-10 w-6 rounded-full border border-white/20 p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="h-2 w-1 rounded-full bg-primary mx-auto"
          />
        </div>
      </motion.div>
    </section>
  );
}

/* ============= STATS ============= */
export function Stats() {
  const { t } = useI18n();
  return (
    <section className="relative py-24">
      <div className="mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t.stats.kicker}</p>
          <h2 className="font-display mt-4 text-4xl leading-tight text-white md:text-5xl lg:text-6xl">
            {t.stats.title} <span className="text-primary">{t.stats.titleAccent}</span> {t.stats.titleEnd}
          </h2>
          <p className="mt-6 max-w-lg text-white/65">{t.stats.sub}</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 self-center sm:grid-cols-3">
          {t.stats.items.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.15 }}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-card p-6 transition hover:border-primary/40"
            >
              <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              <div className="font-display text-5xl text-primary md:text-6xl">
                <CountUp value={s.value} duration={2.6 + i * 0.2} />
              </div>
              <div className="mt-2 text-sm font-bold text-white/65">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============= SERVICES ============= */
const serviceIcons = [Wind, UtensilsCrossed, Hammer, Building2, Sofa, GlassWater];
const serviceImages = [
  svcRegularAsset.url,
  wHorecaAsset.url,
  svcOpleveringAsset.url,
  svcFloorAsset.url,
  svcFurnitureAsset.url,
  serviceGlassAsset.url,
];
// Indices 0..3 -> "Contact us" -> /contact (general tab).
// Index 4 (furniture) -> "Get a quote" -> /contact#furniture.
// Index 5 (window)   -> "Get a quote" -> /contact#window.

export function Services() {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const ctaFor = (i: number) => {
    if (i === 4) return { href: "/offerte#furniture", label: t.services.quoteCta };
    if (i === 5) return { href: "/offerte#window", label: t.services.quoteCta };
    return { href: "/contact", label: t.services.contactCta };
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
  return (
    <section id="services" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t.services.kicker}</p>
          <h1 className="font-display mt-4 text-4xl text-white md:text-5xl">{t.services.title}</h1>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.work.items.map((s, i) => {
            const Icon = serviceIcons[i] ?? Wind;
            return (
              <article
                key={s.title}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-card/70 transition hover:border-primary/40"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={serviceImages[i] ?? wRegular}
                    alt={s.title}
                    width={600}
                    height={360}
                    loading="lazy"
                    decoding="async"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                  <div className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{s.desc}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 transition hover:border-primary/40 hover:text-white"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t.services.readMore}
                    </button>
                    {(() => {
                      const cta = ctaFor(i);
                      return (
                        <a
                          href={cta.href}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition group-hover:gap-2.5"
                        >
                          {cta.label}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </a>
                      );
                    })()}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          open !== null
            ? (() => {
                const s = t.work.items[open];
                const Icon = serviceIcons[open] ?? Wind;
                return (
                  <div key="svc-modal" className="fixed inset-0 z-[100] overflow-hidden bg-background/92">
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="service-modal-title"
                      onClick={(e) => e.stopPropagation()}
                      className="service-modal-panel fixed z-[101] grid max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-[0_40px_120px_-20px_rgba(63,182,242,0.5)] sm:rounded-[2rem] md:grid-cols-2 md:grid-rows-1"
                    >
                      <div className="relative h-40 shrink-0 overflow-hidden sm:h-64 md:h-auto">
                        <img
                          src={serviceImages[open] ?? wRegular}
                          alt={s.title}
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
                          {t.services.kicker}
                        </motion.p>
                        <motion.h3
                          id="service-modal-title"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.28, duration: 0.5 }}
                          className="font-display mt-2 text-2xl text-white sm:mt-3 sm:text-3xl md:text-4xl"
                        >
                          {s.title}
                        </motion.h3>
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="mt-4 h-0.5 w-16 origin-left rounded-full bg-primary"
                        />
                        <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/75 sm:mt-6 sm:space-y-4 sm:text-[15px]">
                          {s.full.map((p, idx) => (
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
                        {(() => {
                          const cta = ctaFor(open);
                          return (
                            <motion.a
                              initial={{ opacity: 0, y: 14 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.7, duration: 0.5 }}
                              href={cta.href}
                              onClick={() => setOpen(null)}
                              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03] sm:mt-8 sm:px-6"
                            >
                              {cta.label} <ArrowRight className="h-4 w-4" />
                            </motion.a>
                          );
                        })()}
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

/* ============= ABOUT ============= */
type PillarRowProps = {
  title: string;
  body: string;
  Icon: typeof Target;
  img: string;
  tag: string;
  index: number;
  objectPosition?: string;
  aspectClassName?: string;
  scaleValues?: [number, number, number];
};

function PillarRow({
  title,
  body,
  Icon,
  img,
  tag,
  index,
  objectPosition,
  aspectClassName = "aspect-[5/4]",
  scaleValues,
}: PillarRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["-18%", "18%"]);
  const defaultScale: [number, number, number] = [1.35, 1.15, 1.4];
  const activeScale = scaleValues ?? defaultScale;
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], reduced ? [1, 1, 1] : activeScale);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], [0.95, 0.1, 0.1, 0.6]);
  const textY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [80, -40]);
  const tagRotate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-12, 12]);
  const reverse = index % 2 === 1;
  return (
    <div
      ref={ref}
      className={`grid items-center gap-8 lg:grid-cols-12 lg:gap-14 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      {/* Image */}
      <motion.div
        initial={{ opacity: 0, clipPath: "inset(0 100% 0 0 round 2rem)" }}
        whileInView={{ opacity: 1, clipPath: "inset(0 0% 0 0 round 2rem)" }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.1, ease: [0.83, 0, 0.17, 1] }}
        className="relative lg:col-span-6"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_80px_-30px_rgba(63,182,242,0.45)]">
          <div className={`relative ${aspectClassName} w-full overflow-hidden`}>
            <motion.img
              src={img}
              alt={title}
              width={1280}
              height={896}
              loading="lazy"
              decoding="async"
              style={{ y: imgY, scale: imgScale, objectPosition: objectPosition ?? "center" }}
              className="absolute inset-0 h-full w-full object-cover will-change-transform"
            />
            <motion.div
              style={{ opacity: overlayOpacity }}
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"
            />
          </div>
          <motion.div
            style={{ rotate: tagRotate }}
            className="absolute -right-4 -top-4 flex h-20 w-20 items-center justify-center rounded-full border border-primary/40 bg-background/70 font-display text-2xl text-primary shadow-[0_10px_40px_-10px_rgba(63,182,242,0.6)] backdrop-blur"
          >
            {tag}
          </motion.div>
        </div>
        <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-primary/10 blur-3xl" />
      </motion.div>

      {/* Text */}
      <motion.div style={{ y: textY }} className="lg:col-span-6">
        <motion.div
          initial={{ opacity: 0, x: reverse ? -60 : 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
              <Icon className="h-6 w-6" />
            </div>
            <span className="font-display text-sm uppercase tracking-[0.3em] text-primary/80">{tag}</span>
          </div>
          <h3 className="font-display mt-5 text-4xl text-white md:text-5xl lg:text-6xl">{title}</h3>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-white/75">
            {body.split("\n\n").map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function About() {
  const { t } = useI18n();
  const loc = useLocation();
  const isEn = loc.pathname === "/en" || loc.pathname.startsWith("/en/");
  const pillars = isEn
    ? [
        { icon: Award, label: "Premium quality" },
        { icon: ShieldCheck, label: "Reliable team" },
        { icon: Users, label: "Personal contact" },
        { icon: Leaf, label: "Sustainable products" },
      ]
    : [
        { icon: Award, label: "Premium kwaliteit" },
        { icon: ShieldCheck, label: "Betrouwbaar team" },
        { icon: Users, label: "Persoonlijk contact" },
        { icon: Leaf, label: "Duurzame middelen" },
      ];
  return (
    <section id="about" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="grid gap-10 lg:grid-cols-12">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="lg:col-span-7"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t.about.kicker}</p>
            <h1 className="font-display mt-4 text-4xl text-white md:text-5xl lg:text-6xl">{t.about.title}</h1>
          </motion.div>

          {/* Pillars */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            {pillars.map((p) => (
              <div
                key={p.label}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-card/60 p-4 transition hover:border-primary/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <p.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-white/85">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll-driven pillars with imagery */}
        <div className="mt-20 space-y-24 sm:space-y-32">
          {[
            {
              title: t.about.missionTitle,
              body: t.about.mission,
              Icon: Target,
              img: aboutMissionAsset.url,
              tag: "01",
              aspectClassName: "aspect-[16/9]",
              scaleValues: [1.05, 1, 1.05] as [number, number, number],
            },
            {
              title: t.about.visionTitle,
              body: t.about.vision,
              Icon: Eye,
              img: aboutVisionChurchAsset.url,
              tag: "02",
            },
            {
              title: t.about.historyTitle,
              body: t.about.history,
              Icon: History,
              img: aboutHistoryAsset.url,
              tag: "03",
              objectPosition: "center 20%",
            },
          ].map((b, i) => (
            <PillarRow key={b.title} index={i} {...b} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============= WORK GALLERY ============= */
export function WorkGallery() {
  const { t } = useI18n();
  const images = [wRegular, wHorecaAsset.url, wOpl, wFloor, aboutVisionAsset.url, wGlassLadder];
  return (
    <section id="work" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-wrap items-end justify-between gap-6"
        >
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t.work.kicker}</p>
            <h2 className="font-display mt-4 text-4xl text-white md:text-5xl">{t.work.title}</h2>
            <p className="mt-4 text-white/65">{t.work.sub}</p>
          </div>
        </motion.div>

        <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-4 md:grid-cols-4">
          {images.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.06 }}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 ${
                i === 0 ? "col-span-2 row-span-2" : ""
              } ${i === 3 ? "md:row-span-2" : ""}`}
            >
              <img
                src={src}
                alt={t.work.items[i]?.title ?? "McCoy work"}
                loading="lazy"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
              <div className="absolute bottom-0 p-5">
                <p className="font-display text-xl text-white">{t.work.items[i]?.title ?? ""}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============= PRODUCTS ============= */
export function Products() {
  const { t, lang } = useI18n();
  const isEn = lang === "en";

  return (
    <section id="products" className="relative py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-card/90 via-card/70 to-card/40 p-8 shadow-[0_40px_120px_-40px_rgba(63,182,242,0.35)] backdrop-blur-xl sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t.products.kicker}
            </div>
            <h1 className="font-display mt-5 max-w-3xl text-4xl leading-[1.05] text-white md:text-5xl lg:text-6xl">
              {isEn
                ? "Fragrance products with a premium sanitary experience."
                : "Geurproducten met een premium sanitaire beleving."}
            </h1>
            <p className="mt-5 max-w-2xl text-white/70">
              {isEn
                ? "An important part of McCoy Cleaning is McCoy Products, our wholesale division. In our range you will find: hygiene paper, professional soaps, cleaning agents for hospitality, and equipment and hardware for cleaning."
                : "Een belangrijk onderdeel van McCoy Cleaning is McCoy Products, onze groothandel. In ons assortiment vind je: hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en apparatuur en hardware om schoon te maken."}
            </p>
            <p className="mt-3 max-w-2xl text-white/70">
              {isEn
                ? "To obtain our products, you can call or contact us via the contact form; we will be happy to help you."
                : "Voor het verkrijgen van onze producten kunt u bellen of contact op nemen via het contactformulier, we helpen u dan graag."}
            </p>

            <div className="relative mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03]"
              >
                <ShoppingBag className="h-4 w-4" />
                {t.products.cta}
              </Link>
              <a
                href="tel:+31541534982"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-primary/40 hover:text-white"
              >
                0541 534 982
              </a>
            </div>

            <div className="relative mt-8 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-sm leading-relaxed text-white/85">
                {isEn
                  ? "We are currently busy behind the scenes with the online webshop! Coming soon."
                  : "We zijn momenteel druk achter de schermen met de online webshop! Deze volgt binnenkort."}
              </p>
            </div>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-card/70 p-3 shadow-[0_30px_80px_-30px_rgba(63,182,242,0.4)]">
              <div className="pointer-events-none absolute -inset-6 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-2xl" />
              <img
                src={flyerAsset.url}
                alt="McCoy Cleaning Products flyer"
                className="relative h-full w-full rounded-[1.4rem] object-cover"
                loading="lazy"
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
                <p className="font-display text-2xl text-white">100+</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-white/60">{isEn ? "Products" : "Producten"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
                <p className="font-display text-2xl text-white">B2B</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-white/60">{isEn ? "Wholesale" : "Groothandel"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
                <p className="font-display text-2xl text-white">24/7</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-white/60">{isEn ? "Support" : "Contact"}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
