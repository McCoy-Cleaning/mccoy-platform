import { z } from "zod";
import { cmsImageSchema, type CmsImage } from "../content";

/** Accept legacy string URLs or partial objects into CmsImage. */
export function normalizeCmsImage(value: unknown, fallbackAlt = ""): CmsImage | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") {
    const src = value.trim();
    if (!src) return undefined;
    return {
      assetId: `legacy_${src.slice(0, 24)}`,
      src,
      alt: fallbackAlt,
      decorative: !fallbackAlt,
    };
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const src =
      typeof rec.src === "string"
        ? rec.src
        : typeof rec.url === "string"
          ? rec.url
          : typeof rec.image === "string"
            ? rec.image
            : "";
    if (!src) return undefined;
    const parsed = cmsImageSchema.safeParse({
      assetId: typeof rec.assetId === "string" && rec.assetId ? rec.assetId : `legacy_${src.slice(0, 24)}`,
      src,
      alt: typeof rec.alt === "string" ? rec.alt : fallbackAlt,
      decorative: typeof rec.decorative === "boolean" ? rec.decorative : !fallbackAlt,
      width: typeof rec.width === "number" ? rec.width : undefined,
      height: typeof rec.height === "number" ? rec.height : undefined,
      focalPoint: rec.focalPoint,
    });
    return parsed.success ? parsed.data : undefined;
  }
  return undefined;
}

export const optionalCmsImageSchema = z.preprocess(
  (v) => normalizeCmsImage(v) ?? undefined,
  cmsImageSchema.optional(),
);
