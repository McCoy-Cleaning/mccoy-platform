import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const src = readFileSync(
  join(root, "packages/cms-editor/src/blocks/blockEditorRegistry.ts"),
  "utf8",
);

const mapStart = src.indexOf("export const blockEditorRegistry");
const mapBodyStart = src.indexOf("{", mapStart);
const mapEnd = src.indexOf("\n};", mapBodyStart);
const mapBody = src.slice(mapBodyStart + 1, mapEnd);

const families = {
  "basic-content": ["hero", "cta", "richText", "centered", "featureGrid", "textImage"],
  structural: [
    "columns",
    "steps",
    "values",
    "benefits",
    "timeline",
    "comparisonTable",
    "portfolio",
    "roadmap",
    "latestPosts",
  ],
  "media-social": [
    "gallery",
    "carousel",
    "video",
    "beforeAfter",
    "quote",
    "announcement",
    "spacer",
    "teamGrid",
    "teamProfile",
    "partnersMarquee",
    "statsCounters",
  ],
  "information-legal": ["contactInfoCards", "legalArticles"],
  conversion: ["newsletter", "contactForm", "popup", "quoteRequestForm"],
  specialised: ["jobs", "plans", "offers"],
};

/** Extract one top-level `key: def(...)` entry, respecting nested braces/parens. */
function extractEntry(body, key) {
  const re = new RegExp(`\\n\\s*${key}:\\s*def\\(`);
  const m = re.exec(body);
  if (!m) throw new Error(`Missing editor entry: ${key}`);
  let i = m.index + m[0].length - 1; // at '('
  let depth = 0;
  for (; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        // include trailing comma if present
        let end = i + 1;
        if (body[end] === ",") end++;
        return body.slice(m.index, end).trim();
      }
    }
  }
  throw new Error(`Unclosed def for ${key}`);
}

const dir = join(root, "packages/cms-editor/src/blocks/editor-registry");
mkdirSync(dir, { recursive: true });

const importHeader = `import type { ComponentType } from "react";
import type {
  HeroBlockData,
  JobsBlockData,
  PlansBlockData,
  RoadmapBlockData,
  ContactFormBlockData,
  ContactInfoCardsBlockData,
  LegalArticlesBlockData,
  NewsletterBlockData,
  OffersBlockData,
  PartnersMarqueeBlockData,
  PopupBlockData,
  QuoteRequestFormBlockData,
  StatsCountersBlockData,
} from "@mccoy/cms-schema";
import {
  CTA_SUPPORTED_PATHS,
  imageSupportedPaths,
  type BlockEditorProps,
} from "../editor-definition";
import { def } from "./def";
import { CtaBlockEditor, type CtaBlockData } from "../CtaBlockEditor";
import { FeatureGridBlockEditor, type FeatureGridBlockData } from "../FeatureGridBlockEditor";
import { HeroBlockEditor } from "../HeroBlockEditor";
import { PlansBlockEditor } from "../PlansBlockEditor";
import { RoadmapBlockEditor } from "../RoadmapBlockEditor";
import { JobsBlockEditor, TeamGridBlockEditor, type TeamGridBlockData } from "../TeamJobsBlockEditor";
import { TextImageBlockEditor, type TextImageBlockData } from "../TextImageBlockEditor";
import {
  GalleryBlockEditor,
  CarouselBlockEditor,
  type GalleryBlockData,
  type CarouselBlockData,
} from "../GalleryBlockEditor";
import { TitleBodyCtaBlockEditor } from "../TitleBodyCtaBlockEditor";
import { BeforeAfterBlockEditor, VideoBlockEditor } from "../MediaBlockEditors";
import {
  AnnouncementBlockEditor,
  QuoteBlockEditor,
  SpacerBlockEditor,
  TeamProfileBlockEditor,
} from "../MiscBlockEditors";
import {
  ContactFormBlockEditor,
  NewsletterBlockEditor,
  PopupBlockEditor,
} from "../ConversionBlockEditors";
import {
  ContactInfoCardsBlockEditor,
  LegalArticlesBlockEditor,
  PartnersMarqueeBlockEditor,
  QuoteRequestFormBlockEditor,
  StatsCountersBlockEditor,
} from "../NewSectionsBlockEditors";
import { OffersBlockEditor } from "../OffersBlockEditor";
import {
  BenefitsBlockEditor,
  ColumnsBlockEditor,
  ComparisonTableBlockEditor,
  LatestPostsBlockEditor,
  PortfolioBlockEditor,
  StepsBlockEditor,
  TimelineBlockEditor,
  ValuesBlockEditor,
} from "../StructureBlockEditors";
`;

const exportNames = {
  "basic-content": "basicContentEditorRegistry",
  structural: "structuralEditorRegistry",
  "media-social": "mediaSocialEditorRegistry",
  "information-legal": "informationLegalEditorRegistry",
  conversion: "conversionEditorRegistry",
  specialised: "specialisedEditorRegistry",
};

for (const [fam, keys] of Object.entries(families)) {
  const entries = keys.map((k) => extractEntry(mapBody, k));
  const name = exportNames[fam];
  const body = `${importHeader}
/** Stage 5 editor registry family: ${fam}. */
export const ${name} = {
  ${entries.join("\n  ")}
} as const;
`;
  writeFileSync(join(dir, `${fam}.ts`), body);
  console.log("wrote", fam, keys.length);
}

const thin = `import {
  ALL_BLOCK_TYPES,
  getBlockDataDefinition,
  PUBLISHABLE_BLOCK_TYPES,
  type BlockType,
  type HeroBlockData,
  type JobsBlockData,
  type PlansBlockData,
  type RoadmapBlockData,
} from "@mccoy/cms-schema";
import type { ComponentType } from "react";
import {
  type BlockEditorDefinition,
  type BlockEditorProps,
  type BlockEditorRegistryMap,
} from "./editor-definition";
import { setPopupContentEditorLookup } from "./popup-editor-bridge";
import type { CtaBlockData } from "./CtaBlockEditor";
import type { FeatureGridBlockData } from "./FeatureGridBlockEditor";
import type { TextImageBlockData } from "./TextImageBlockEditor";
import type { GalleryBlockData, CarouselBlockData } from "./GalleryBlockEditor";
import type { TeamGridBlockData } from "./TeamJobsBlockEditor";
import { basicContentEditorRegistry } from "./editor-registry/basic-content";
import { structuralEditorRegistry } from "./editor-registry/structural";
import { mediaSocialEditorRegistry } from "./editor-registry/media-social";
import { informationLegalEditorRegistry } from "./editor-registry/information-legal";
import { conversionEditorRegistry } from "./editor-registry/conversion";
import { specialisedEditorRegistry } from "./editor-registry/specialised";

export type { BlockEditorProps } from "./editor-definition";

type AnyEditor = ComponentType<BlockEditorProps<unknown>>;

/**
 * Typed editor registry — composed from Stage 5 family modules.
 * Presence alone is not enough; \`supportedPaths\` must cover editable schema fields.
 */
export const blockEditorRegistry: BlockEditorRegistryMap = {
  ...basicContentEditorRegistry,
  ...structuralEditorRegistry,
  ...mediaSocialEditorRegistry,
  ...informationLegalEditorRegistry,
  ...conversionEditorRegistry,
  ...specialisedEditorRegistry,
};

export type DedicatedEditorData =
  | HeroBlockData
  | CtaBlockData
  | FeatureGridBlockData
  | TextImageBlockData
  | GalleryBlockData
  | CarouselBlockData
  | JobsBlockData
  | TeamGridBlockData
  | RoadmapBlockData
  | PlansBlockData;

export function getBlockEditorDefinition(
  type: BlockType,
): BlockEditorDefinition<unknown> | null {
  return (blockEditorRegistry[type] as BlockEditorDefinition<unknown> | undefined) ?? null;
}

export function getRegisteredBlockEditor(type: BlockType): AnyEditor | null {
  return getBlockEditorDefinition(type)?.Editor ?? null;
}

export function listUnsupportedPublishableBlockTypes(): BlockType[] {
  return PUBLISHABLE_BLOCK_TYPES.filter((t) => !blockEditorRegistry[t]);
}

/** @deprecated Prefer {@link listUnsupportedPublishableBlockTypes} / quality checks. */
export function listBlockTypesMissingDedicatedEditor(): BlockType[] {
  return ALL_BLOCK_TYPES.filter((t) => {
    const entry = blockEditorRegistry[t];
    if (!entry) return true;
    return entry.quality !== "dedicated" && entry.quality !== "typed-composed";
  });
}

export function blockEditorSummary(type: BlockType, data: unknown): string | null {
  const defn = getBlockDataDefinition(type);
  return defn.getSummary?.(data) ?? null;
}

export type { BlockEditorDefinition, EditorQuality, BlockEditorRegistryMap } from "./editor-definition";
export { CTA_SUPPORTED_PATHS, imageSupportedPaths } from "./editor-definition";

setPopupContentEditorLookup((type) => getBlockEditorDefinition(type)?.Editor ?? null);
`;

writeFileSync(join(root, "packages/cms-editor/src/blocks/blockEditorRegistry.ts"), thin);
console.log("rewrote blockEditorRegistry.ts");
