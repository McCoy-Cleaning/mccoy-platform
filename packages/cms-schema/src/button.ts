import { z } from "zod";
import { cmsLinkSchema, parseCmsLink, parseCmsLinkDraft } from "./links";
import type { CmsLink } from "./types";
import type { BlockType } from "./types";

/**
 * Shared CMS button / CTA model.
 * Editors configure destination: none | page | external | popup.
 */

export const CMS_BUTTON_ACTIONS = ["link", "popup"] as const;
export type CmsButtonAction = (typeof CMS_BUTTON_ACTIONS)[number];

/**
 * Section types that must not appear as button-popup body content.
 * Blocks CTA / popup nesting (no popup-in-popup shell).
 */
export const POPUP_CONTENT_EXCLUDED_BLOCK_TYPES = ["cta", "popup"] as const satisfies readonly BlockType[];

/**
 * Every section type an editor may put inside a button popup, except CTA and
 * the popup section itself. Keep in sync with `BlockType` minus
 * {@link POPUP_CONTENT_EXCLUDED_BLOCK_TYPES} (enforced by tests + assert below).
 * Dutch labels come from the block catalog at edit time.
 */
export const POPUP_CONTENT_BLOCK_TYPES = [
  "hero",
  "richText",
  "centered",
  "textImage",
  "columns",
  "benefits",
  "quote",
  "gallery",
  "video",
  "beforeAfter",
  "carousel",
  "steps",
  "comparisonTable",
  "featureGrid",
  "spacer",
  "teamGrid",
  "teamProfile",
  "values",
  "timeline",
  "roadmap",
  "plans",
  "newsletter",
  "contactForm",
  "announcement",
  "portfolio",
  "jobs",
  "latestPosts",
  "partnersMarquee",
  "statsCounters",
  "contactInfoCards",
  "quoteRequestForm",
  "legalArticles",
  "offers",
] as const satisfies readonly BlockType[];

export type PopupContentBlockType = (typeof POPUP_CONTENT_BLOCK_TYPES)[number];
export type PopupContentExcludedBlockType = (typeof POPUP_CONTENT_EXCLUDED_BLOCK_TYPES)[number];

/** Compile-time: allow-list === BlockType minus CTA/popup. */
type MissingPopupContent = Exclude<
  Exclude<BlockType, PopupContentExcludedBlockType>,
  PopupContentBlockType
>;
type ExtraPopupContent = Exclude<
  PopupContentBlockType,
  Exclude<BlockType, PopupContentExcludedBlockType>
>;
type AssertPopupContentMatchesBlockType =
  MissingPopupContent | ExtraPopupContent extends never
    ? true
    : { missing: MissingPopupContent; extra: ExtraPopupContent };
const _assertPopupContentMatchesBlockType: AssertPopupContentMatchesBlockType = true;
void _assertPopupContentMatchesBlockType;

export type CmsButtonPopupContent = {
  type: PopupContentBlockType;
  data: Record<string, unknown>;
};

export type CmsButton = {
  label: string;
  /**
   * `link` (default / omitted) → use `link` (including `{ type: "none" }` = geen link).
   * `popup` → open modal; body is `popup` (embedded section).
   */
  action?: CmsButtonAction;
  /** Destination when action is link. `{ type: "none" }` = geen link. */
  link: CmsLink;
  /** Embedded section when action is popup. */
  popup?: CmsButtonPopupContent;
};

/** Flat editor mode — maps onto action + link kind. */
export type CmsButtonUiMode = "none" | "page" | "external" | "popup";

export function resolveCmsButtonAction(button: CmsButton): CmsButtonAction {
  return button.action === "popup" ? "popup" : "link";
}

/** Editor/UI mode derived from stored button. */
export function resolveCmsButtonUiMode(button: CmsButton): CmsButtonUiMode {
  if (resolveCmsButtonAction(button) === "popup") return "popup";
  const t = button.link?.type;
  if (t === "external") return "external";
  if (t === "internal" || t === "internal_route") return "page";
  return "none";
}

/** True when the storefront should render a clickable/popup control (not “geen link”). */
export function isCmsButtonInteractive(button: CmsButton | null | undefined): boolean {
  if (!button?.label?.trim()) return false;
  if (resolveCmsButtonAction(button) === "popup") {
    return Boolean(button.popup?.type);
  }
  return button.link.type !== "none";
}

export function isPopupContentBlockType(type: string): type is PopupContentBlockType {
  return (POPUP_CONTENT_BLOCK_TYPES as readonly string[]).includes(type);
}

const popupContentSchema: z.ZodType<CmsButtonPopupContent> = z.object({
  type: z.enum(POPUP_CONTENT_BLOCK_TYPES),
  data: z.record(z.unknown()),
});

/**
 * Permissive shape for drafts. Publish gates use {@link validateCmsButtonForPublish}.
 * Popup type is every BlockType except CTA/popup; unknown types fail parse (normalize recovers).
 */
export const cmsButtonSchema: z.ZodType<CmsButton> = z.object({
  label: z.string().min(1),
  action: z.enum(CMS_BUTTON_ACTIONS).optional(),
  link: cmsLinkSchema,
  popup: popupContentSchema.optional(),
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Normalize legacy `{ label, link }` and incomplete popup drafts into a stable CmsButton.
 * Returns undefined when there is no usable label.
 */
export function normalizeCmsButton(value: unknown): CmsButton | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const label = typeof rec.label === "string" ? rec.label.trim() : "";
  if (!label) return undefined;

  const actionRaw = rec.action === "popup" ? "popup" : rec.action === "link" ? "link" : undefined;
  // Draft-friendly: incomplete external URLs must not collapse to “geen link” in the editor.
  const linkParsed = parseCmsLinkDraft(rec.link) ?? { type: "none" as const };

  let popup: CmsButtonPopupContent | undefined;
  const popupRec = asRecord(rec.popup);
  if (popupRec) {
    const typeRaw = typeof popupRec.type === "string" ? popupRec.type : "";
    const data = asRecord(popupRec.data) ?? {};
    if (isPopupContentBlockType(typeRaw)) {
      popup = { type: typeRaw, data };
    }
  }

  if (actionRaw === "popup") {
    return {
      label,
      action: "popup",
      link: linkParsed,
      popup: popup ?? { type: "richText", data: { title: "", body: "" } },
    };
  }

  return {
    label,
    action: actionRaw,
    link: linkParsed,
    ...(popup ? { popup } : {}),
  };
}

/**
 * Resolve a card/feature CTA from `cta` or legacy `link` (+ default label).
 */
export function resolveLegacyLinkAsCmsButton(
  cta: unknown,
  legacyLink: unknown,
  defaultLabel: string,
): CmsButton | undefined {
  const fromCta = normalizeCmsButton(cta);
  if (fromCta) return fromCta;
  const link = parseCmsLink(legacyLink);
  if (!link || link.type === "none") return undefined;
  return { label: defaultLabel, action: "link", link };
}

export type CmsButtonPublishIssue =
  | { code: "BUTTON_LINK_REQUIRED"; path: Array<string | number> }
  | { code: "BUTTON_POPUP_CONTENT_REQUIRED"; path: Array<string | number> }
  | { code: "BUTTON_POPUP_CONTENT_INVALID"; path: Array<string | number>; message?: string }
  | { code: "BUTTON_INVALID"; path: Array<string | number> };

/**
 * Publish rules for button actions.
 * - `link` (default): shape only — incomplete destinations stay draft-friendly (same as before).
 * - `popup`: requires an allowed content type whose data parses.
 * `parsePopupData` is injected to avoid a content↔registry import cycle.
 */
export function validateCmsButtonForPublish(
  value: unknown,
  basePath: Array<string | number>,
  parsePopupData: (
    type: PopupContentBlockType,
    data: Record<string, unknown>,
  ) => { ok: true } | { ok: false; message?: string },
): CmsButtonPublishIssue[] {
  const normalized = normalizeCmsButton(value);
  if (!normalized) {
    return [{ code: "BUTTON_INVALID", path: basePath }];
  }

  const action = resolveCmsButtonAction(normalized);
  if (action === "link") {
    return [];
  }

  if (!normalized.popup || !isPopupContentBlockType(normalized.popup.type)) {
    return [{ code: "BUTTON_POPUP_CONTENT_REQUIRED", path: [...basePath, "popup"] }];
  }

  const parsed = parsePopupData(normalized.popup.type, normalized.popup.data);
  if (!parsed.ok) {
    return [
      {
        code: "BUTTON_POPUP_CONTENT_INVALID",
        path: [...basePath, "popup"],
        message: parsed.message,
      },
    ];
  }
  return [];
}
