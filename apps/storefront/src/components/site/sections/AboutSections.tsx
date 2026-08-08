/**
 * Fixed-section view for Over McCoy (`about.main`).
 * Compatibility path until MG5; migrated about blocks use presentation adapters.
 */

import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";
import {
  Award,
  Target,
  Eye,
  Users,
  ShieldCheck,
  Leaf,
  History,
} from "lucide-react";
import aboutMission from "@/assets/mccoy-mission-before-after.png";
import aboutVisionChurch from "@/assets/mccoy-vision-church.jpg";
import aboutHistory from "@/assets/mccoy-about-history-new.jpg";
import { useMobileLiteMotion } from "@/lib/use-mobile-lite-motion";
import { useI18n } from "@/lib/i18n";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { CompositePartSelectChrome } from "../PageLayoutRenderer";
import { localizedAboutCopy } from "@/lib/cms-i18n";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer";

function isCmsPlaceholderSrc(src: string | undefined): boolean {
  return !src || src.includes("placeholder");
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

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
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.4, 0.7, 1], soft ? [0.35, 0.35, 0.35, 0.35] : [0.95, 0.1, 0.1, 0.6]);
  const textY = useTransform(scrollYProgress, [0, 1], soft ? [0, 0] : [80, -40]);
  const tagRotate = useTransform(scrollYProgress, [0, 1], soft ? [0, 0] : [-12, 12]);
  const reverse = index % 2 === 1;
  return (
    <div
      ref={ref}
      className={`grid items-center gap-8 lg:grid-cols-12 lg:gap-14 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      {/* Image */}
      <motion.div
        initial={soft ? false : { opacity: 0, x: reverse ? 28 : -28 }}
        whileInView={{ opacity: 1, x: 0 }}
        // No negative rootMargin — inset margins keep first-screen blocks at
        // opacity:0 after SPA navigations until the user scrolls.
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: soft ? 0 : 0.55, ease: [0.83, 0, 0.17, 1] }}
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
              style={
                soft
                  ? { objectPosition: objectPosition ?? "center" }
                  : { y: imgY, scale: imgScale, objectPosition: objectPosition ?? "center" }
              }
              className={`absolute inset-0 h-full w-full object-cover${soft ? "" : " will-change-transform"}`}
            />
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

      {/* Text */}
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
            <span className="font-display text-sm uppercase tracking-[0.3em] text-primary/80">{tag}</span>
          </div>
          <h3 className="font-display mt-5 text-4xl text-white md:text-5xl lg:text-6xl">{title}</h3>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-white/75">
            {body.split("\n\n").map((p, idx) => (
              <p key={idx} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export function About() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_about", "about.main");
  const isEn = lang === "en";
  const copy = localizedAboutCopy(content, t);
  const eyebrow = copy.eyebrow;
  const heading = copy.heading;
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
      <div className={SECTION_PAGE_RAIL}>
        {/* Header */}
        <CompositePartSelectChrome sectionKey="about.main" part="header" label="Kop">
        <div className="grid gap-10 lg:grid-cols-12">
          <motion.div
            variants={fadeUp}
            // Paint heading immediately on route enter (no blank SPA flash).
            initial={false}
            className="lg:col-span-7"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="font-display mt-4 text-4xl text-white md:text-5xl lg:text-6xl">{heading}</h1>
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
        </CompositePartSelectChrome>

        {/* Scroll-driven pillars with imagery */}
        <div className="mt-20 space-y-24 sm:space-y-32">
          {[
            {
              part: "mission" as const,
              title: copy.missionTitle,
              body: copy.missionBody,
              Icon: Target,
              img:
                content.missionImage && !isCmsPlaceholderSrc(content.missionImage.src)
                  ? content.missionImage.src
                  : content.image && !isCmsPlaceholderSrc(content.image.src)
                    ? content.image.src
                    : aboutMission,
              tag: "01",
              aspectClassName: "aspect-[16/9]",
              scaleValues: [1.05, 1, 1.05] as [number, number, number],
            },
            {
              part: "vision" as const,
              title: copy.visionTitle,
              body: copy.visionBody,
              Icon: Eye,
              img:
                content.visionImage && !isCmsPlaceholderSrc(content.visionImage.src)
                  ? content.visionImage.src
                  : aboutVisionChurch,
              tag: "02",
            },
            {
              part: "history" as const,
              title: copy.historyTitle,
              body: copy.historyBody,
              Icon: History,
              img:
                content.historyImage && !isCmsPlaceholderSrc(content.historyImage.src)
                  ? content.historyImage.src
                  : aboutHistory,
              tag: "03",
              objectPosition: "center 20%",
            },
          ].map((b, i) => (
            <CompositePartSelectChrome
              key={b.part}
              sectionKey="about.main"
              part={b.part}
              label={b.title}
            >
              <PillarRow
                index={i}
                title={b.title}
                body={b.body}
                Icon={b.Icon}
                img={b.img}
                tag={b.tag}
                aspectClassName={"aspectClassName" in b ? b.aspectClassName : undefined}
                scaleValues={"scaleValues" in b ? b.scaleValues : undefined}
                objectPosition={"objectPosition" in b ? b.objectPosition : undefined}
              />
            </CompositePartSelectChrome>
          ))}
        </div>
      </div>
    </section>
  );
}
