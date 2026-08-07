/**
 * Over ons reusable block presentations — exact parity with the former fixed About().
 */
import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { Award, Eye, History, Leaf, ShieldCheck, Target, Users } from "lucide-react";
import type { CmsButton, CmsImage } from "@mccoy/cms-schema";
import { isCmsButtonInteractive } from "@mccoy/cms-schema";
import { CmsButtonView, CmsImageView, SECTION_PAGE_RAIL } from "@mccoy/cms-renderer";
import { useMobileLiteMotion } from "@/lib/use-mobile-lite-motion";

const PILLAR_ICONS: Record<string, typeof Award> = {
  award: Award,
  shield: ShieldCheck,
  users: Users,
  leaf: Leaf,
  target: Target,
  eye: Eye,
  history: History,
};

export type AboutIntroPillarView = {
  id: string;
  icon: string;
  label: string;
};

export function AboutIntroView({
  eyebrow,
  heading,
  pillars,
  cta,
}: {
  eyebrow: string;
  heading: string;
  pillars: AboutIntroPillarView[];
  /** Optional Over ons knop — same CmsButton model as other CTA sections. */
  cta?: CmsButton | null;
}) {
  const showCta = cta && isCmsButtonInteractive(cta);
  return (
    <section id="about" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className={SECTION_PAGE_RAIL}>
        <div className="grid gap-10 lg:grid-cols-12">
          <motion.div variants={undefined} initial={false} className="lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="font-display mt-4 text-4xl text-white md:text-5xl lg:text-6xl">
              {heading}
            </h1>
            {showCta ? (
              <div className="mt-8">
                <CmsButtonView
                  button={cta}
                  className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  {cta.label}
                </CmsButtonView>
              </div>
            ) : null}
          </motion.div>

          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            {pillars.map((p) => {
              const Icon = PILLAR_ICONS[p.icon] ?? Award;
              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-card/60 p-4 transition hover:border-primary/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-white/85">{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

type PillarRowProps = {
  title: string;
  body: string;
  iconKey: string;
  image?: CmsImage | null;
  imageSrcFallback?: string;
  tag: string;
  index: number;
  objectPosition?: string;
  aspectClassName?: string;
  scaleValues?: [number, number, number];
};

export function AboutPillarRowView({
  title,
  body,
  iconKey,
  image,
  imageSrcFallback,
  tag,
  index,
  objectPosition,
  aspectClassName = "aspect-[5/4]",
  scaleValues,
}: PillarRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const mobileLite = useMobileLiteMotion();
  const soft = Boolean(reduced) || mobileLite;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const imgY = useTransform(scrollYProgress, [0, 1], soft ? ["0%", "0%"] : ["-18%", "18%"]);
  const defaultScale: [number, number, number] = [1.35, 1.15, 1.4];
  const activeScale = scaleValues ?? defaultScale;
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], soft ? [1, 1, 1] : activeScale);
  const overlayOpacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    soft ? [0.35, 0.35, 0.35, 0.35] : [0.95, 0.1, 0.1, 0.6],
  );
  const textY = useTransform(scrollYProgress, [0, 1], soft ? [0, 0] : [80, -40]);
  const tagRotate = useTransform(scrollYProgress, [0, 1], soft ? [0, 0] : [-12, 12]);
  const reverse = index % 2 === 1;
  const Icon = PILLAR_ICONS[iconKey] ?? Target;
  const imgSrc =
    image && typeof image.src === "string" && image.src.trim() ? image.src : imageSrcFallback;

  return (
    <section className={SECTION_PAGE_RAIL + " py-12 sm:py-16"}>
      <div
        ref={ref}
        className={`grid items-center gap-8 lg:grid-cols-12 lg:gap-14 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
      >
        <motion.div
          initial={soft ? false : { opacity: 0, x: reverse ? 28 : -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: soft ? 0 : 0.55, ease: [0.83, 0, 0.17, 1] }}
          className="relative lg:col-span-6"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_80px_-30px_rgba(63,182,242,0.45)]">
            <div className={`relative ${aspectClassName} w-full overflow-hidden`}>
              {image && !imageSrcFallback ? (
                <motion.div
                  style={
                    soft
                      ? { objectPosition: objectPosition ?? "center" }
                      : { y: imgY, scale: imgScale, objectPosition: objectPosition ?? "center" }
                  }
                  className={`absolute inset-0 h-full w-full${soft ? "" : " will-change-transform"}`}
                >
                  <CmsImageView image={image} className="h-full w-full object-cover" />
                </motion.div>
              ) : imgSrc ? (
                <motion.img
                  src={imgSrc}
                  alt={title}
                  width={1280}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  style={
                    soft
                      ? { objectPosition: objectPosition ?? "center" }
                      : { y: imgY, scale: imgScale, objectPosition: objectPosition ?? "center" }
                  }
                  className={`absolute inset-0 h-full w-full object-cover${soft ? "" : " will-change-transform"}`}
                />
              ) : (
                <div className="absolute inset-0 bg-card/40" aria-hidden />
              )}
              <motion.div
                style={soft ? undefined : { opacity: overlayOpacity }}
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent"
              />
            </div>
            <motion.div
              style={soft ? undefined : { rotate: tagRotate }}
              className="absolute -right-4 -top-4 flex h-20 w-20 items-center justify-center rounded-full border border-primary/40 bg-background/70 font-display text-2xl text-primary shadow-[0_10px_40px_-10px_rgba(63,182,242,0.6)] backdrop-blur"
            >
              {tag}
            </motion.div>
          </div>
          <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-primary/10 blur-3xl" />
        </motion.div>

        <motion.div style={soft ? undefined : { y: textY }} className="lg:col-span-6">
          <motion.div
            initial={soft ? false : { opacity: 0, x: reverse ? -60 : 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: soft ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/40">
                <Icon className="h-6 w-6" />
              </div>
              <span className="font-display text-sm uppercase tracking-[0.3em] text-primary/80">
                {tag}
              </span>
            </div>
            <h3 className="font-display mt-5 text-4xl text-white md:text-5xl lg:text-6xl">
              {title}
            </h3>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-white/75">
              {body.split("\n\n").map((p, idx) => (
                <p key={idx} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
