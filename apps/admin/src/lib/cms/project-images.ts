/** Public storefront paths available in the prototype CMS image picker. */
export type CmsProjectImage = {
  path: string;
  label: string;
  /** Used to surface relevant picks first per section. */
  tags: string[];
};

export const CMS_PROJECT_IMAGES: CmsProjectImage[] = [
  { path: "/images/cms/logo-mccoy.png", label: "McCoy-logo (standaard)", tags: ["logo", "nav", "brand"] },
  { path: "/images/cms/hero-cleaning.jpg", label: "Hero — schoonmaak", tags: ["hero", "home"] },
  { path: "/images/hero-placeholder.jpg", label: "Hero placeholder", tags: ["hero"] },
  { path: "/images/cms/work-regular.jpg", label: "Werk — regulier (gallery)", tags: ["gallery", "work"] },
  { path: "/images/cms/work-regular-sander.png", label: "Dienst — regulier (Sander)", tags: ["services", "work"] },
  { path: "/images/cms/work-horeca.jpg", label: "Werk — horeca", tags: ["gallery", "services", "work"] },
  { path: "/images/cms/work-oplevering.jpg", label: "Werk — oplevering (gallery)", tags: ["gallery", "work"] },
  { path: "/images/cms/work-oplevering-hal.png", label: "Dienst — oplevering (hal)", tags: ["services", "work"] },
  { path: "/images/cms/work-floor.jpg", label: "Werk — vloeren (gallery)", tags: ["gallery", "work"] },
  { path: "/images/cms/work-floor-scrubber.jpg", label: "Dienst — vloeren (scrubber)", tags: ["services", "work"] },
  { path: "/images/cms/work-furniture.jpg", label: "Werk — meubels", tags: ["gallery", "work"] },
  { path: "/images/cms/work-furniture-bank.jpg", label: "Dienst — meubels (bank)", tags: ["services", "work"] },
  { path: "/images/cms/work-glass.jpg", label: "Werk — glas (gallery)", tags: ["gallery", "work"] },
  { path: "/images/cms/work-glass-van.jpg", label: "Dienst — glas (bus)", tags: ["services", "work"] },
  { path: "/images/cms/about-mission.png", label: "About — missie", tags: ["about"] },
  { path: "/images/cms/about-vision.jpg", label: "About — visie (kerk)", tags: ["about"] },
  { path: "/images/cms/about-vision-alt.png", label: "About — visie (alt) / gallery meubel", tags: ["about", "gallery"] },
  { path: "/images/cms/about-history.jpg", label: "About — historie", tags: ["about"] },
  { path: "/images/cms/products-flyer.png", label: "Products — flyer", tags: ["products", "form"] },
  // Partner logos (public/images/partners)
  { path: "/images/partners/aircrete-europe.png", label: "Partner — Aircrete Europe", tags: ["partners", "logo"] },
  { path: "/images/partners/akom-oldenzaal.png", label: "Partner — Akom Oldenzaal", tags: ["partners", "logo"] },
  { path: "/images/partners/alfa-europe.png", label: "Partner — Alfa Europe", tags: ["partners", "logo"] },
  { path: "/images/partners/benerink.png", label: "Partner — Benerink", tags: ["partners", "logo"] },
  { path: "/images/partners/benitech.png", label: "Partner — Benitech", tags: ["partners", "logo"] },
  { path: "/images/partners/cafe-vanouds.png", label: "Partner — Cafe Vanouds", tags: ["partners", "logo"] },
  { path: "/images/partners/dancing-bruins.png", label: "Partner — Dancing Bruins", tags: ["partners", "logo"] },
  { path: "/images/partners/de-bonte-koe.png", label: "Partner — De Bonte Koe", tags: ["partners", "logo"] },
  { path: "/images/partners/de-dominee-grand-cafe.png", label: "Partner — De Dominee", tags: ["partners", "logo"] },
  { path: "/images/partners/die-grenze.png", label: "Partner — Die Grenze", tags: ["partners", "logo"] },
  { path: "/images/partners/dumeta.png", label: "Partner — Dumeta", tags: ["partners", "logo"] },
  { path: "/images/partners/finbrokers.png", label: "Partner — Finbrokers", tags: ["partners", "logo"] },
  { path: "/images/partners/hortec-electronics.png", label: "Partner — Hortec", tags: ["partners", "logo"] },
  { path: "/images/partners/huka-bikes.png", label: "Partner — Huka Bikes", tags: ["partners", "logo"] },
  { path: "/images/partners/infinity-pharma.png", label: "Partner — Infinity Pharma", tags: ["partners", "logo"] },
  { path: "/images/partners/keizers.png", label: "Partner — Keizers", tags: ["partners", "logo"] },
  { path: "/images/partners/laurens.png", label: "Partner — Laurens", tags: ["partners", "logo"] },
  { path: "/images/partners/nanomi.png", label: "Partner — Nanomi", tags: ["partners", "logo"] },
  { path: "/images/partners/nutsschool.png", label: "Partner — Nutsschool", tags: ["partners", "logo"] },
  { path: "/images/partners/oatmossche.png", label: "Partner — Oatmossche", tags: ["partners", "logo"] },
  { path: "/images/partners/oltc.png", label: "Partner — OLTC", tags: ["partners", "logo"] },
  { path: "/images/partners/platvoet-beveiligingssystemen.png", label: "Partner — Platvoet", tags: ["partners", "logo"] },
  { path: "/images/partners/plaza-fit-healthclub.png", label: "Partner — Plaza Fit", tags: ["partners", "logo"] },
  { path: "/images/partners/quick20-oldenzaal.png", label: "Partner — Quick'20", tags: ["partners", "logo"] },
  { path: "/images/partners/steggink.png", label: "Partner — Steggink", tags: ["partners", "logo"] },
  { path: "/images/partners/tandartspraktijk-brummelhuis.png", label: "Partner — Brummelhuis", tags: ["partners", "logo"] },
  { path: "/images/partners/tante-annies.png", label: "Partner — Tante Annies", tags: ["partners", "logo"] },
  { path: "/images/partners/vehgro.png", label: "Partner — Vehgro", tags: ["partners", "logo"] },
  { path: "/images/partners/vitaal-verder.png", label: "Partner — Vitaal Verder", tags: ["partners", "logo"] },
  { path: "/images/partners/wijco-technics.png", label: "Partner — Wijco Technics", tags: ["partners", "logo"] },
];

/** Admin runs on another port — media lives on the storefront origin. */
export function storefrontOrigin(): string {
  const fromEnv = import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.port === "5174") {
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:5173";
}

export function cmsMediaUrl(src: string, base = storefrontOrigin()): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${base.replace(/\/$/, "")}${path}`;
}

export function sortProjectImagesForContext(
  images: CmsProjectImage[],
  preferTags: string[] = [],
): CmsProjectImage[] {
  if (preferTags.length === 0) return images;
  const score = (img: CmsProjectImage) =>
    preferTags.reduce((n, tag) => n + (img.tags.includes(tag) ? 1 : 0), 0);
  return [...images].sort((a, b) => score(b) - score(a) || a.label.localeCompare(b.label));
}

/** Section-scoped picks first; non-matching catalog kept for optional "show all". */
export function partitionProjectImagesForContext(
  images: CmsProjectImage[],
  preferTags: string[] = [],
): { scoped: CmsProjectImage[]; rest: CmsProjectImage[] } {
  if (preferTags.length === 0) return { scoped: images, rest: [] };
  const matches = (img: CmsProjectImage) => preferTags.some((tag) => img.tags.includes(tag));
  const scoped = sortProjectImagesForContext(images.filter(matches), preferTags);
  const rest = sortProjectImagesForContext(images.filter((img) => !matches(img)), preferTags);
  return { scoped, rest };
}
