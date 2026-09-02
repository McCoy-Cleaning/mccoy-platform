import { z } from "zod";
import { cmsImageSchema, type CmsImage } from "../cms-image";

function positiveDim(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function optionalFocalPoint(
  value: unknown,
): { x: number; y: number } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  if (typeof rec.x !== "number" || typeof rec.y !== "number") return undefined;
  if (rec.x < 0 || rec.x > 1 || rec.y < 0 || rec.y > 1) return undefined;
  return { x: rec.x, y: rec.y };
}

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
    const width = positiveDim(rec.width);
    const height = positiveDim(rec.height);
    const focalPoint = optionalFocalPoint(rec.focalPoint);
    const parsed = cmsImageSchema.safeParse({
      assetId: typeof rec.assetId === "string" && rec.assetId ? rec.assetId : `legacy_${src.slice(0, 24)}`,
      src,
      alt: typeof rec.alt === "string" ? rec.alt : fallbackAlt,
      decorative: typeof rec.decorative === "boolean" ? rec.decorative : !fallbackAlt,
      ...(width != null ? { width } : {}),
      ...(height != null ? { height } : {}),
      ...(focalPoint ? { focalPoint } : {}),
    });
    return parsed.success ? parsed.data : undefined;
  }
  return undefined;
}

export const optionalCmsImageSchema = z.preprocess(
  (v) => normalizeCmsImage(v) ?? undefined,
  cmsImageSchema.optional(),
);
