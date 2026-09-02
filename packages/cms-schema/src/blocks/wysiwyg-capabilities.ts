import { z } from "zod";
import type { BlockType } from "../block-types";
import { getBlockDataDefinition } from "./registry";

/** Surface kinds the WYSIWYG canvas can attach without a second renderer. */
export type WysiwygFieldKind = "text" | "media" | "cta" | "formFields" | "repeater";

/**
 * A field that may be edited on-canvas when wired through Editable* helpers.
 * Paths are schema-relative (e.g. `title`, `cta`, `headingAccent.accent`).
 */
export type BlockWysiwygField = {
  kind: WysiwygFieldKind;
  path: string;
  multiline?: boolean;
};

/**
 * Authoritative per-block WYSIWYG contract.
 * `canvas` and `advancedOnly` are mutually exclusive path sets — never both.
 */
export type BlockWysiwygCapabilities = {
  canvas: readonly BlockWysiwygField[];
  /** Schema paths that stay in Geavanceerd (structural / system / unsafe). */
  advancedOnly: readonly string[];
};

function field(
  kind: WysiwygFieldKind,
  path: string,
  opts?: { multiline?: boolean },
): BlockWysiwygField {
  return opts?.multiline ? { kind, path, multiline: true } : { kind, path };
}

function caps(
  canvas: readonly BlockWysiwygField[],
  advancedOnly: readonly string[] = [],
): BlockWysiwygCapabilities {
  return { canvas, advancedOnly };
}

/**
 * Exactly one entry per {@link BlockType}. Adding a block type without an entry
 * is a TypeScript compile error (`Record<BlockType, …>`).
 */
export const BLOCK_WYSIWYG_CAPABILITIES: Record<BlockType, BlockWysiwygCapabilities> = {
  hero: caps(
    [
      field("text", "eyebrow"),
      field("text", "title"),
      field("text", "headingAccent.beforeAccent"),
      field("text", "headingAccent.accent"),
      field("text", "headingAccent.afterAccent"),
      field("text", "subtitle", { multiline: true }),
      field("cta", "cta"),
      field("cta", "secondaryCta"),
      field("media", "image"),
      field("repeater", "trustItems"),
      field("text", "highlightStat.value"),
      field("text", "highlightStat.label"),
      field("text", "certBadge"),
    ],
    ["align", "presentation", "mediaKind", "videoUrl"],
  ),

  richText: caps(
    [field("text", "title"), field("text", "body", { multiline: true }), field("cta", "cta")],
    [],
  ),

  centered: caps(
    [
      field("text", "eyebrow"),
      field("text", "title"),
      field("text", "body", { multiline: true }),
      field("cta", "cta"),
      field("repeater", "pillars"),
    ],
    ["presentation"],
  ),

  textImage: caps(
    [
      field("text", "eyebrow"),
      field("text", "title"),
      field("text", "body", { multiline: true }),
      field("text", "notice", { multiline: true }),
      field("media", "image"),
      field("repeater", "metrics"),
      field("text", "tag"),
    ],
    ["reverse", "presentation", "icon", "aspectClassName", "objectPosition", "scaleMode"],
  ),

  columns: caps([field("text", "title"), field("repeater", "columns")], []),

  benefits: caps([field("text", "title"), field("repeater", "items")], []),

  quote: caps([field("repeater", "items")], []),

  gallery: caps(
    [
      field("text", "title"),
      field("text", "eyebrow"),
      field("text", "body", { multiline: true }),
      field("repeater", "images"),
    ],
    ["layout", "contentMode", "textPlacement", "columns"],
  ),

  video: caps(
    [
      field("text", "title"),
      field("text", "description", { multiline: true }),
      field("media", "poster"),
      field("media", "image"),
    ],
    ["videoUrl", "mediaKind"],
  ),

  beforeAfter: caps(
    [
      field("text", "title"),
      field("media", "before"),
      field("media", "after"),
      field("text", "beforeLabel"),
      field("text", "afterLabel"),
    ],
    [],
  ),

  carousel: caps([field("repeater", "slides")], []),

  steps: caps([field("text", "title"), field("repeater", "steps")], []),

  comparisonTable: caps(
    [field("text", "title"), field("repeater", "columns"), field("repeater", "rows")],
    [],
  ),

  featureGrid: caps(
    [
      field("text", "eyebrow"),
      field("text", "title"),
      field("text", "intro", { multiline: true }),
      field("repeater", "features"),
    ],
    ["presentation"],
  ),

  /** Layout-only — all settings stay in Geavanceerd. */
  spacer: caps([], ["size", "divider"]),

  teamGrid: caps([field("text", "title"), field("repeater", "members")], []),

  teamProfile: caps(
    [
      field("text", "name"),
      field("text", "role"),
      field("text", "bio", { multiline: true }),
      field("media", "photo"),
      field("text", "email"),
    ],
    [],
  ),

  values: caps([field("text", "title"), field("repeater", "values")], []),

  timeline: caps([field("text", "title"), field("repeater", "milestones")], []),

  roadmap: caps([field("text", "title"), field("repeater", "milestones")], []),

  plans: caps(
    [
      field("text", "title"),
      field("text", "featuresColumnLabel"),
      field("repeater", "features"),
      field("repeater", "plans"),
    ],
    [],
  ),

  cta: caps(
    [field("text", "title"), field("text", "body", { multiline: true }), field("cta", "cta")],
    [],
  ),

  newsletter: caps(
    [
      field("text", "title"),
      field("text", "body", { multiline: true }),
      field("text", "buttonLabel"),
      field("text", "consent", { multiline: true }),
    ],
    ["scope"],
  ),

  contactForm: caps(
    [
      field("text", "eyebrow"),
      field("text", "title"),
      field("text", "body", { multiline: true }),
      field("repeater", "highlights"),
      field("text", "submitLabel"),
      field("text", "successMessage"),
      field("text", "successDetail", { multiline: true }),
      field("text", "consent", { multiline: true }),
      field("formFields", "fields"),
    ],
    [
      "textPlacement",
      "formColumnsDesktop",
      "labels",
      "placeholders",
      "recipient",
      "confirmation",
      "scope",
    ],
  ),

  announcement: caps(
    [field("text", "message", { multiline: true }), field("text", "linkLabel"), field("cta", "link")],
    [],
  ),

  popup: caps(
    [field("text", "title"), field("text", "body", { multiline: true }), field("cta", "cta")],
    [],
  ),

  portfolio: caps([field("text", "title"), field("repeater", "projects")], []),

  jobs: caps(
    [
      field("text", "heading"),
      field("text", "introduction", { multiline: true }),
      field("text", "emptyStateText", { multiline: true }),
      field("repeater", "vacancies"),
    ],
    ["displayMode", "showFilters"],
  ),

  latestPosts: caps([field("text", "title"), field("repeater", "posts")], []),

  partnersMarquee: caps(
    [field("text", "eyebrow"), field("text", "heading"), field("repeater", "items")],
    ["animate"],
  ),

  statsCounters: caps(
    [
      field("text", "eyebrow"),
      field("text", "heading"),
      field("text", "body", { multiline: true }),
      field("repeater", "items"),
    ],
    [],
  ),

  contactInfoCards: caps(
    [field("text", "eyebrow"), field("text", "heading"), field("repeater", "items")],
    [],
  ),

  /**
   * Offerte (E12): canvas chrome copy + tab tag/title/description via EditableText
   * (tabs.N.* matched in CmsEditSurface). Field label/placeholder via quote field chrome.
   * Tab kinds, field types, payloadKeys, scopes stay advanced/locked.
   */
  quoteRequestForm: caps(
    [
      field("text", "heading"),
      field("text", "description", { multiline: true }),
      field("text", "submitLabel"),
      field("text", "successMessage"),
    ],
    ["tabs", "defaultTabId", "enabledScopes", "defaultScope"],
  ),

  legalArticles: caps(
    [
      field("text", "eyebrow"),
      field("text", "heading"),
      field("text", "updatedLabel"),
      field("text", "tocLabel"),
      field("repeater", "articles"),
    ],
    ["updatedAt"],
  ),

  offers: caps(
    [
      field("text", "title"),
      field("text", "subtitle", { multiline: true }),
      field("repeater", "offers"),
    ],
    ["layout"],
  ),
};

export function getBlockWysiwygCapabilities(type: BlockType): BlockWysiwygCapabilities {
  const entry = BLOCK_WYSIWYG_CAPABILITIES[type];
  if (!entry) {
    throw new Error(`Missing WYSIWYG capabilities for block type: ${type}`);
  }
  return entry;
}

/** Paths declared for on-canvas editing. */
export function blockWysiwygCanvasPaths(type: BlockType): string[] {
  return getBlockWysiwygCapabilities(type).canvas.map((f) => f.path);
}

type ZodInternalDef = {
  typeName?: string;
  innerType?: z.ZodTypeAny;
  schema?: z.ZodTypeAny;
  type?: z.ZodTypeAny;
  shape?: (() => Record<string, z.ZodTypeAny>) | Record<string, z.ZodTypeAny>;
};

function unwrapZod(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  for (let depth = 0; depth < 24; depth++) {
    const def = current._def as ZodInternalDef;
    const name = def.typeName;
    if (name === "ZodOptional" || name === "ZodNullable" || name === "ZodDefault") {
      current = def.innerType as z.ZodTypeAny;
      continue;
    }
    if (name === "ZodEffects") {
      current = def.schema as z.ZodTypeAny;
      continue;
    }
    break;
  }
  return current;
}

function zodObjectShape(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | null {
  const unwrapped = unwrapZod(schema);
  const def = unwrapped._def as ZodInternalDef;
  if (def.typeName !== "ZodObject") return null;
  const shape = typeof def.shape === "function" ? def.shape() : def.shape;
  return shape ?? null;
}

/**
 * Whether `path` (dot-separated) exists on a Zod schema.
 * Array segments continue into the element schema (e.g. `items.label`).
 */
export function zodSchemaHasPath(schema: z.ZodTypeAny, path: string): boolean {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return false;

  let current: z.ZodTypeAny = schema;
  for (const part of parts) {
    current = unwrapZod(current);
    const def = current._def as ZodInternalDef;
    if (def.typeName === "ZodObject") {
      const shape = zodObjectShape(current);
      if (!shape || !(part in shape)) return false;
      current = shape[part]!;
      continue;
    }
    if (def.typeName === "ZodArray") {
      // Enter the element type and resolve this segment against it.
      const element = (current as z.ZodArray<z.ZodTypeAny>).element;
      current = unwrapZod(element);
      const shape = zodObjectShape(current);
      if (!shape || !(part in shape)) return false;
      current = shape[part]!;
      continue;
    }
    return false;
  }
  return true;
}

/** Validate that every canvas path exists on the block's catalog schema. */
export function assertCanvasPathsExistInSchema(type: BlockType): void {
  const def = getBlockDataDefinition(type);
  const capsForType = getBlockWysiwygCapabilities(type);
  for (const entry of capsForType.canvas) {
    if (!zodSchemaHasPath(def.schema as z.ZodTypeAny, entry.path)) {
      throw new Error(
        `WYSIWYG canvas path "${entry.path}" is not present on ${type} schema`,
      );
    }
  }
  for (const path of capsForType.advancedOnly) {
    if (!zodSchemaHasPath(def.schema as z.ZodTypeAny, path)) {
      throw new Error(
        `WYSIWYG advancedOnly path "${path}" is not present on ${type} schema`,
      );
    }
  }
}
