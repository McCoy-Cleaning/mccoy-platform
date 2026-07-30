import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Sparkles,
  Wind,
  UtensilsCrossed,
  Hammer,
  Sofa,
  GlassWater,
  Building2,
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
import { ProductsAssortmentView, ProductsIntroView } from "./ProductsBlockViews";
import wHoreca from "@/assets/work-horeca-new.jpg";
import wRegular from "@/assets/work-regular.jpg";
import serviceGlass from "@/assets/mccoy-service-glass-van.jpg";
import aboutMission from "@/assets/mccoy-mission-before-after.png";
import aboutVisionChurch from "@/assets/mccoy-vision-church.jpg";
import aboutHistory from "@/assets/mccoy-about-history-new.jpg";
import svcRegular from "@/assets/mccoy-regular-sander.png";
import svcOplevering from "@/assets/mccoy-oplevering-hal.png";
import svcFloor from "@/assets/mccoy-floor-scrubber.jpg";
import svcFurniture from "@/assets/mccoy-furniture-bank.jpg";
import { useMobileLiteMotion } from "@/lib/use-mobile-lite-motion";
import { useI18n } from "@/lib/i18n";
import { CmsLinkAnchor } from "../CmsLinkAnchor";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { CompositePartSelectChrome } from "../PageLayoutRenderer";
import {
  localizedAboutCopy,
  localizedServicesCopy,
} from "@/lib/cms-i18n";
import { cmsTextOrFallback, defaultSectionContent } from "@mccoy/cms-schema";
import {
  CmsImageView,
  SECTION_PAGE_RAIL,
  SectionAmbient,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

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


/* ============= SERVICES ============= */
const serviceIcons = [Wind, UtensilsCrossed, Hammer, Building2, Sofa, GlassWater];
/** Exact order from the legacy Sections.tsx */
const serviceImages = [
  svcRegular,
  wHoreca,
  svcOplevering,
  svcFloor,
  svcFurniture,
  serviceGlass,
];

export function Services() {
  const { t } = useI18n();
  const content = useTypedSectionContent("page_services", "services.main");
  const [open, setOpen] = useState<number | null>(null);
  const localized = localizedServicesCopy(content, t);
  const eyebrow = localized.eyebrow;
  const heading = localized.heading;
  const intro = localized.intro;
  const cards = localized.cards.map((card, i) => {
        const i18nItem = t.work.items[i];
        const usedFallback = isCmsPlaceholderSrc(card.image.src);
        const imageSrc = usedFallback
          ? serviceImages[i] || wRegular
          : card.image.src;
        const link = card.link;
        const ctaLabel = link
          ? link.type === "internal_route" && link.route === "offerte"
            ? t.services.quoteCta
            : t.services.contactCta
          : undefined;
        return {
          id: card.id,
          title: card.title,
          desc: card.description,
          full: i18nItem?.full ?? (card.description ? [card.description] : []),
          imageSrc,
          link,
          ctaLabel,
          Icon: serviceIcons[i] ?? Wind,
        };
      });

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
    <section id="services" className="relative isolate overflow-hidden py-20 sm:py-24">
      <SectionAmbient />
      <div className={cn("relative", SECTION_PAGE_RAIL)}>
        <CompositePartSelectChrome sectionKey="services.main" part="header" label="Intro">
        <div className="max-w-2xl">
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h1 className="font-display mt-4 text-4xl text-foreground md:text-5xl">{heading}</h1>
          {intro ? <p className="mt-4 text-muted-foreground">{intro}</p> : null}
        </div>
        </CompositePartSelectChrome>

        <CompositePartSelectChrome sectionKey="services.main" part="cards" label="Dienstkaarten">
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.Icon;
            return (
              <SectionSurface
                key={card.id}
                variant="media"
                className="group relative transition hover:border-primary/40"
              >
              <article>
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={card.imageSrc}
                    alt={card.title}
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
                  <h3 className="font-display text-2xl text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground/80 transition hover:border-primary/40 hover:text-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t.services.readMore}
                    </button>
                    {card.link && card.ctaLabel ? (
                      <CmsLinkAnchor
                        link={card.link}
                        fallbackHref="/contact"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition group-hover:gap-2.5"
                      >
                        {card.ctaLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </CmsLinkAnchor>
                    ) : null}
                  </div>
                </div>
              </article>
              </SectionSurface>
            );
          })}
        </div>
        </CompositePartSelectChrome>
      </div>

      {/* Modal */}
      {typeof document !== "undefined" &&
        createPortal(
          open !== null
            ? (() => {
                const card = cards[open];
                if (!card) return null;
                const Icon = card.Icon;
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
                          src={card.imageSrc}
                          alt={card.title}
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
                          {eyebrow}
                        </motion.p>
                        <motion.h3
                          id="service-modal-title"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.28, duration: 0.5 }}
                          className="font-display mt-2 text-2xl text-white sm:mt-3 sm:text-3xl md:text-4xl"
                        >
                          {card.title}
                        </motion.h3>
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          className="mt-4 h-0.5 w-16 origin-left rounded-full bg-primary"
                        />
                        <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/75 sm:mt-6 sm:space-y-4 sm:text-[15px]">
                          {card.full.map((p, idx) => (
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
                        {card.link && card.ctaLabel ? (
                          <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7, duration: 0.5 }}
                            className="mt-6 sm:mt-8"
                            onClick={() => setOpen(null)}
                          >
                            <CmsLinkAnchor
                              link={card.link}
                              fallbackHref="/contact"
                              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03] sm:px-6"
                            >
                              {card.ctaLabel} <ArrowRight className="h-4 w-4" />
                            </CmsLinkAnchor>
                          </motion.div>
                        ) : null}
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
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: soft ? 0 : 0.85, ease: [0.83, 0, 0.17, 1] }}
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
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: soft ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
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
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
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

/* ============= PRODUCTS ============= */
export function ProductsMain() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_products", "products.main");
  const isEn = lang === "en";
  const productsDef = defaultSectionContent("products.main") as import("@mccoy/cms-schema").ProductsMainContent;

  const eyebrow = cmsTextOrFallback(content.eyebrow, t.products.kicker, productsDef.eyebrow);
  const headingFallback = isEn
    ? "Fragrance products with a premium sanitary experience."
    : productsDef.heading;
  const heading = cmsTextOrFallback(content.heading, headingFallback, productsDef.heading);
  const introFallback = isEn
    ? "An important part of McCoy Cleaning is McCoy Products, our wholesale division. In our range you will find: hygiene paper, professional soaps, cleaning agents for hospitality, and equipment and hardware for cleaning.\n\nTo obtain our products, you can call or contact us via the contact form; we will be happy to help you."
    : productsDef.intro;
  // Empty CMS intro must stay empty — do not rehydrate factory/fallback copy.
  const intro =
    content.intro == null || content.intro === ""
      ? ""
      : cmsTextOrFallback(content.intro, introFallback, productsDef.intro);
  const noticeFallback = isEn
    ? "We are currently busy behind the scenes with the online webshop! Coming soon."
    : productsDef.body ?? "";
  const notice =
    content.body == null || content.body === ""
      ? ""
      : cmsTextOrFallback(content.body, noticeFallback, productsDef.body);
  const image = content.image ?? productsDef.image;

  return (
    <ProductsIntroView
      eyebrow={eyebrow}
      heading={heading}
      intro={intro}
      notice={notice}
      image={image}
      ctaLabel={t.products.cta}
      isEn={isEn}
    />
  );
}

/** Assortment cards — icon + text; movable above/below Intro. */
export function ProductsInfo() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_products", "products.info");
  const productsInfoDef = defaultSectionContent("products.info") as import("@mccoy/cms-schema").ProductsInfoContent;
  const isEn = lang === "en";
  const eyebrow =
    content.eyebrow == null || content.eyebrow === ""
      ? ""
      : cmsTextOrFallback(
          content.eyebrow,
          isEn ? "Our range" : productsInfoDef.eyebrow,
          productsInfoDef.eyebrow,
        );
  const heading =
    content.heading == null || content.heading === ""
      ? ""
      : cmsTextOrFallback(content.heading, t.products.title, productsInfoDef.heading);
  const intro =
    content.intro == null || content.intro === ""
      ? ""
      : cmsTextOrFallback(
          content.intro,
          isEn
            ? "Hygiene paper, professional soaps, cleaning agents and hardware for a fresh, presentable environment."
            : productsInfoDef.intro,
          productsInfoDef.intro,
        );

  const cardEn: Record<string, { title: string; body: string }> = {
    prod_hygiene: {
      title: "Hygiene paper",
      body: "Professional hygiene paper for washrooms, kitchens and commercial buildings.",
    },
    prod_soaps: {
      title: "Professional soaps",
      body: "High-quality soaps and dispensers for a fresh, presentable sanitary space.",
    },
    prod_agents: {
      title: "Cleaning agents & hardware",
      body: "Cleaning agents for hospitality plus equipment and hardware for cleaning.",
    },
  };

  return (
    <ProductsAssortmentView
      eyebrow={eyebrow}
      heading={heading}
      intro={intro}
      ctaLabel={t.products.cta}
      cards={content.cards.map((card) => {
        const factory = productsInfoDef.cards.find((c) => c.id === card.id);
        const en = cardEn[card.id];
        return {
          id: card.id,
          title: cmsTextOrFallback(
            card.title,
            isEn && en ? en.title : card.title,
            factory?.title,
          ),
          description: cmsTextOrFallback(
            card.description ?? "",
            isEn && en ? en.body : card.description ?? "",
            factory?.description,
          ),
          link: card.link,
        };
      })}
    />
  );
}

/** @deprecated Prefer ProductsMain + ProductsInfo. */
export function Products() {
  return (
    <>
      <ProductsMain />
      <ProductsInfo />
    </>
  );
}
