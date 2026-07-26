import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
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
  Phone,
  Droplets,
  Package,
  SprayCan,
  Wrench,
} from "lucide-react";
import wHoreca from "@/assets/work-horeca-new.jpg";
import wRegular from "@/assets/work-regular.jpg";
import flyerUrl from "@/assets/mccoy-products-flyer.jpg";
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
    <section id="services" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <CompositePartSelectChrome sectionKey="services.main" part="header" label="Intro">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h1 className="font-display mt-4 text-4xl text-white md:text-5xl">{heading}</h1>
          {intro ? <p className="mt-4 text-white/65">{intro}</p> : null}
        </div>
        </CompositePartSelectChrome>

        <CompositePartSelectChrome sectionKey="services.main" part="cards" label="Dienstkaarten">
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.Icon;
            return (
              <article
                key={card.id}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-card/70 transition hover:border-primary/40"
              >
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
                  <h3 className="font-display text-2xl text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">{card.desc}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 transition hover:border-primary/40 hover:text-white"
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
export function Products() {
  const { t, lang } = useI18n();
  const content = useTypedSectionContent("page_products", "products.main");
  const isEn = lang === "en";
  const reduced = useReducedMotion();
  const productsDef = defaultSectionContent("products.main") as {
    eyebrow?: string;
    heading?: string;
    intro?: string;
  };

  const eyebrow = cmsTextOrFallback(content.eyebrow, t.products.kicker, productsDef.eyebrow);
  const headingFallback = isEn
    ? "Fragrance products with a premium sanitary experience."
    : "Geurproducten met een premium sanitaire beleving.";
  const heading = cmsTextOrFallback(content.heading, headingFallback, productsDef.heading);
  const introFallback = isEn
    ? "An important part of McCoy Cleaning is McCoy Products, our wholesale division. In our range you will find: hygiene paper, professional soaps, cleaning agents for hospitality, and equipment and hardware for cleaning."
    : "Een belangrijk onderdeel van McCoy Cleaning is McCoy Products, onze groothandel. In ons assortiment vind je: hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en apparatuur en hardware om schoon te maken.";
  const intro = cmsTextOrFallback(content.intro, introFallback, productsDef.intro);

  const range = isEn
    ? [
        { Icon: Package, label: "Hygiene paper" },
        { Icon: Droplets, label: "Professional soaps" },
        { Icon: SprayCan, label: "Hospitality cleaning agents" },
        { Icon: Wrench, label: "Equipment & hardware" },
      ]
    : [
        { Icon: Package, label: "Hygiëne papier" },
        { Icon: Droplets, label: "Professionele zepen" },
        { Icon: SprayCan, label: "Reinigingsmiddelen voor horeca" },
        { Icon: Wrench, label: "Apparatuur & hardware" },
      ];

  const metrics = [
    { value: "100+", label: isEn ? "Products" : "Producten" },
    { value: "B2B", label: isEn ? "Wholesale" : "Groothandel" },
    { value: "24/7", label: isEn ? "Support" : "Contact" },
  ];

  return (
    <section id="products" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/8 via-transparent to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero composition: copy + flyer */}
        <CompositePartSelectChrome sectionKey="products.main" part="header" label="Intro">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <motion.div
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true }}
            className="lg:col-span-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="font-display mt-4 max-w-xl text-4xl leading-[1.08] text-white md:text-5xl lg:text-6xl">
              {heading}
            </h1>
            <div className="mt-5 h-0.5 w-14 rounded-full bg-primary" aria-hidden />

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-[17px]">
              {intro}
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70 md:text-[17px]">
              {isEn
                ? "To obtain our products, you can call or contact us via the contact form; we will be happy to help you."
                : "Voor het verkrijgen van onze producten kunt u bellen of contact op nemen via het contactformulier, we helpen u dan graag."}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden />
                {t.products.cta}
              </Link>
              <a
                href="tel:+31541534982"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-transparent px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-primary/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Phone className="h-4 w-4 text-primary" aria-hidden />
                0541 534 982
              </a>
            </div>

            <aside
              className="mt-10 flex gap-3 border-l-2 border-primary/60 pl-5"
              aria-label={isEn ? "Webshop notice" : "Webshop melding"}
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p className="text-sm leading-relaxed text-white/80">
                {isEn
                  ? "We are currently busy behind the scenes with the online webshop! Coming soon."
                  : "We zijn momenteel druk achter de schermen met de online webshop! Deze volgt binnenkort."}
              </p>
            </aside>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial={reduced ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true }}
            transition={reduced ? undefined : { delay: 0.12 }}
            className="lg:col-span-6"
          >
            <figure className="relative">
              <div
                className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/15 blur-3xl"
                aria-hidden
              />
              <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/40">
                <img
                  src={flyerUrl}
                  alt="McCoy Cleaning Products flyer"
                  width={720}
                  height={960}
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full object-cover"
                />
              </div>
              <figcaption className="sr-only">
                {heading}
              </figcaption>
            </figure>

            <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {metrics.map((m) => (
                <div key={m.value} className="bg-card/80 px-3 py-4 text-center sm:px-4 sm:py-5">
                  <dd className="font-display text-xl text-white sm:text-2xl">{m.value}</dd>
                  <dt className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/55 sm:text-xs">
                    {m.label}
                  </dt>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
        </CompositePartSelectChrome>

        {/* Assortment — structured from existing range copy */}
        <CompositePartSelectChrome sectionKey="products.main" part="cards" label="Productkaarten">
        <motion.div
          variants={fadeUp}
          initial={reduced ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true }}
          className="mt-20 sm:mt-24"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {isEn ? "Our range" : "Ons assortiment"}
              </p>
              <h2 className="font-display mt-2 text-2xl text-white md:text-3xl">
                {t.products.title}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-white/60">{t.products.desc}</p>
          </div>

          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {content.cards.map((card, i) => {
              const fallback = range[i];
              const item = {
                id: card.id,
                label: card.title || fallback?.label || "",
                description: card.description,
                link: card.link,
                Icon: fallback?.Icon ?? Package,
              };
              return (
              <li key={item.id}>
                <motion.div
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={reduced ? { duration: 0 } : { delay: 0.06 * i, duration: 0.4 }}
                  className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-white/10 bg-card/50 px-5 py-5 transition hover:border-primary/35"
                >
                  <div className="flex w-full items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <item.Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 pt-1">
                      <span className="text-sm font-semibold leading-snug text-white/90">{item.label}</span>
                      {item.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-white/55">{item.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {item.link ? (
                    <CmsLinkAnchor
                      link={item.link}
                      fallbackHref="/contact"
                      className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary transition group-hover:gap-2.5"
                    >
                      {t.products.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </CmsLinkAnchor>
                  ) : null}
                </motion.div>
              </li>
            );
            })}
          </ul>
        </motion.div>
        </CompositePartSelectChrome>
      </div>
    </section>
  );
}
