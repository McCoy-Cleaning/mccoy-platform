import {
  cmsTextOrFallback,
  defaultSectionContent,
  defaultSiteNavigation,
  type CmsLink,
  type FormPageChromeContent,
  type HomeHeroContent,
  type ServicesMainContent,
  type StatsContent,
  type WorkGalleryContent,
} from "@mccoy/cms-schema";
import type { useI18n } from "@/lib/i18n";

type I18nDict = ReturnType<typeof useI18n>["t"];

function linkKey(link: CmsLink): string {
  if (link.type === "internal_route") return `route:${link.route}`;
  if (link.type === "internal") return `page:${link.pageId}`;
  if (link.type === "external") return `ext:${link.url}`;
  if (link.type === "email") return `mailto:${link.email}`;
  if (link.type === "phone") return `tel:${link.phone}`;
  return "none";
}

/** Nav / CTA labels: factory Dutch defaults follow the active locale; custom labels stay. */
export function localizedNavLabel(cmsLabel: string, link: CmsLink, t: I18nDict): string {
  const def = defaultSiteNavigation();
  const byRoute: Record<string, string> = {
    "route:home": t.nav.home,
    "route:services": t.nav.services,
    "route:products": t.nav.products,
    "route:about": t.nav.about,
    "route:contact": t.nav.contact,
    "route:vacatures": t.nav.jobs,
    "route:offerte": t.nav.cta,
    "route:work": t.nav.work,
  };

  for (const item of def.links) {
    if (linkKey(item.link) === linkKey(link) && cmsLabel === item.label) {
      return byRoute[linkKey(link)] ?? cmsLabel;
    }
  }
  if (
    def.jobsCta &&
    linkKey(def.jobsCta.link) === linkKey(link) &&
    cmsLabel === def.jobsCta.label
  ) {
    return t.nav.jobs;
  }
  if (
    def.quoteCta &&
    linkKey(def.quoteCta.link) === linkKey(link) &&
    cmsLabel === def.quoteCta.label
  ) {
    return t.nav.cta;
  }
  return cmsLabel;
}

export function localizedHeroCopy(content: HomeHeroContent, t: I18nDict) {
  const def = defaultSectionContent("home.hero") as HomeHeroContent;
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, t.hero.kicker, def.eyebrow),
    heading: cmsTextOrFallback(content.heading, t.hero.title, def.heading),
    headingAccent: cmsTextOrFallback(content.headingAccent, t.hero.titleAccent, def.headingAccent),
    body: cmsTextOrFallback(content.body, t.hero.sub, def.body),
    primaryCtaLabel: content.primaryCta
      ? cmsTextOrFallback(content.primaryCta.label, t.hero.ctaPrimary, undefined)
      : undefined,
    secondaryCtaLabel: content.secondaryCta
      ? cmsTextOrFallback(content.secondaryCta.label, t.hero.ctaSecondary, def.secondaryCta?.label)
      : undefined,
  };
}

export function localizedStatsCopy(content: StatsContent, t: I18nDict) {
  const def = defaultSectionContent("home.stats") as StatsContent;
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, t.stats.kicker, def.eyebrow),
    body: cmsTextOrFallback(content.body, t.stats.sub, def.body),
    /** Empty when unset — Stats renders the accented i18n title. */
    heading: content.heading?.trim() ? content.heading : "",
    items: content.items.map((item, i) => ({
      ...item,
      label: cmsTextOrFallback(
        item.label,
        t.stats.items[i]?.label ?? item.label,
        def.items[i]?.label,
      ),
    })),
  };
}

export function localizedServicesCopy(content: ServicesMainContent, t: I18nDict) {
  const def = defaultSectionContent("services.main") as ServicesMainContent;
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, t.services.kicker, def.eyebrow),
    heading: cmsTextOrFallback(content.heading, t.services.title, def.heading),
    // No bilingual catalog for intro — keep CMS value (may stay NL until bilingual CMS).
    intro: content.intro,
    cards: content.cards.map((card, i) => {
      const i18nItem = t.work.items[i];
      const defCard = def.cards[i];
      return {
        ...card,
        title: cmsTextOrFallback(card.title, i18nItem?.title ?? card.title, defCard?.title),
        description: cmsTextOrFallback(
          card.description,
          i18nItem?.desc ?? card.description,
          defCard?.description,
        ),
      };
    }),
  };
}

export function localizedAboutCopy(
  content: {
    eyebrow?: string;
    heading?: string;
    missionTitle?: string;
    missionBody?: string;
    visionTitle?: string;
    visionBody?: string;
    historyTitle?: string;
    historyBody?: string;
  },
  t: I18nDict,
) {
  const def = defaultSectionContent("about.main") as typeof content & {
    eyebrow?: string;
    heading?: string;
    missionTitle?: string;
    missionBody?: string;
    visionTitle?: string;
    visionBody?: string;
    historyTitle?: string;
    historyBody?: string;
  };
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, t.about.kicker, def.eyebrow),
    heading: cmsTextOrFallback(content.heading, t.about.title, def.heading),
    missionTitle: cmsTextOrFallback(content.missionTitle, t.about.missionTitle, def.missionTitle),
    missionBody: cmsTextOrFallback(content.missionBody, t.about.mission, def.missionBody),
    visionTitle: cmsTextOrFallback(content.visionTitle, t.about.visionTitle, def.visionTitle),
    visionBody: cmsTextOrFallback(content.visionBody, t.about.vision, def.visionBody),
    historyTitle: cmsTextOrFallback(content.historyTitle, t.about.historyTitle, def.historyTitle),
    historyBody: cmsTextOrFallback(content.historyBody, t.about.history, def.historyBody),
  };
}

export function localizedWorkGalleryCopy(content: WorkGalleryContent, t: I18nDict) {
  const def = defaultSectionContent("home.workGallery") as WorkGalleryContent;
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, t.work.kicker, def.eyebrow),
    heading: cmsTextOrFallback(content.heading, t.work.title, def.heading),
    body: cmsTextOrFallback(content.body, t.work.sub, def.body),
    items: content.items.map((item, i) => ({
      ...item,
      title: cmsTextOrFallback(
        item.title,
        t.work.items[i]?.title ?? item.title,
        def.items[i]?.title,
      ),
    })),
  };
}

export function localizedPartnersCopy(
  content: { eyebrow?: string; heading?: string },
  t: I18nDict,
) {
  const def = defaultSectionContent("home.partners") as { eyebrow?: string; heading?: string };
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, t.partners.kicker, def.eyebrow),
    heading: cmsTextOrFallback(content.heading, t.partners.title, def.heading),
  };
}

export function localizedFormChromeCopy(
  sectionKey: "contact.main" | "vacatures.main" | "offerte.main",
  content: FormPageChromeContent,
  t: I18nDict,
  lang: "nl" | "en",
) {
  const def = defaultSectionContent(sectionKey) as FormPageChromeContent;
  const catalogs = {
    "contact.main": {
      eyebrow: t.contact.kicker,
      heading: t.contact.title,
      body: t.contact.sub,
    },
    "vacatures.main": {
      eyebrow: t.jobs.kicker,
      heading: t.jobs.title,
      body: t.jobs.sub,
    },
    "offerte.main": {
      eyebrow: lang === "en" ? "Quote" : "Offerte",
      heading: t.nav.cta,
      body: lang === "en" ? "Tell us what you need." : "Vertel ons wat u nodig heeft.",
    },
  } as const;
  const cat = catalogs[sectionKey];
  return {
    eyebrow: cmsTextOrFallback(content.eyebrow, cat.eyebrow, def.eyebrow),
    heading: cmsTextOrFallback(content.heading, cat.heading, def.heading),
    body: content.body ? cmsTextOrFallback(content.body, cat.body, def.body) : undefined,
  };
}
