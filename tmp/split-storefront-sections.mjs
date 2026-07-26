/**
 * Split current Sections.tsx into HomeSections + SitePageSections (CRLF-safe).
 * Keeps a full Sections.tsx barrel afterward.
 */
import fs from "node:fs";

const sectionsPath = "apps/storefront/src/components/site/Sections.tsx";
const homePath = "apps/storefront/src/components/site/sections/HomeSections.tsx";
const sitePath = "apps/storefront/src/components/site/sections/SitePageSections.tsx";

fs.mkdirSync("apps/storefront/src/components/site/sections", { recursive: true });
fs.copyFileSync(sectionsPath, "tmp/Sections.pre-split.tsx");

const src = fs.readFileSync(sectionsPath, "utf8").replace(/\r\n/g, "\n");

function must(needle) {
  const i = src.indexOf(needle);
  if (i < 0) throw new Error(`missing ${needle}`);
  return i;
}

const heroStart = must("/* ============= HERO ============= */");
const statsStart = must("/* ============= STATS ============= */");
const servicesStart = must("/* ============= SERVICES ============= */");
const aboutStart = must("/* ============= ABOUT ============= */");
const workStart = must("/* ============= WORK GALLERY ============= */");
const productsStart = must("/* ============= PRODUCTS ============= */");

const preamble = src.slice(0, heroStart);
const hero = src.slice(heroStart, statsStart);
const stats = src.slice(statsStart, servicesStart);
const services = src.slice(servicesStart, aboutStart);
const about = src.slice(aboutStart, workStart);
const work = src.slice(workStart, productsStart);
const products = src.slice(productsStart);

function rel(code) {
  return code
    .replaceAll('from "./DeliveryImage"', 'from "../DeliveryImage"')
    .replaceAll('from "./CountUp"', 'from "../CountUp"')
    .replaceAll('from "./CmsLinkAnchor"', 'from "../CmsLinkAnchor"')
    .replaceAll('from "./PageLayoutRenderer"', 'from "../PageLayoutRenderer"');
}

function drop(code, lines) {
  let out = code;
  for (const line of lines) out = out.split(`${line}\n`).join("");
  return out;
}

let home = rel(preamble + hero + stats + work);
home = drop(home, [
  'import { createPortal } from "react-dom";',
  'import { Link } from "@tanstack/react-router";',
  'import wHoreca from "@/assets/work-horeca-new.jpg";',
  'import wRegular from "@/assets/work-regular.jpg";',
  'import flyerUrl from "@/assets/mccoy-products-flyer.webp";',
  'import serviceGlassAsset from "@/assets/mccoy-service-glass-van.jpg.asset.json";',
  'import aboutMission from "@/assets/mccoy-mission-before-after.png";',
  'import aboutVision from "@/assets/mccoy-about-vision.webp";',
  'import aboutVisionChurch from "@/assets/mccoy-vision-church.jpg";',
  'import aboutHistory from "@/assets/mccoy-about-history-new.jpg";',
  'import svcRegularAsset from "@/assets/mccoy-regular-sander.png.asset.json";',
  'import svcOpleveringAsset from "@/assets/mccoy-oplevering-hal.png.asset.json";',
  'import svcFloorAsset from "@/assets/mccoy-floor-scrubber.jpg.asset.json";',
  'import svcFurnitureAsset from "@/assets/mccoy-furniture-bank.jpg.asset.json";',
  'import { cmsTextOrFallback, defaultSectionContent } from "@mccoy/cms-schema";',
  'import { CompositePartSelectChrome } from "../PageLayoutRenderer";',
]);
home = home.replace(
  /import \{[\s\S]*?\} from "lucide-react";/,
  `import {
  Sparkles,
  CheckCircle2,
  Award,
  ShieldCheck,
} from "lucide-react";`,
);
home = home.replace("useScroll, useTransform, ", "");
home = home.replace(
  'import { useEffect, useRef, useState } from "react";',
  'import { useEffect, useState } from "react";',
);
home = home.replace(
  `localizedAboutCopy,
  localizedHeroCopy,
  localizedServicesCopy,
  localizedStatsCopy,
  localizedWorkGalleryCopy,`,
  `localizedHeroCopy,
  localizedStatsCopy,
  localizedWorkGalleryCopy,`,
);

if (!home.includes("export function WorkGallery")) throw new Error("home missing WorkGallery");
if (home.includes("mccoy-mission-before-after")) throw new Error("home still has mission png");
fs.writeFileSync(homePath, home);

let site = rel(preamble + services + about + products);
site = drop(site, [
  'import hero from "@/assets/hero-cleaning.jpg";',
  'import heroWebp640 from "@/assets/hero-cleaning-640.webp";',
  'import heroWebp960 from "@/assets/hero-cleaning-960.webp";',
  'import heroWebp1280 from "@/assets/hero-cleaning-1280.webp";',
  'import { CountUp } from "../CountUp";',
  'import { useLiveEditApi } from "@/lib/cms/live-edit-draft";',
  'import type { FocusEvent, KeyboardEvent } from "react";',
  'import { cn } from "@/lib/utils";',
  'import { GALLERY_IMAGE_SIZES, HERO_IMAGE_SIZES } from "@/lib/image-delivery";',
  'import { DeliveryImage } from "../DeliveryImage";',
]);
site = site.replace("useHomeHeroContent, useTypedSectionContent", "useTypedSectionContent");
site = site.replace(
  'import { useEffect, useRef, useState } from "react";',
  'import { useRef, useState } from "react";',
);
site = site.replace(
  `localizedAboutCopy,
  localizedHeroCopy,
  localizedServicesCopy,
  localizedStatsCopy,
  localizedWorkGalleryCopy,`,
  `localizedAboutCopy,
  localizedServicesCopy,`,
);
site = site.replace(/Sparkles,\n  ArrowRight,/, "ArrowRight,");
site = site.replace(
  /\nconst BUNDLED_HERO_WEBP_SRCSET[\s\S]*?\n\];\n/,
  "\n",
);
site = site.replace(
  /\n\/\*\* Inline short-text editing[\s\S]*?\n\}\n\n\/\* ============= SERVICES/,
  "\n/* ============= SERVICES",
);
site = site.replace(
  /\nfunction resolveHeroImageSrc[\s\S]*?\n\}\n\n\/\* ============= SERVICES|\nconst HERO_PLACEHOLDER_SRC[\s\S]*?\n\}\n\n\/\* ============= SERVICES/,
  "\n/* ============= SERVICES",
);

if (!site.includes("export function About")) throw new Error("site missing About");
if (site.includes("hero-cleaning-960")) throw new Error("site still has hero webp");
fs.writeFileSync(sitePath, site);

fs.writeFileSync(
  sectionsPath,
  `/** Barrel — prefer HomeSections / SitePageSections for route-level code-splitting. */
export { Hero, Stats, WorkGallery } from "./sections/HomeSections";
export { About, Services, Products } from "./sections/SitePageSections";
`,
);

console.log({
  homeLines: home.split("\n").length,
  siteLines: site.split("\n").length,
  homeHasMission: home.includes("mission-before-after"),
  siteHasHeroWebp: site.includes("hero-cleaning-960"),
});
