import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  absoluteCanonicalUrl,
  CANONICAL_SITE_ORIGIN,
  ensurePageLocaleFields,
  resolvePublishedCmsPage,
  resolveSeoMetadata,
  type BuiltinCmsPage,
  type BuiltinPageKey,
} from "@mccoy/cms-schema";
import { FROZEN_DEPLOYED_EN_SEO, FROZEN_DEPLOYED_NL_SEO } from "./frozen-deployed-seo";

const COMMERCIAL_NL_PATHS = [
  "/",
  "/about",
  "/services",
  "/products",
  "/contact",
  "/offerte",
  "/vacatures",
] as const;

const PATH_TO_PAGE_KEY: Record<(typeof COMMERCIAL_NL_PATHS)[number], BuiltinPageKey> = {
  "/": "home",
  "/about": "about",
  "/services": "services",
  "/products": "products",
  "/contact": "contact",
  "/offerte": "offerte",
  "/vacatures": "vacatures",
};

const MAJOR_H1_SOURCES: Array<{ route: string; file: string }> = [
  {
    route: "/",
    file: join(
      dirname(fileURLToPath(import.meta.url)),
      "../../components/site/sections/HomeSections.tsx",
    ),
  },
  {
    route: "/services",
    file: join(
      dirname(fileURLToPath(import.meta.url)),
      "../../components/site/sections/ServicesSections.tsx",
    ),
  },
  {
    route: "/products",
    file: join(
      dirname(fileURLToPath(import.meta.url)),
      "../../components/site/sections/ProductsBlockViews.tsx",
    ),
  },
  {
    route: "/about",
    file: join(
      dirname(fileURLToPath(import.meta.url)),
      "../../components/site/sections/AboutSections.tsx",
    ),
  },
  {
    route: "/contact|/offerte|/vacatures",
    file: join(
      dirname(fileURLToPath(import.meta.url)),
      "../../components/site/FormPageChrome.tsx",
    ),
  },
];

function samplePage(
  path: (typeof COMMERCIAL_NL_PATHS)[number],
  locale: "nl" | "en" = "nl",
): BuiltinCmsPage {
  const identity = path === "/" ? "/" : path;
  return ensurePageLocaleFields({
    id: `page_${identity.replace(/\W+/g, "_") || "home"}`,
    kind: "builtin",
    isCustom: false,
    pageKey: PATH_TO_PAGE_KEY[path],
    slug: identity,
    title: "Home",
    description: "",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: 0,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
    paths: { nl: identity, en: identity },
    localeContent: {
      nl: {
        navigationLabel: "Home",
        pageTitle: "Home",
        seo: { title: "Home", description: "" },
      },
      en: {
        navigationLabel: "Home",
        pageTitle: "Home",
        seo: { title: "Home", description: "" },
      },
    },
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
      en: { publicationState: "published", freshness: "current" },
    },
  }) as BuiltinCmsPage;
}

function countCanonical(links: Array<{ rel: string; href: string }>): number {
  return links.filter((l) => l.rel === "canonical").length;
}

describe("Phase 11 on-page SEO gate", () => {
  it("frozen NL titles are not bare Home and include meta descriptions on commercial pages", () => {
    for (const path of COMMERCIAL_NL_PATHS) {
      const seo = FROZEN_DEPLOYED_NL_SEO[path];
      expect(seo, `missing frozen NL SEO for ${path}`).toBeTruthy();
      expect(seo!.title.trim().toLowerCase()).not.toBe("home");
      expect(seo!.title).not.toMatch(/^Home(\s*[—|-].*)?$/i);
      expect(seo!.title.length).toBeGreaterThan(12);
      expect(seo!.description.trim().length).toBeGreaterThan(40);
      expect(seo!.title.toLowerCase()).toMatch(/mccoy/);
    }
  });

  it("frozen EN commercial titles are not bare Home when present", () => {
    for (const path of ["/", "/about", "/services", "/products", "/contact", "/vacatures"] as const) {
      const seo = FROZEN_DEPLOYED_EN_SEO[path];
      expect(seo, `missing frozen EN SEO for ${path}`).toBeTruthy();
      expect(seo!.title.trim().toLowerCase()).not.toBe("home");
      expect(seo!.description.trim().length).toBeGreaterThan(40);
    }
  });

  it("exactly one self-referencing www canonical when frozen SEO is applied", () => {
    for (const path of COMMERCIAL_NL_PATHS) {
      const page = samplePage(path);
      const resolved = resolvePublishedCmsPage({
        page,
        revisionId: "r1",
        publishedAt: "2026-08-11T00:00:00Z",
        locale: "nl",
        site: { origin: "https://preview.example.vercel.app" },
      });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) continue;
      const head = resolveSeoMetadata(
        resolved.snapshot,
        { origin: "https://preview.example.vercel.app" },
        { seo: FROZEN_DEPLOYED_NL_SEO[path] },
      );
      expect(countCanonical(head.links)).toBe(1);
      expect(head.links.find((l) => l.rel === "canonical")?.href).toBe(
        absoluteCanonicalUrl(path === "/" ? "/" : path, CANONICAL_SITE_ORIGIN),
      );
      expect(head.title).toBe(FROZEN_DEPLOYED_NL_SEO[path]!.title);
      expect(head.meta.find((m) => m.name === "description")?.content).toBe(
        FROZEN_DEPLOYED_NL_SEO[path]!.description,
      );
      expect(head.jsonLd).toBeTruthy();
      const ldText = JSON.stringify(head.jsonLd);
      expect(ldText).toContain("www.mccoy.nl");
      expect(ldText).not.toMatch(/aggregateRating|AggregateRating/i);
    }
  });

  it("major public surfaces declare exactly one H1 in the primary source file", () => {
    for (const { route, file } of MAJOR_H1_SOURCES) {
      const source = readFileSync(file, "utf8");
      const matches = source.match(/<(?:motion\.)?h1\b/g) ?? [];
      expect(matches.length, `${route} → ${file}`).toBe(1);
    }
  });
});