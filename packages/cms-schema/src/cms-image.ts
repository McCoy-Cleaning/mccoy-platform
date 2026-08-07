import { z } from "zod";

/** Shared CMS image model (leaf — no imports from content/types). */
export type CmsImage = {
  assetId: string;
  src: string;
  alt: string;
  decorative: boolean;
  width?: number;
  height?: number;
  focalPoint?: { x: number; y: number };
};

export const cmsImageSchema: z.ZodType<CmsImage> = z.object({
  assetId: z.string().min(1),
  src: z.string().min(1),
  alt: z.string(),
  decorative: z.boolean(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  focalPoint: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
});
