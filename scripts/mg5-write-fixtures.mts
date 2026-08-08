/**
 * Writes offline MG5 cohort fixtures for CLI dry-run qualification.
 * Does not touch CMS persistence.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CURRENT_LAYOUT_VERSION,
  fixtureAboutNlEn,
  fixtureUntouchedHome,
  type BuiltinCmsPage,
} from "@mccoy/cms-schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../packages/cms-schema/src/migration/mg5-fixtures");

function productsLegacyPage(): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    id: "page_products",
    pageKey: "products",
    slug: "/producten",
    title: "Producten",
    description: "fixture",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:products.main", kind: "fixed", key: "products.main", hidden: false },
      { id: "fixed:products.info", kind: "fixed", key: "products.info", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "products.main": {
        heading: "Ons assortiment",
        intro: "Intro NL",
        body: "Notice NL",
        image: { kind: "url", url: "/images/products.jpg", alt: "Producten" },
      },
      "products.info": {
        heading: "Productinfo",
        items: [{ id: "feat_1", title: "Glas", body: "Body", icon: "sparkles" }],
      },
    } as unknown as BuiltinCmsPage["sectionContent"],
    enFieldDrafts: {
      "section:products.main:heading": "Our range",
    },
    updatedAt: 1,
    version: 1,
  };
}

function offertePage(): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    id: "page_offerte",
    pageKey: "offerte",
    slug: "/offerte",
    title: "Offerte",
    description: "fixture",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:offerte.main", kind: "fixed", key: "offerte.main", hidden: false },
      { id: "fixed:offerte.form", kind: "fixed", key: "offerte.form", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "offerte.main": { heading: "Offerte NL", body: "Body" },
      "offerte.form": { heading: "Form NL", submitLabel: "Verstuur" },
    } as unknown as BuiltinCmsPage["sectionContent"],
    updatedAt: 1,
    version: 1,
  };
}

function privacyPage(): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    id: "page_privacy",
    pageKey: "privacy",
    slug: "/privacy",
    title: "Privacy",
    description: "fixture",
    inNav: false,
    blocks: [],
    layout: [{ id: "fixed:privacy.main", kind: "fixed", key: "privacy.main", hidden: false }],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "privacy.main": {
        heading: "Privacy",
        articles: [{ id: "a1", heading: "A", content: "C" }],
      },
    } as unknown as BuiltinCmsPage["sectionContent"],
    updatedAt: 1,
    version: 1,
  };
}

/** Unique pageId per file — fixture persistence keys by id. */
const pages: Array<[string, BuiltinCmsPage]> = [
  ["page_home.json", fixtureUntouchedHome()],
  ["page_about.json", fixtureAboutNlEn()],
  ["page_products.json", productsLegacyPage()],
  ["page_offerte.json", offertePage()],
  ["page_privacy.json", privacyPage()],
];

await mkdir(outDir, { recursive: true });
for (const [name, page] of pages) {
  await writeFile(
    path.join(outDir, name),
    `${JSON.stringify({ draftRevisionNumber: 1, payload: page }, null, 2)}\n`,
    "utf8",
  );
}
console.log(`Wrote ${pages.length} fixtures to ${outDir}`);
