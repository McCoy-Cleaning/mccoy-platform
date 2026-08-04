import { z } from "zod";
import type { CmsImage } from "./content";
import {
  DEFAULT_JOB_APPLICATION_FIELDS,
  formFieldItemSchema,
  normalizeFormFields,
  type FormFieldItem,
} from "./blocks/form-fields";
import {
  formScopeSnapshotSchema,
  normalizeFormScopeSnapshot,
  type FormScopeSnapshot,
} from "./form-scope";

/** Default Facebook video used on the vacatures application band. */
export const DEFAULT_VACATURES_FACEBOOK_VIDEO_URL =
  "https://www.facebook.com/McCoyCleaning/videos/4269581773264540/";
export const DEFAULT_VACATURES_FACEBOOK_SHARE_URL =
  "https://www.facebook.com/share/v/1E8ftFTuKV/";

export type VacaturesApplicationMediaVideo = {
  kind: "video";
  videoUrl: string;
  /** Optional “Open op Facebook” (or other) share / watch link. */
  shareUrl?: string;
};

export type VacaturesApplicationMediaImage = {
  kind: "image";
  image: CmsImage;
};

export type VacaturesApplicationMedia =
  | VacaturesApplicationMediaVideo
  | VacaturesApplicationMediaImage;

/**
 * Sollicitatieformulier + side media on /vacatures.
 * Name/email are always built-in on the storefront; `fields` are configurable extras.
 */
export type VacaturesApplicationContent = {
  /** Eyebrow above the form (default: Sollicitatieformulier). */
  formEyebrow?: string;
  /** Intro under the dynamic vacancy title. */
  formIntro?: string;
  fields: FormFieldItem[];
  mediaEyebrow?: string;
  mediaHeading?: string;
  /** Overlay badge on video (e.g. “McCoy on Facebook”). */
  mediaBadge?: string;
  mediaLinkLabel?: string;
  media: VacaturesApplicationMedia;
  applicationScope?: FormScopeSnapshot;
};

const cmsImageSchemaLocal: z.ZodType<CmsImage> = z.object({
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

const vacaturesApplicationMediaSchema: z.ZodType<VacaturesApplicationMedia> = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("video"),
      videoUrl: z.string(),
      shareUrl: z.string().optional(),
    }),
    z.object({
      kind: z.literal("image"),
      image: cmsImageSchemaLocal,
    }),
  ],
);

export const vacaturesApplicationContentSchema: z.ZodType<VacaturesApplicationContent> = z.object({
  formEyebrow: z.string().optional(),
  formIntro: z.string().optional(),
  fields: z.array(formFieldItemSchema),
  mediaEyebrow: z.string().optional(),
  mediaHeading: z.string().optional(),
  mediaBadge: z.string().optional(),
  mediaLinkLabel: z.string().optional(),
  media: vacaturesApplicationMediaSchema,
  applicationScope: formScopeSnapshotSchema.optional(),
});

export function defaultVacaturesApplicationMedia(): VacaturesApplicationMedia {
  return {
    kind: "video",
    videoUrl: DEFAULT_VACATURES_FACEBOOK_VIDEO_URL,
    shareUrl: DEFAULT_VACATURES_FACEBOOK_SHARE_URL,
  };
}

export function defaultVacaturesApplicationContent(
  legacyScope?: FormScopeSnapshot,
): VacaturesApplicationContent {
  return {
    formEyebrow: "Sollicitatieformulier",
    formIntro:
      "Vul je gegevens in, upload je CV en motivatiebrief. Wij reageren binnen 5 werkdagen — altijd persoonlijk.",
    fields: DEFAULT_JOB_APPLICATION_FIELDS.map((field) => ({ ...field })),
    mediaEyebrow: "Maak kennis met McCoy",
    mediaHeading:
      "Een korte blik achter de schermen — de mensen, het vakmanschap en de standaard die wij elke dag waarmaken.",
    mediaBadge: "McCoy on Facebook",
    mediaLinkLabel: "Open op Facebook",
    media: defaultVacaturesApplicationMedia(),
    applicationScope: legacyScope,
  };
}

function normalizeVacaturesMedia(raw: unknown): VacaturesApplicationMedia {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    if (rec.kind === "image") {
      const image = cmsImageSchemaLocal.safeParse(rec.image);
      if (image.success) {
        return { kind: "image", image: image.data };
      }
    }
    if (rec.kind === "video" || typeof rec.videoUrl === "string") {
      const videoUrl =
        typeof rec.videoUrl === "string" && rec.videoUrl.trim()
          ? rec.videoUrl.trim()
          : DEFAULT_VACATURES_FACEBOOK_VIDEO_URL;
      const shareUrl =
        typeof rec.shareUrl === "string" && rec.shareUrl.trim()
          ? rec.shareUrl.trim()
          : undefined;
      return { kind: "video", videoUrl, shareUrl };
    }
  }
  return defaultVacaturesApplicationMedia();
}

/**
 * Normalize legacy / partial JSON into {@link VacaturesApplicationContent}.
 * Optionally inherits applicationScope from vacatures.main chrome.
 */
export function normalizeVacaturesApplicationContent(
  raw: unknown,
  legacyScope?: FormScopeSnapshot,
): VacaturesApplicationContent {
  const base = defaultVacaturesApplicationContent(legacyScope);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const rec = raw as Record<string, unknown>;
  const fields = normalizeFormFields(rec.fields);
  const scope =
    normalizeFormScopeSnapshot(rec.applicationScope) ?? legacyScope ?? undefined;

  return {
    formEyebrow:
      typeof rec.formEyebrow === "string" ? rec.formEyebrow : base.formEyebrow,
    formIntro: typeof rec.formIntro === "string" ? rec.formIntro : base.formIntro,
    fields: fields.length > 0 ? fields : base.fields,
    mediaEyebrow:
      typeof rec.mediaEyebrow === "string" ? rec.mediaEyebrow : base.mediaEyebrow,
    mediaHeading:
      typeof rec.mediaHeading === "string" ? rec.mediaHeading : base.mediaHeading,
    mediaBadge:
      typeof rec.mediaBadge === "string" ? rec.mediaBadge : base.mediaBadge,
    mediaLinkLabel:
      typeof rec.mediaLinkLabel === "string" ? rec.mediaLinkLabel : base.mediaLinkLabel,
    media: normalizeVacaturesMedia(rec.media),
    applicationScope: scope,
  };
}
