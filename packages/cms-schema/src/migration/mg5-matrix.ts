/**
 * MG5 qualification matrix — authoritative scope from M5 inventory.
 * Do not rediscover migration keys independently of FIXED_SECTIONS_BY_PAGE / roles.
 */

import type { BlockType } from "../block-types";
import { CANONICAL_FORM_SOURCE_KEYS, LEGACY_FORM_SOURCE_ALIASES } from "../form-source";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import {
  ALL_FIXED_SECTION_KEYS,
  BUILTIN_CMS_INVENTORY_PAGES,
} from "../e2e-inventory";
import {
  FIXED_SECTION_DEFS,
  FIXED_SECTIONS_BY_PAGE,
  type BuiltinPageKey,
  type FixedSectionKey,
} from "../sections";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";
import { MG5_MIGRATION_VERSION } from "./mg5-version";

export type Mg5Qualification =
  | "unqualified"
  | "dry-run-green"
  | "fixture-qualified"
  | "staging-qualified"
  | "production-qualified";

export type Mg5EligibilityClass =
  | "migration-eligible"
  | "intentionally-fixed"
  | "compatibility-only"
  | "not-migration-eligible";

export type Mg5MigrationEntry = {
  pageKey: BuiltinPageKey;
  legacySectionKey: FixedSectionKey;
  targetBlockType: BlockType;
  role: string;
  eligibilityClass: Mg5EligibilityClass;
  migrationEligible: boolean;
  migrationRequired: boolean;
  sourceLocation: string;
  targetLocation: string;
  deterministicBlockIdRule: string;
  sourceFields: string[];
  targetFields: string[];
  nestedItemIdStrategy: string | null;
  nlFieldMapping: Record<string, string>;
  enFieldMapping: Record<string, string>;
  formSourceBefore?: string;
  formSourceAfter?: string;
  aliases?: string[];
  orderRule: string;
  visibilityRule: string;
  dualReadModule: string | null;
  currentTests: string[];
  rollbackStrategy: string;
  qualification: Mg5Qualification;
};

const KNOWN_SOURCE_FIELDS: Record<FixedSectionKey, string[]> = {
  "home.hero": ["heading", "headingAccent", "body", "primaryCta", "secondaryCta", "image", "eyebrow"],
  "home.partners": ["eyebrow", "heading", "items", "logoBackdrop"],
  "home.stats": ["eyebrow", "heading", "body", "items"],
  "home.workGallery": ["eyebrow", "heading", "body", "items"],
  "about.main": [
    "eyebrow",
    "heading",
    "intro",
    "mission",
    "vision",
    "history",
    "missionTitle",
    "missionBody",
    "visionTitle",
    "visionBody",
    "historyTitle",
    "historyBody",
  ],
  "services.main": ["eyebrow", "heading", "intro", "body"],
  "services.cards": ["cards", "items"],
  "products.main": ["eyebrow", "heading", "body", "intro", "image", "cta", "notice"],
  "products.info": ["eyebrow", "heading", "intro", "items", "cards"],
  "contact.main": ["eyebrow", "heading", "body", "image"],
  "contact.info": ["items", "eyebrow", "heading"],
  "contact.form": [
    "eyebrow",
    "heading",
    "body",
    "highlights",
    "submitLabel",
    "successMessage",
    "successDetail",
    "consent",
    "labels",
    "placeholders",
    "formScope",
    "fields",
  ],
  "vacatures.main": ["eyebrow", "heading", "body", "image", "applicationScope"],
  "vacatures.application": [
    "formEyebrow",
    "formIntro",
    "fields",
    "mediaEyebrow",
    "mediaHeading",
    "mediaBadge",
    "mediaLinkLabel",
    "media",
    "applicationScope",
  ],
  "offerte.main": ["eyebrow", "heading", "body", "image"],
  "offerte.info": ["items", "eyebrow", "heading"],
  "offerte.form": [
    "heading",
    "body",
    "description",
    "glassScope",
    "furnitureScope",
    "submitLabel",
    "successMessage",
    "fields",
  ],
  "privacy.main": ["eyebrow", "heading", "updatedLabel", "updatedAt", "articles"],
  "terms.main": ["eyebrow", "heading", "updatedLabel", "updatedAt", "articles"],
};

const DUAL_READ_MODULES: Partial<Record<FixedSectionKey, string>> = {
  "home.hero": "migration/home-hero-blocks.ts",
  "about.main": "migration/about-blocks.ts",
  "products.main": "migration/products-blocks.ts",
  "products.info": "migration/products-blocks.ts",
  "offerte.main": "migration/offerte-blocks.ts",
  "offerte.form": "migration/offerte-blocks.ts",
  "privacy.main": "migration/legal-blocks.ts",
  "terms.main": "migration/legal-blocks.ts",
};

const FIXTURE_QUALIFIED_KEYS = new Set<FixedSectionKey>([
  "home.hero",
  "about.main",
  "products.main",
  "products.info",
  "offerte.main",
  "offerte.form",
  "privacy.main",
  "terms.main",
]);

const FIELD_MAPPINGS: Partial<
  Record<FixedSectionKey, { nl: Record<string, string>; en: Record<string, string>; nested: string | null; targets: string[] }>
> = {
  "home.hero": {
    nl: {
      heading: "title",
      body: "subtitle",
      headingAccent: "headingAccent",
      primaryCta: "cta",
      secondaryCta: "secondaryCta",
      image: "image",
      eyebrow: "eyebrow",
    },
    en: {
      "section:home.hero:heading": "block:{id}:title",
      "section:home.hero:body": "block:{id}:subtitle",
    },
    nested: null,
    targets: ["eyebrow", "title", "subtitle", "headingAccent", "cta", "secondaryCta", "image"],
  },
  "products.main": {
    nl: {
      heading: "title",
      intro: "body",
      body: "notice",
      eyebrow: "eyebrow",
      image: "image",
    },
    en: {
      "section:products.main:heading": "block:{id}:title",
      "section:products.main:intro": "block:{id}:body",
      "section:products.main:body": "block:{id}:notice",
    },
    nested: null,
    targets: ["presentation", "title", "body", "notice", "eyebrow", "image", "reverse"],
  },
  "products.info": {
    nl: {
      heading: "title",
      eyebrow: "eyebrow",
      intro: "intro",
      items: "features",
    },
    en: {
      "section:products.info:heading": "block:{id}:title",
      "section:products.info:items.{itemId}.title": "block:{id}:features.{itemId}.title",
    },
    nested: "preserve legacy item.id; else uuidV5(pageId:products.info:item:{index})",
    targets: ["presentation", "title", "eyebrow", "intro", "features"],
  },
  "about.main": {
    nl: {
      heading: "intro.title",
      intro: "intro.body",
      mission: "mission.*",
      vision: "vision.*",
      history: "history.*",
    },
    en: {
      "section:about.main:heading": "block:{introId}:title",
      "section:about.main:intro": "block:{introId}:body",
    },
    nested: null,
    targets: ["title", "body", "image", "presentation"],
  },
  "offerte.main": {
    nl: { heading: "title", body: "subtitle", eyebrow: "eyebrow", image: "image" },
    en: {
      "section:offerte.main:heading": "block:{id}:title",
      "section:offerte.main:body": "block:{id}:subtitle",
    },
    nested: null,
    targets: ["eyebrow", "title", "subtitle", "image", "cta"],
  },
  "offerte.form": {
    nl: {
      heading: "heading",
      description: "description",
      body: "description",
      submitLabel: "submitLabel",
      successMessage: "successMessage",
      glassScope: "glassScope",
      furnitureScope: "furnitureScope",
      fields: "fields",
    },
    en: {
      "section:offerte.form:heading": "block:{id}:heading",
      "section:offerte.form:description": "block:{id}:description",
    },
    nested: "preserve field.id when present",
    targets: [
      "heading",
      "description",
      "submitLabel",
      "successMessage",
      "glassScope",
      "furnitureScope",
      "fields",
    ],
  },
  "privacy.main": {
    nl: {
      eyebrow: "eyebrow",
      heading: "heading",
      updatedLabel: "updatedLabel",
      updatedAt: "updatedAt",
      articles: "articles",
    },
    en: {
      "section:privacy.main:heading": "block:{id}:heading",
      "section:privacy.main:articles.{articleId}.heading":
        "block:{id}:articles.{articleId}.heading",
    },
    nested: "preserve article.id; else uuidV5(pageId:privacy.main:article:{index})",
    targets: ["eyebrow", "heading", "updatedLabel", "updatedAt", "articles"],
  },
  "terms.main": {
    nl: {
      eyebrow: "eyebrow",
      heading: "heading",
      updatedLabel: "updatedLabel",
      updatedAt: "updatedAt",
      articles: "articles",
    },
    en: {
      "section:terms.main:heading": "block:{id}:heading",
    },
    nested: "preserve article.id; else uuidV5(pageId:terms.main:article:{index})",
    targets: ["eyebrow", "heading", "updatedLabel", "updatedAt", "articles"],
  },
};

function formIdentityFor(key: FixedSectionKey): {
  formSourceBefore?: string;
  formSourceAfter?: string;
  aliases?: string[];
} {
  if (key === "contact.form") {
    return {
      formSourceBefore: FIXED_FORM_SOURCE_IDS.contactForm,
      formSourceAfter: CANONICAL_FORM_SOURCE_KEYS.contact,
      aliases: Object.keys(LEGACY_FORM_SOURCE_ALIASES).filter(
        (a) => LEGACY_FORM_SOURCE_ALIASES[a] === CANONICAL_FORM_SOURCE_KEYS.contact,
      ),
    };
  }
  if (key === "offerte.form") {
    return {
      formSourceBefore: FIXED_FORM_SOURCE_IDS.offerteForm,
      formSourceAfter: CANONICAL_FORM_SOURCE_KEYS.offerte,
      aliases: Object.keys(LEGACY_FORM_SOURCE_ALIASES).filter(
        (a) => LEGACY_FORM_SOURCE_ALIASES[a] === CANONICAL_FORM_SOURCE_KEYS.offerte,
      ),
    };
  }
  if (key === "vacatures.application") {
    return {
      formSourceBefore: FIXED_FORM_SOURCE_IDS.vacaturesApplication,
      formSourceAfter: CANONICAL_FORM_SOURCE_KEYS.vacatures,
      aliases: Object.keys(LEGACY_FORM_SOURCE_ALIASES).filter(
        (a) => LEGACY_FORM_SOURCE_ALIASES[a] === CANONICAL_FORM_SOURCE_KEYS.vacatures,
      ),
    };
  }
  return {};
}

function testsFor(key: FixedSectionKey): string[] {
  const dual = DUAL_READ_MODULES[key];
  const tests = [
    "migration/mg5-matrix.test.ts",
    "migration/gate4-dry-run.test.ts",
    "migration/migration.test.ts",
  ];
  if (dual?.includes("products")) tests.push("migration/products-blocks.test.ts");
  if (dual?.includes("home-hero")) tests.push("migration/home-hero-blocks.test.ts");
  if (dual?.includes("about")) tests.push("migration/about-blocks.test.ts");
  if (dual?.includes("offerte")) tests.push("migration/offerte-blocks.test.ts");
  if (dual?.includes("legal")) tests.push("migration/legal-blocks.test.ts");
  if (key === "contact.form" || key === "offerte.form" || key === "vacatures.application") {
    tests.push("migration/mg5-form-identity.test.ts", "e2e/forms-aanvragen.spec.ts");
  }
  return tests;
}

function buildEntry(
  pageKey: BuiltinPageKey,
  legacySectionKey: FixedSectionKey,
  role: string,
  targetBlockType: string,
): Mg5MigrationEntry {
  const dualReadModule = DUAL_READ_MODULES[legacySectionKey] ?? null;
  const maps = FIELD_MAPPINGS[legacySectionKey];
  const form = formIdentityFor(legacySectionKey);
  const required = FIXED_SECTION_DEFS[legacySectionKey].required;
  const fixtureQualified = FIXTURE_QUALIFIED_KEYS.has(legacySectionKey);

  return {
    pageKey,
    legacySectionKey,
    targetBlockType: targetBlockType as BlockType,
    role,
    eligibilityClass: "migration-eligible",
    migrationEligible: true,
    migrationRequired: required || Boolean(dualReadModule),
    sourceLocation: `sectionContent[${legacySectionKey}] + layout fixed:${legacySectionKey}`,
    targetLocation: `blocks[{uuidV5}] type=${targetBlockType} role=${role}`,
    deterministicBlockIdRule: `uuidV5(pageId:${legacySectionKey}:${role}, CMS_MIGRATION_NAMESPACE) — ${MG5_MIGRATION_VERSION}`,
    sourceFields: KNOWN_SOURCE_FIELDS[legacySectionKey] ?? [],
    targetFields: maps?.targets ?? ["(via mapFixedSectionToBlockData + block normalize)"],
    nestedItemIdStrategy: maps?.nested ?? "preserve legacy nested id when present; else position-stable uuidV5",
    nlFieldMapping: maps?.nl ?? { "(legacy)": "(normalized block fields)" },
    enFieldMapping: maps?.en ?? {
      [`section:${legacySectionKey}:*`]: "block:{deterministicId}:*",
    },
    ...form,
    orderRule: "layout order preserved; multi-role expands in FIXED_SECTION_MIGRATION_ROLES order",
    visibilityRule: "layout item.hidden copied onto each created block layout item",
    dualReadModule,
    currentTests: testsFor(legacySectionKey),
    rollbackStrategy: "pre-apply backup artifact + createRollbackSnapshot + CmsStore.rollbackPage / restoreDraft",
    qualification: fixtureQualified
      ? "fixture-qualified"
      : dualReadModule
        ? "dry-run-green"
        : "unqualified",
  };
}

/** Complete MG5 matrix rows — one per (pageKey, fixedKey, role). */
export function buildMg5MigrationMatrix(): Mg5MigrationEntry[] {
  const entries: Mg5MigrationEntry[] = [];
  for (const page of BUILTIN_CMS_INVENTORY_PAGES) {
    for (const fixedKey of FIXED_SECTIONS_BY_PAGE[page.pageKey]) {
      const roles = FIXED_SECTION_MIGRATION_ROLES[fixedKey];
      for (const spec of roles) {
        entries.push(buildEntry(page.pageKey, fixedKey, spec.role, spec.blockType));
      }
    }
  }
  return entries;
}

export const MG5_MIGRATION_MATRIX: readonly Mg5MigrationEntry[] = buildMg5MigrationMatrix();

export function mg5MatrixEntriesForPageKey(pageKey: BuiltinPageKey): Mg5MigrationEntry[] {
  return MG5_MIGRATION_MATRIX.filter((e) => e.pageKey === pageKey);
}

export function mg5MatrixEntry(
  legacySectionKey: FixedSectionKey,
  role?: string,
): Mg5MigrationEntry | undefined {
  return MG5_MIGRATION_MATRIX.find(
    (e) => e.legacySectionKey === legacySectionKey && (role ? e.role === role : true),
  );
}

/** Every M5 fixed key must appear in the matrix (no unexplained gaps). */
export function assertMg5MatrixCoversM5Inventory(): {
  ok: boolean;
  missingKeys: FixedSectionKey[];
  matrixKeyCount: number;
  m5KeyCount: number;
} {
  const covered = new Set(MG5_MIGRATION_MATRIX.map((e) => e.legacySectionKey));
  const missingKeys = ALL_FIXED_SECTION_KEYS.filter((k) => !covered.has(k));
  return {
    ok: missingKeys.length === 0,
    missingKeys,
    matrixKeyCount: covered.size,
    m5KeyCount: ALL_FIXED_SECTION_KEYS.length,
  };
}

export function mg5MatrixSummary() {
  const eligible = MG5_MIGRATION_MATRIX.filter((e) => e.migrationEligible);
  const fixtureQualified = MG5_MIGRATION_MATRIX.filter(
    (e) => e.qualification === "fixture-qualified",
  );
  const unqualified = MG5_MIGRATION_MATRIX.filter((e) => e.qualification === "unqualified");
  const withDualRead = MG5_MIGRATION_MATRIX.filter((e) => e.dualReadModule);
  return {
    migrationVersion: MG5_MIGRATION_VERSION,
    m5FixedKeys: ALL_FIXED_SECTION_KEYS.length,
    matrixRows: MG5_MIGRATION_MATRIX.length,
    migrationEligibleRows: eligible.length,
    intentionallyFixedRows: MG5_MIGRATION_MATRIX.filter(
      (e) => e.eligibilityClass === "intentionally-fixed",
    ).length,
    compatibilityOnlyRows: MG5_MIGRATION_MATRIX.filter(
      (e) => e.eligibilityClass === "compatibility-only",
    ).length,
    dualReadRows: withDualRead.length,
    fixtureQualifiedRows: fixtureQualified.length,
    unqualifiedRows: unqualified.length,
  };
}
