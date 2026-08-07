import {
  cmsButtonSchema,
  validateCmsButtonForPublish,
  type PopupContentBlockType,
} from "../button";
import type { CmsImage } from "../cms-image";
import type { Block } from "../types";
import type {
  BeforeAfterBlockData,
  CarouselBlockData,
  ContactFormBlockData,
  GalleryBlockData,
  NewsletterBlockData,
  PopupBlockData,
  VideoBlockData,
} from "./catalog";
import { validateJobsForPublishErrors } from "./jobs";
import type { PlansBlockData } from "./plans";
import { getBlockDataDefinition, parseBlockData } from "./registry";
import type { RoadmapBlockData } from "./roadmap";
import {
  PUBLISH_VALIDATION_CODES,
  type PublishValidationError,
  type PublishValidationPath,
} from "./validation-codes";
import { resolveSafeVideoEmbed } from "./video-embed";

/** Shown in admin before save/publish when `capabilities.publishable === false`. */
export const UNPUBLISHABLE_BLOCK_WARNING_NL =
  "Deze sectie kan nog niet worden gepubliceerd omdat er geen werkende formulierafhandeling is ingesteld.";

function err(
  code: PublishValidationError["code"],
  path: PublishValidationPath,
  extras?: Partial<PublishValidationError>,
): PublishValidationError {
  return { code, path, ...extras };
}

function imageNeedsAlt(image: CmsImage | undefined | null): boolean {
  if (!image) return false;
  if (image.decorative) return false;
  return !image.alt?.trim();
}

function walkBlockButtons(
  data: unknown,
  basePath: PublishValidationPath,
): Array<{ value: unknown; path: PublishValidationPath }> {
  const out: Array<{ value: unknown; path: PublishValidationPath }> = [];
  if (!data || typeof data !== "object") return out;
  const rec = data as Record<string, unknown>;
  for (const key of ["cta", "secondaryCta"] as const) {
    if (rec[key] != null) out.push({ value: rec[key], path: [...basePath, key] });
  }
  if (Array.isArray(rec.plans)) {
    rec.plans.forEach((plan, index) => {
      if (!plan || typeof plan !== "object") return;
      const row = plan as Record<string, unknown>;
      if (row.cta != null) out.push({ value: row.cta, path: [...basePath, "plans", index, "cta"] });
    });
  }
  if (Array.isArray(rec.features)) {
    rec.features.forEach((feat, index) => {
      if (!feat || typeof feat !== "object") return;
      const row = feat as Record<string, unknown>;
      if (row.cta != null) out.push({ value: row.cta, path: [...basePath, "features", index, "cta"] });
    });
  }
  return out;
}

function collectButtonPublishErrors(
  block: Block,
  blockLabel: string,
): PublishValidationError[] {
  const errors: PublishValidationError[] = [];
  const buttons = walkBlockButtons(block.data, [block.id]);

  const pushIssues = (
    issues: ReturnType<typeof validateCmsButtonForPublish>,
  ) => {
    for (const issue of issues) {
      const code =
        issue.code === "BUTTON_LINK_REQUIRED"
          ? PUBLISH_VALIDATION_CODES.BUTTON_LINK_REQUIRED
          : issue.code === "BUTTON_POPUP_CONTENT_REQUIRED"
            ? PUBLISH_VALIDATION_CODES.BUTTON_POPUP_CONTENT_REQUIRED
            : issue.code === "BUTTON_POPUP_CONTENT_INVALID"
              ? PUBLISH_VALIDATION_CODES.BUTTON_POPUP_CONTENT_INVALID
              : PUBLISH_VALIDATION_CODES.BUTTON_INVALID;
      errors.push(
        err(code, issue.path, {
          blockType: block.type,
          blockLabel,
          message: "message" in issue ? issue.message : undefined,
        }),
      );
    }
  };

  for (const { value, path } of buttons) {
    pushIssues(
      validateCmsButtonForPublish(value, path, (type, data) => {
        const parsed = parseBlockData(type as PopupContentBlockType, data);
        if (!parsed.ok) return { ok: false as const, message: parsed.error };
        return { ok: true as const };
      }),
    );

    const btnParsed = cmsButtonSchema.safeParse(value);
    if (!btnParsed.success || btnParsed.data.action !== "popup" || !btnParsed.data.popup) {
      continue;
    }

    // One nesting level: CTAs inside popup content may only use link (no popup-in-popup).
    for (const nested of walkBlockButtons(btnParsed.data.popup.data, [...path, "popup", "data"])) {
      const nestedBtn = cmsButtonSchema.safeParse(nested.value);
      if (nestedBtn.success && nestedBtn.data.action === "popup") {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.BUTTON_POPUP_CONTENT_INVALID, nested.path, {
            blockType: block.type,
            blockLabel,
            message: "Popup in popup is niet toegestaan — kies een pagina/link.",
          }),
        );
      }
    }
  }
  return errors;
}

function collectMediaPublishErrors(block: Block): PublishValidationError[] {
  const errors: PublishValidationError[] = [];
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return errors;
  const base = [block.id];

  if (block.type === "video") {
    const data = parsed.data as VideoBlockData;
    if (!data.title?.trim()) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.VIDEO_TITLE_REQUIRED, [...base, "title"], {
          blockType: block.type,
        }),
      );
    }
    const embed = resolveSafeVideoEmbed(data.videoUrl ?? "");
    if (!embed.ok) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.VIDEO_URL_INVALID, [...base, "videoUrl"], {
          blockType: block.type,
          message: embed.reason,
        }),
      );
    }
    if (imageNeedsAlt(data.poster)) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.VIDEO_POSTER_ALT_REQUIRED, [...base, "poster", "alt"], {
          blockType: block.type,
        }),
      );
    }
  }

  if (block.type === "beforeAfter") {
    const data = parsed.data as BeforeAfterBlockData;
    if (!data.before || !data.after) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.BEFORE_AFTER_IMAGE_MISSING, [...base], {
          blockType: block.type,
        }),
      );
    } else {
      if (imageNeedsAlt(data.before)) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.BEFORE_AFTER_ALT_REQUIRED, [...base, "before", "alt"], {
            blockType: block.type,
          }),
        );
      }
      if (imageNeedsAlt(data.after)) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.BEFORE_AFTER_ALT_REQUIRED, [...base, "after", "alt"], {
            blockType: block.type,
          }),
        );
      }
    }
  }

  if (block.type === "gallery") {
    const data = parsed.data as GalleryBlockData;
    if (!data.images?.length) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.GALLERY_EMPTY, [...base, "images"], {
          blockType: block.type,
        }),
      );
    } else {
      data.images.forEach((item, index) => {
        if (imageNeedsAlt(item.image)) {
          errors.push(
            err(
              PUBLISH_VALIDATION_CODES.GALLERY_IMAGE_ALT_REQUIRED,
              [...base, "images", index, "image", "alt"],
              { blockType: block.type },
            ),
          );
        }
      });
    }
  }

  if (block.type === "carousel") {
    const data = parsed.data as CarouselBlockData;
    if (!data.slides?.length) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.CAROUSEL_EMPTY, [...base, "slides"], {
          blockType: block.type,
        }),
      );
    }
  }

  return errors;
}

function collectContentPublishErrors(block: Block): PublishValidationError[] {
  const errors: PublishValidationError[] = [];
  const base = [block.id];
  const def = getBlockDataDefinition(block.type);

  if (block.type === "hero") {
    const parsed = parseBlockData(block.type, block.data);
    if (parsed.ok) {
      const data = parsed.data as { title?: string };
      if (!data.title?.trim()) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.HERO_TITLE_REQUIRED, [...base, "title"], {
            blockType: block.type,
            blockLabel: def.label,
          }),
        );
      }
    }
  }

  if (block.type === "jobs") {
    errors.push(...validateJobsForPublishErrors(block.data, block.id));
  }

  if (block.type === "roadmap") {
    const parsed = parseBlockData(block.type, block.data);
    if (!parsed.ok) return errors;
    const data = parsed.data as RoadmapBlockData;
    data.milestones.forEach((milestone, index) => {
      if (!milestone.title.trim()) {
        errors.push(
          err(
            PUBLISH_VALIDATION_CODES.ROADMAP_MILESTONE_TITLE_REQUIRED,
            [...base, "milestones", index, "title"],
            { blockType: block.type },
          ),
        );
      }
    });
  }

  if (block.type === "plans") {
    // Reject invalid CTAs on raw data so normalize cannot silently strip them at publish time.
    const plansRaw = Array.isArray(block.data.plans) ? block.data.plans : [];
    plansRaw.forEach((plan, index) => {
      if (!plan || typeof plan !== "object") return;
      const row = plan as Record<string, unknown>;
      if (!("cta" in row) || row.cta == null) return;
      const ctaParsed = cmsButtonSchema.safeParse(row.cta);
      if (!ctaParsed.success) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.PLANS_CTA_INVALID, [...base, "plans", index, "cta"], {
            blockType: block.type,
          }),
        );
      }
    });
    const parsed = parseBlockData(block.type, block.data);
    if (parsed.ok) {
      const data = parsed.data as PlansBlockData;
      const featureIds = new Set(data.features.map((f) => f.id));
      data.plans.forEach((plan, planIndex) => {
        plan.includedFeatureIds.forEach((fid, fidIndex) => {
          if (!featureIds.has(fid)) {
            errors.push(
              err(
                PUBLISH_VALIDATION_CODES.PLANS_UNKNOWN_FEATURE,
                [...base, "plans", planIndex, "includedFeatureIds", fidIndex],
                { blockType: block.type, message: fid },
              ),
            );
          }
        });
      });
    }
  }

  if (block.type === "newsletter") {
    const parsed = parseBlockData(block.type, block.data);
    if (parsed.ok) {
      const data = parsed.data as NewsletterBlockData;
      if (!data.title.trim()) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.NEWSLETTER_TITLE_REQUIRED, [...base, "title"], {
            blockType: block.type,
          }),
        );
      }
      if (!data.buttonLabel.trim()) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.NEWSLETTER_BUTTON_REQUIRED, [...base, "buttonLabel"], {
            blockType: block.type,
          }),
        );
      }
    }
  }

  if (block.type === "contactForm") {
    const parsed = parseBlockData(block.type, block.data);
    if (parsed.ok) {
      const data = parsed.data as ContactFormBlockData;
      if (!data.title.trim()) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.CONTACT_FORM_TITLE_REQUIRED, [...base, "title"], {
            blockType: block.type,
          }),
        );
      }
      const labeled = data.fields.filter((f) => f.label.trim().length > 0);
      for (const field of labeled) {
        if (field.type === "select" && !(field.options?.length ?? 0)) {
          errors.push(
            err(PUBLISH_VALIDATION_CODES.CONTACT_FORM_SELECT_OPTIONS_REQUIRED, [...base, "fields"], {
              blockType: block.type,
            }),
          );
        }
      }
    }
  }

  if (block.type === "popup") {
    const parsed = parseBlockData(block.type, block.data);
    if (parsed.ok) {
      const data = parsed.data as PopupBlockData;
      if (!data.title.trim()) {
        errors.push(
          err(PUBLISH_VALIDATION_CODES.POPUP_TITLE_REQUIRED, [...base, "title"], {
            blockType: block.type,
          }),
        );
      }
    }
  }

  errors.push(...collectMediaPublishErrors(block));
  errors.push(...collectButtonPublishErrors(block, def.label));
  return errors;
}

/**
 * Publish-time block validation with structured codes.
 * Admin maps `code` → Dutch via `validation-messages.nl.ts`.
 */
export function validatePageBlocksForPublish(
  blocks: Block[],
): { ok: true } | { ok: false; errors: PublishValidationError[] } {
  const errors: PublishValidationError[] = [];
  for (const block of blocks) {
    const def = getBlockDataDefinition(block.type);
    if (!def.capabilities.publishable) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.BLOCK_UNPUBLISHABLE, [block.id], {
          blockType: block.type,
          blockLabel: def.label,
          message: UNPUBLISHABLE_BLOCK_WARNING_NL,
        }),
      );
      continue;
    }
    const parsed = parseBlockData(block.type, block.data);
    if (!parsed.ok) {
      errors.push(
        err(PUBLISH_VALIDATION_CODES.BLOCK_DATA_INVALID, [block.id], {
          blockType: block.type,
          blockLabel: def.label,
          message: parsed.error,
        }),
      );
      continue;
    }
    errors.push(...collectContentPublishErrors(block));
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** @deprecated Prefer structured `errors[].code` + NL map. */
export function formatPublishValidationErrors(errors: PublishValidationError[]): string[] {
  return errors.map((e) => {
    const label = e.blockLabel ?? e.blockType ?? "";
    const prefix = label ? `Sectie "${label}"${e.blockType ? ` (${e.blockType})` : ""}: ` : "";
    if (e.message) return `${prefix}${e.message}`;
    return `${prefix}${e.code}`;
  });
}
