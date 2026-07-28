import * as React from "react";
import {
  FIXED_SECTION_DEFS,
  type AboutMainContent,
  type CmsImage,
  type CmsLink,
  type CmsMutation,
  type FixedSectionKey,
  type HomeHeroContent,
  type FormPageChromeContent,
  type VacaturesMainContent,
  type ContactInfoContent,
  type ContactInfoItem,
  type ContactFormContent,
  type PartnersContent,
  type PageSectionContent,
  type ProductsMainContent,
  type ProductsInfoContent,
  type ServicesMainContent,
  type StatsContent,
  type WorkGalleryContent,
  type ServiceCard,
  type ProductCard,
  type LegalMainContent,
  type LegalArticle,
  cmsLinkSchema,
  createItemId,
  externalImage,
  isSafeExternalUrl,
  localImage,
  resolveLogoBackdrop,
  type LogoBackdropPreference,
} from "@mccoy/cms-schema";
import { HomeHeroView, FormPageChromeView } from "@mccoy/cms-renderer";
import { cn } from "@mccoy/ui";
import { compressProfileFromTags } from "./compress-image";
import {
  CMS_MAX_SOURCE_IMAGE_BYTES,
  readUploadedImages,
  removeUploadedImage,
  type CmsUploadedImageEntry,
} from "./uploaded-images";
import { RegisteredBlockEditor } from "./blocks/RegisteredBlockEditor";
import { ObjectListEditor } from "./blocks/ObjectListEditor";
import { StringListEditor } from "./blocks/StringListEditor";
import { RoadmapBlockEditor } from "./blocks/RoadmapBlockEditor";
import { PlansBlockEditor } from "./blocks/PlansBlockEditor";
import { HeroBlockEditor } from "./blocks/HeroBlockEditor";
import { TextImageBlockEditor } from "./blocks/TextImageBlockEditor";
import { CtaBlockEditor } from "./blocks/CtaBlockEditor";
import { FeatureGridBlockEditor } from "./blocks/FeatureGridBlockEditor";
import { CarouselBlockEditor, GalleryBlockEditor } from "./blocks/GalleryBlockEditor";
import { JobsBlockEditor, TeamGridBlockEditor } from "./blocks/TeamJobsBlockEditor";
import { FormScopeField } from "./blocks/FormScopeField";
import {
  StructuredLinkField,
  PAGE_DESTINATION_LINK_KINDS,
} from "./blocks/StructuredLinkField";
import {
  blockEditorRegistry,
  getRegisteredBlockEditor,
  getBlockEditorDefinition,
  listBlockTypesMissingDedicatedEditor,
  listUnsupportedPublishableBlockTypes,
} from "./blocks/blockEditorRegistry";
import {
  CTA_SUPPORTED_PATHS,
  imageSupportedPaths,
  type BlockEditorDefinition,
  type EditorQuality,
} from "./blocks/editor-definition";
import { BulkImageAddButton, ImageStripPreview } from "./BulkImageAdd";
import type { CmsImagePickerProps } from "./image-picker-props";

export {
  RegisteredBlockEditor,
  ObjectListEditor,
  StringListEditor,
  RoadmapBlockEditor,
  PlansBlockEditor,
  HeroBlockEditor,
  TextImageBlockEditor,
  CtaBlockEditor,
  FeatureGridBlockEditor,
  GalleryBlockEditor,
  CarouselBlockEditor,
  TeamGridBlockEditor,
  JobsBlockEditor,
  StructuredLinkField,
  PAGE_DESTINATION_LINK_KINDS,
  blockEditorRegistry,
  getRegisteredBlockEditor,
  getBlockEditorDefinition,
  listBlockTypesMissingDedicatedEditor,
  listUnsupportedPublishableBlockTypes,
  CTA_SUPPORTED_PATHS,
  imageSupportedPaths,
  BulkImageAddButton,
  ImageStripPreview,
};

export type { CmsImagePickerProps, BlockEditorDefinition, EditorQuality };

export {
  CMS_MAX_IMAGE_UPLOAD_BYTES,
  CMS_MAX_SOURCE_IMAGE_BYTES,
  CMS_MAX_STORED_IMAGE_BYTES,
  compressProfileFromTags,
  prepareCmsImageUpload,
  validateImageUploadFile,
  type CmsImageCompressProfile,
  type PrepareCmsImageResult,
} from "./compress-image";

export {
  CmsAiAssistProvider,
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
  defaultMaxCharsForField,
  isTranslatableFieldKey,
  useCmsAiAssist,
  type CmsAiAssistApi,
  type CmsAiGenerateRequest,
  type CmsAiGenerateResponse,
  type CmsAiGenerateSectionRequest,
  type CmsAiGenerateSectionResponse,
  type CmsAiTone,
  type CmsAiTranslateRequest,
  type CmsAiTranslateResponse,
} from "./ai-assist";
import {
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
  isTranslatableFieldKey,
} from "./ai-assist";

export type CmsSelection =
  | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
  | { kind: "block"; blockId: string; layoutItemId: string }
  | null;

/** Capture-phase guards for Bewerken / Preview.
 * - edit: block navigation (links) and form submit; do NOT stopPropagation so section selection still works
 * - preview: allow navigation/CTAs; still block form submit to avoid production side effects
 */
export function EditInteractionGuard({
  children,
  mode,
  onBlockedAction,
}: {
  children: React.ReactNode;
  mode: "edit" | "preview" | "off";
  onBlockedAction?: (kind: "navigate" | "submit") => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (mode === "off") return;
    const root = ref.current;
    if (!root) return;

    const onClick = (e: MouseEvent) => {
      if (mode !== "edit") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;

      // Router buttons / role=link without <a>
      const interactive = t.closest("a, button[data-cms-nav], [data-cms-navigate]");
      if (interactive instanceof HTMLAnchorElement || interactive?.getAttribute("data-cms-nav") != null) {
        e.preventDefault();
        // Intentionally no stopPropagation — FixedSelectChrome capture/bubble must still select.
        onBlockedAction?.("navigate");
      }
    };
    const onSubmit = (e: Event) => {
      // Block real form side effects in both edit and preview.
      e.preventDefault();
      e.stopPropagation();
      onBlockedAction?.("submit");
    };

    root.addEventListener("click", onClick, true);
    root.addEventListener("submit", onSubmit, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("submit", onSubmit, true);
    };
  }, [mode, onBlockedAction]);

  return (
    <div ref={ref} data-cms-edit-guard={mode} className="contents">
      {children}
    </div>
  );
}

export function SectionSelectFrame({
  sectionKey,
  selected,
  onSelect,
  children,
}: {
  sectionKey: FixedSectionKey;
  selected: boolean;
  onSelect: (key: FixedSectionKey) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Selecteer sectie ${FIXED_SECTION_DEFS[sectionKey]?.label ?? sectionKey}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect(sectionKey);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(sectionKey);
        }
      }}
      className={cn(
        "relative outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected &&
          "z-[1] ring-2 ring-sky-400 ring-offset-2 ring-offset-background shadow-[0_0_0_4px_rgba(56,189,248,0.18)]",
      )}
    >
      {children}
      {selected ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          {FIXED_SECTION_DEFS[sectionKey]?.label ?? sectionKey}
        </span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/12 bg-[#161920] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 [color-scheme:dark]";

const selectClass = cn(
  inputClass,
  "cursor-pointer appearance-none bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat pr-9",
  "bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%23ffffff99%22 stroke-width=%222%22%3E%3Cpath d=%22M3 4.5 6 7.5 9 4.5%22/%3E%3C/svg%3E')]",
);

const optionClass = "bg-[#161920] text-white";

const iconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

const addBtnClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50";

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function RemoveIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={iconBtnClass} aria-label={label} title={label} onClick={onClick}>
      <TrashIcon />
    </button>
  );
}

export function PrototypeImageField({
  value,
  onChange,
  onClear,
  projectImages = [],
  assetBaseUrl,
  preferTags = [],
  compact = true,
  label = "Afbeelding",
  allowUpload = true,
  uploadToMediaLibrary,
  mediaLibraryItems = [],
  resolveProjectImage,
}: {
  value: CmsImage;
  onChange: (next: CmsImage) => void;
  /** When set, shows an accessible remove control (optional single images). */
  onClear?: () => void;
  projectImages?: Array<{ path: string; label: string; tags?: string[] }>;
  /** Absolute origin where `/images/...` is served (admin ≠ storefront port). */
  assetBaseUrl?: string;
  preferTags?: string[];
  compact?: boolean;
  label?: string;
  /** Local file → media library (preferred) or legacy data-URL library. */
  allowUpload?: boolean;
  uploadToMediaLibrary?: ImagePickerProps["uploadToMediaLibrary"];
  mediaLibraryItems?: ImagePickerProps["mediaLibraryItems"];
  resolveProjectImage?: ImagePickerProps["resolveProjectImage"];
}) {
  const [urlDraft, setUrlDraft] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [broken, setBroken] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [uploads, setUploads] = React.useState<CmsUploadedImageEntry[]>([]);
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setUploads(readUploadedImages());
  }, []);

  const mediaSrc = React.useCallback(
    (src: string) => {
      if (!src) return "";
      if (/^(https?:|data:|blob:)/i.test(src)) return src;
      if (!assetBaseUrl) return src;
      const path = src.startsWith("/") ? src : `/${src}`;
      return `${assetBaseUrl.replace(/\/$/, "")}${path}`;
    },
    [assetBaseUrl],
  );

  /** Prefer seeded Supabase catalog URL over admin-origin `/images/...` (404). */
  const projectThumbSrc = React.useCallback(
    (path: string) => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      const resolved = resolveProjectImage?.(normalized) ?? resolveProjectImage?.(path);
      if (resolved?.src) return mediaSrc(resolved.src);
      return mediaSrc(path);
    },
    [resolveProjectImage, mediaSrc],
  );

  const previewSrc = mediaSrc(value.src);
  React.useEffect(() => {
    setBroken(false);
  }, [previewSrc]);

  const { scoped, rest } = React.useMemo(() => {
    if (preferTags.length === 0) return { scoped: projectImages, rest: [] as typeof projectImages };
    const score = (img: { tags?: string[] }) =>
      preferTags.reduce((n, tag) => n + (img.tags?.includes(tag) ? 1 : 0), 0);
    const byScore = (a: (typeof projectImages)[number], b: (typeof projectImages)[number]) =>
      score(b) - score(a) || a.label.localeCompare(b.label);
    const matches = (img: { tags?: string[] }) => preferTags.some((tag) => img.tags?.includes(tag));
    return {
      scoped: projectImages.filter(matches).sort(byScore),
      rest: projectImages.filter((img) => !matches(img)).sort(byScore),
    };
  }, [projectImages, preferTags]);

  const pathMatchesValue = React.useCallback(
    (path: string) => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      if (value.src === normalized || value.src.endsWith(normalized)) return true;
      const resolved = resolveProjectImage?.(normalized) ?? resolveProjectImage?.(path);
      return Boolean(resolved && resolved.assetId === value.assetId);
    },
    [value.src, value.assetId, resolveProjectImage],
  );

  const uploadMatchesValue = React.useCallback(
    (entry: CmsUploadedImageEntry) =>
      value.assetId === entry.image.assetId || value.src === entry.image.src,
    [value.assetId, value.src],
  );

  const ordered = React.useMemo(() => {
    const base = showAll || preferTags.length === 0 ? [...scoped, ...rest] : [...scoped];
    // Keep the active image visible even when it sits outside the scoped tags.
    if (value.src && !base.some((img) => pathMatchesValue(img.path))) {
      const orphan = projectImages.find((img) => pathMatchesValue(img.path));
      if (orphan) return [orphan, ...base];
    }
    return base;
  }, [showAll, preferTags.length, scoped, rest, projectImages, value.src, pathMatchesValue]);

  const applyLocalPath = (path: string, altFallback?: string) => {
    const src = path.startsWith("/") ? path : `/${path}`;
    const resolved = resolveProjectImage?.(src) ?? resolveProjectImage?.(path);
    if (resolved) {
      onChange({
        ...resolved,
        alt: value.alt || resolved.alt || altFallback || label,
        decorative: value.decorative,
      });
      setUploadStatus("Projectfoto gekoppeld via mediabibliotheek (Supabase).");
      return;
    }
    onChange({
      assetId: `local:${src.replace(/^\//, "")}`,
      src,
      alt: value.alt || altFallback || label,
      decorative: value.decorative,
    });
    if (uploadToMediaLibrary) {
      setUploadStatus(
        "Lokale projectfoto gekozen — run seed-cms-media of upload opnieuw voor Storage.",
      );
    }
  };

  const applyUpload = (entry: CmsUploadedImageEntry) => {
    onChange({
      ...entry.image,
      alt: value.alt || entry.image.alt || entry.label || label,
      decorative: value.decorative,
    });
  };

  const onUploadFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadStatus(null);
    setUploadBusy(true);
    setUploadStatus(uploadToMediaLibrary ? "Uploaden naar mediabibliotheek…" : "Afbeelding comprimeren…");
    try {
      if (uploadToMediaLibrary) {
        const result = await uploadToMediaLibrary({
          file,
          profile: compressProfileFromTags(preferTags),
          tags: preferTags,
          alt: value.alt || label,
        });
        if (!result.ok) {
          setUploadStatus(null);
          setUploadError(result.reason);
          return;
        }
        onChange({
          ...result.image,
          alt: value.alt || result.image.alt || result.label || label,
          decorative: value.decorative,
        });
        setUploadStatus(
          result.reused
            ? "Bestaande afbeelding uit bibliotheek hergebruikt."
            : "Geüpload naar mediabibliotheek en als actief gezet.",
        );
        return;
      }
      setUploadStatus(null);
      setUploadError(
        "Mediabibliotheek-upload ontbreekt — data-URL embeds zijn uitgeschakeld. Herlaad de admin-pagina.",
      );
    } catch {
      setUploadStatus(null);
      setUploadError("Uploaden mislukt. Probeer een ander bestand.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemoveUpload = (entry: CmsUploadedImageEntry) => {
    const result = removeUploadedImage(entry.id);
    if (!result.ok) {
      setUploadError(result.reason);
      return;
    }
    setUploads(readUploadedImages());
    if (uploadMatchesValue(entry)) {
      setUploadStatus("Actieve upload verwijderd uit bibliotheek — kies een andere afbeelding.");
    }
  };

  const isSelected = pathMatchesValue;
  const cols = compact ? 4 : 3;
  const maxMb = Math.round(CMS_MAX_SOURCE_IMAGE_BYTES / (1024 * 1024));

  return (
    <div className={cn("space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5", compact && "p-2")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{label}</p>
        <div className="flex items-center gap-2">
          {broken ? <span className="text-[10px] text-amber-300">Afbeelding niet geladen</span> : null}
          {onClear ? (
            <button
              type="button"
              className={iconBtnClass}
              aria-label={`${label} verwijderen`}
              title="Afbeelding verwijderen"
              onClick={onClear}
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>

      {/* Fixed max height so missing Tailwind aspect utilities cannot blow up the drawer. */}
      <div
        className="relative overflow-hidden rounded-lg border border-white/10 bg-black/40"
        style={{ aspectRatio: compact ? "16 / 10" : "16 / 9", maxHeight: compact ? 9 * 16 : 11 * 16 }}
      >
        {!broken && previewSrc ? (
          <img
            src={previewSrc}
            alt={value.decorative ? "" : value.alt || label}
            className="h-full w-full object-contain"
            style={{ backgroundColor: "#0b0d12" }}
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center text-[11px] text-white/40">
            Geen voorvertoning — kies of upload hieronder
          </div>
        )}
      </div>

      {allowUpload ? (
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-white/45">
              {uploadToMediaLibrary
                ? "Mediabibliotheek (Supabase Storage)"
                : `Eigen uploads${uploads.length > 0 ? ` (${uploads.length})` : ""}`}
            </p>
            <button
              type="button"
              className="rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={uploadBusy}
              aria-busy={uploadBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadBusy
                ? uploadToMediaLibrary
                  ? "Uploaden…"
                  : "Comprimeren…"
                : "Bestand uploaden"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              aria-label={`${label} uploaden`}
              disabled={uploadBusy}
              onChange={(e) => void onUploadFiles(e.target.files)}
            />
          </div>
          <p className="text-[10px] text-white/35">
            {uploadToMediaLibrary
              ? "PNG, JPG, WebP of GIF · gecomprimeerd en opgeslagen in Supabase Storage"
              : `PNG, JPG, WebP of GIF · max ${maxMb}MB bronbestand · wordt automatisch gecomprimeerd`}
          </p>
          {uploadError ? (
            <p className="text-xs text-red-300" role="alert">
              {uploadError}
            </p>
          ) : null}
          {uploadStatus ? (
            <p className="text-xs text-emerald-300/90" role="status">
              {uploadStatus}
            </p>
          ) : null}
          {uploadToMediaLibrary && mediaLibraryItems.length > 0 ? (
            <div
              className="grid max-h-40 gap-1.5 overflow-y-auto"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              role="listbox"
              aria-label={`${label} uit mediabibliotheek`}
            >
              {mediaLibraryItems.slice(0, 24).map((entry) => {
                const selected =
                  value.assetId === entry.image.assetId || value.src === entry.image.src;
                return (
                  <button
                    key={entry.image.assetId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={entry.label}
                    onClick={() =>
                      onChange({
                        ...entry.image,
                        alt: value.alt || entry.image.alt || entry.label || label,
                        decorative: value.decorative,
                      })
                    }
                    className={cn(
                      "group relative h-14 w-full overflow-hidden rounded-md border bg-black/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      selected
                        ? "border-primary ring-2 ring-primary/60"
                        : "border-white/10 hover:border-white/35",
                    )}
                  >
                    <img
                      src={entry.image.src}
                      alt=""
                      className="h-full w-full object-contain p-1 transition group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                    {selected ? (
                      <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">
                        Actief
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {!uploadToMediaLibrary && uploads.length > 0 ? (
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              role="listbox"
              aria-label={`${label} uit eigen uploads`}
            >
              {uploads.map((entry) => {
                const selected = uploadMatchesValue(entry);
                return (
                  <div key={entry.id} className="relative">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      title={entry.label}
                      onClick={() => applyUpload(entry)}
                      className={cn(
                        "group relative h-14 w-full overflow-hidden rounded-md border bg-black/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        selected
                          ? "border-primary ring-2 ring-primary/60"
                          : "border-white/10 hover:border-white/35",
                      )}
                    >
                      <img
                        src={entry.image.src}
                        alt=""
                        className="h-full w-full object-contain p-1 transition group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      {selected ? (
                        <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">
                          Actief
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/70 text-white/70 transition hover:border-red-400/50 hover:bg-red-400/20 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                      aria-label={`${entry.label} uit uploads verwijderen`}
                      title="Upload verwijderen"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveUpload(entry);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          {!uploadToMediaLibrary && uploads.length === 0 ? (
            <p className="text-[10px] text-white/40">Nog geen uploads — kies een bestand om te beginnen.</p>
          ) : null}
        </div>
      ) : null}

      {projectImages.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-white/45">
              {preferTags.length > 0 && !showAll
                ? `Projectfoto's (${ordered.length})`
                : "Klik een projectfoto om te wisselen"}
            </p>
            {rest.length > 0 ? (
              <button
                type="button"
                className="text-[10px] font-medium text-sky-300/90 hover:text-sky-200"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Alleen relevante" : "Toon alle foto's"}
              </button>
            ) : null}
          </div>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            role="listbox"
            aria-label={`${label} kiezen`}
          >
            {ordered.map((img) => {
              const selected = isSelected(img.path);
              const thumbSrc = projectThumbSrc(img.path);
              return (
                <button
                  key={img.path}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={img.label}
                  onClick={() => applyLocalPath(img.path, img.label)}
                  className={cn(
                    "group relative h-14 overflow-hidden rounded-md border bg-black/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    selected
                      ? "border-primary ring-2 ring-primary/60"
                      : "border-white/10 hover:border-white/35",
                  )}
                >
                  <img
                    src={thumbSrc}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  {selected ? (
                    <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">
                      Actief
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <details className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
        <summary className="cursor-pointer text-[11px] text-white/55 hover:text-white/80">
          Alt-tekst &amp; toegankelijkheid
        </summary>
        <div className="mt-2 space-y-2 pb-1">
          <Field label="Alt-tekst">
            <input
              className={inputClass}
              value={value.alt}
              onChange={(e) => onChange({ ...value, alt: e.target.value, decorative: false })}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={value.decorative}
              onChange={(e) =>
                onChange({
                  ...value,
                  decorative: e.target.checked,
                  alt: e.target.checked ? "" : value.alt,
                })
              }
            />
            Decoratief (geen alt)
          </label>
        </div>
      </details>

      <details className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
        <summary className="cursor-pointer text-[11px] text-white/55 hover:text-white/80">
          Andere bron (HTTPS-URL)
        </summary>
        <div className="mt-2 space-y-2 pb-1">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={urlDraft}
              placeholder="https://…"
              onChange={(e) => setUrlDraft(e.target.value)}
            />
            <button
              type="button"
              className="shrink-0 rounded-lg bg-white/10 px-3 text-xs text-white hover:bg-white/15"
              onClick={() => {
                if (!isSafeExternalUrl(urlDraft, { allowHttpInDev: true })) {
                  setUrlError("Alleen https (of localhost http) toegestaan.");
                  return;
                }
                const img = externalImage(urlDraft.trim(), value.alt || label);
                if (!img) {
                  setUrlError("Ongeldige URL.");
                  return;
                }
                setUrlError(null);
                onChange(img);
                setUrlDraft("");
              }}
            >
              Toepassen
            </button>
          </div>
          {urlError ? <p className="text-xs text-red-300">{urlError}</p> : null}
          <p className="text-[10px] text-white/35">
            Externe URL moet vanaf de storefront bereikbaar zijn. Eigen bestanden: gebruik Uploaden hierboven.
          </p>
        </div>
      </details>
    </div>
  );
}

export function TypedLinkField({
  label,
  value,
  onChange,
  pages,
}: {
  label: string;
  value: CmsLink | null;
  onChange: (link: CmsLink | null) => void;
  pages?: Array<{ id: string; title: string; slug: string }>;
}) {
  return (
    <StructuredLinkField
      label={label}
      value={value}
      onChange={onChange}
      pages={pages}
      allowedKinds={PAGE_DESTINATION_LINK_KINDS}
    />
  );
}

const PLACEHOLDER_IMAGE = localImage("/images/hero-placeholder.jpg", "Afbeelding");

/** @deprecated Prefer `CmsImagePickerProps` — kept as alias for inspector props. */
type ImagePickerProps = CmsImagePickerProps;

const listItemClass = "space-y-2.5 rounded-xl border border-white/[0.08] bg-black/20 p-3";
const smallBtnClass =
  "rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white";

export function HomeHeroInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: HomeHeroContent;
  onPatch: (patch: Partial<{ [K in keyof HomeHeroContent]: HomeHeroContent[K] | null }>) => void;
} & ImagePickerProps) {
  const aiFields = collectShallowStringFields(
    content as unknown as Record<string, unknown>,
    ["eyebrow", "heading", "headingAccent", "body"],
    { includeEmpty: true },
  );
  if (content.primaryCta) {
    aiFields["primaryCta.label"] = content.primaryCta.label ?? "";
  }
  if (content.secondaryCta) {
    aiFields["secondaryCta.label"] = content.secondaryCta.label ?? "";
  }

  const applyDutch = (nl: Record<string, string>) => {
    const patch: Partial<{ [K in keyof HomeHeroContent]: HomeHeroContent[K] | null }> = {};
    if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
    if (typeof nl.heading === "string") patch.heading = nl.heading;
    if (typeof nl.headingAccent === "string") patch.headingAccent = nl.headingAccent;
    if (typeof nl.body === "string") patch.body = nl.body;
    if (typeof nl["primaryCta.label"] === "string" && content.primaryCta) {
      patch.primaryCta = { label: nl["primaryCta.label"], link: content.primaryCta.link };
    }
    if (typeof nl["secondaryCta.label"] === "string" && content.secondaryCta) {
      patch.secondaryCta = { label: nl["secondaryCta.label"], link: content.secondaryCta.link };
    }
    onPatch(patch);
  };

  return (
    <div className="space-y-4">
      <SectionAiToolbar
        pathPrefix="section:home.hero"
        fields={aiFields}
        fieldLabels={{
          eyebrow: "Eyebrow",
          heading: "Kop",
          headingAccent: "Accent",
          body: "Tekst",
          "primaryCta.label": "Primaire knop",
          "secondaryCta.label": "Secundaire knop",
        }}
        onApplyDutch={applyDutch}
      />

      <div className="space-y-3">
        <InspectTextField
          label="Eyebrow"
          value={content.eyebrow ?? ""}
          onChange={(v) => onPatch({ eyebrow: v })}
          fieldPath="section:home.hero:eyebrow"
          fieldHint="eyebrow"
          maxChars={80}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Kop"
          value={content.heading}
          onChange={(v) => onPatch({ heading: v })}
          fieldPath="section:home.hero:heading"
          fieldHint="heading"
          maxChars={120}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Accent"
          value={content.headingAccent ?? ""}
          onChange={(v) => onPatch({ headingAccent: v })}
          fieldPath="section:home.hero:headingAccent"
          fieldHint="headingAccent"
          maxChars={80}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Tekst"
          value={content.body}
          onChange={(v) => onPatch({ body: v })}
          fieldPath="section:home.hero:body"
          fieldHint="body"
          multiline
          maxChars={600}
          enableAi={false}
          showEnDraft={false}
        />
      </div>

      {content.primaryCta ? (
        <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-white/70">Primaire knop</p>
            <button type="button" className={smallBtnClass} onClick={() => onPatch({ primaryCta: null })}>
              Verwijderen
            </button>
          </div>
          <InspectTextField
            label="Label"
            value={content.primaryCta.label}
            onChange={(v) =>
              onPatch({
                primaryCta: {
                  label: v,
                  link: content.primaryCta!.link,
                },
              })
            }
            fieldPath="section:home.hero:primaryCta.label"
            fieldHint="label"
            maxChars={60}
            enableAi={false}
            showEnDraft={false}
          />
          <TypedLinkField
            label="Bestemming"
            value={content.primaryCta.link}
            onChange={(link) => {
              if (!link) {
                onPatch({ primaryCta: null });
                return;
              }
              onPatch({
                primaryCta: { label: content.primaryCta!.label, link },
              });
            }}
          />
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Primaire knop is verwijderd.</p>
      )}

      {content.secondaryCta ? (
        <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-white/70">Secundaire knop</p>
            <button type="button" className={smallBtnClass} onClick={() => onPatch({ secondaryCta: null })}>
              Verwijderen
            </button>
          </div>
          <InspectTextField
            label="Label"
            value={content.secondaryCta.label}
            onChange={(v) =>
              onPatch({
                secondaryCta: {
                  label: v,
                  link: content.secondaryCta!.link,
                },
              })
            }
            fieldPath="section:home.hero:secondaryCta.label"
            fieldHint="label"
            maxChars={60}
            enableAi={false}
            showEnDraft={false}
          />
          <TypedLinkField
            label="Bestemming"
            value={content.secondaryCta.link}
            onChange={(link) => {
              if (!link) {
                onPatch({ secondaryCta: null });
                return;
              }
              onPatch({
                secondaryCta: { label: content.secondaryCta!.label, link },
              });
            }}
          />
        </div>
      ) : (
        <p className="text-[11px] text-white/40">Secundaire knop is verwijderd.</p>
      )}

      <div className="border-t border-white/[0.07] pt-3">
        {content.image ? (
          <PrototypeImageField
            label="Hero-afbeelding"
            compact
            value={content.image}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
            preferTags={["hero", "home"]}
            onChange={(image) => onPatch({ image })}
            onClear={() => onPatch({ image: null })}
          />
        ) : (
          <button
            type="button"
            className={addBtnClass}
            onClick={() => onPatch({ image: PLACEHOLDER_IMAGE })}
          >
            Foto toevoegen
          </button>
        )}
      </div>
    </div>
  );
}

function updateCardAt<T extends { id: string }>(cards: T[], id: string, patch: Partial<T>): T[] {
  return cards.map((card) => (card.id === id ? { ...card, ...patch } : card));
}

function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function FormChromeInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  sectionKey = "form.chrome",
}: {
  content: FormPageChromeContent;
  onPatch: (patch: Partial<{ [K in keyof FormPageChromeContent]: FormPageChromeContent[K] | null }>) => void;
  sectionKey?: string;
} & ImagePickerProps) {
  const prefix = `section:${sectionKey}`;
  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix={prefix}
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", body: "Tekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<{ [K in keyof FormPageChromeContent]: FormPageChromeContent[K] | null }> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath={`${prefix}:eyebrow`}
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath={`${prefix}:heading`}
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Tekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath={`${prefix}:body`}
        fieldHint="body"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <Field label="Afbeelding (optioneel)">
        {content.image ? (
          <div className="space-y-2">
            <PrototypeImageField
              label="Sectie-afbeelding"
              value={content.image}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["form", "about"]}
              onChange={(image) => onPatch({ image })}
              onClear={() => onPatch({ image: null })}
            />
          </div>
        ) : (
          <button type="button" className={addBtnClass} onClick={() => onPatch({ image: PLACEHOLDER_IMAGE })}>
            Foto toevoegen
          </button>
        )}
      </Field>
      {sectionKey === "vacatures.main" ? (
        <FormScopeField
          label="Scope sollicitatieformulier"
          value={(content as VacaturesMainContent).applicationScope}
          onChange={(applicationScope) => {
            (onPatch as (patch: Partial<VacaturesMainContent>) => void)({ applicationScope });
          }}
        />
      ) : null}
    </div>
  );
}

export function ContactInfoInspector({
  content,
  onPatch,
}: {
  content: ContactInfoContent;
  onPatch: (patch: Partial<ContactInfoContent>) => void;
}) {
  const updateItem = (id: string, patch: Partial<ContactInfoItem>) => {
    onPatch({
      items: content.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/50">
        Infokaarten op de contactpagina (e-mail, telefoon, adres, openingstijden).
      </p>
      {content.items.map((item, index) => (
        <div key={item.id} className={listItemClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">#{index + 1}</span>
            <RemoveIconButton
              label={`Kaart ${index + 1} verwijderen`}
              onClick={() => onPatch({ items: removeById(content.items, item.id) })}
            />
          </div>
          <Field label="Icoon">
            <select
              className={selectClass}
              value={item.icon}
              onChange={(e) =>
                updateItem(item.id, {
                  icon: e.target.value as ContactInfoItem["icon"],
                })
              }
            >
              <option value="mail">E-mail</option>
              <option value="phone">Telefoon</option>
              <option value="map">Adres</option>
              <option value="clock">Openingstijden</option>
            </select>
          </Field>
          <Field label="Label">
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) => updateItem(item.id, { label: e.target.value })}
            />
          </Field>
          <Field label="Waarde">
            <textarea
              className={cn(inputClass, "min-h-[56px]")}
              value={item.value}
              onChange={(e) => updateItem(item.id, { value: e.target.value })}
            />
          </Field>
          <Field label="Link (optioneel)">
            <input
              className={inputClass}
              value={item.href ?? ""}
              placeholder="mailto:… of tel:…"
              onChange={(e) =>
                updateItem(item.id, { href: e.target.value.trim() ? e.target.value.trim() : undefined })
              }
            />
          </Field>
        </div>
      ))}
      <button
        type="button"
        className={smallBtnClass}
        onClick={() =>
          onPatch({
            items: [
              ...content.items,
              {
                id: createItemId("contact"),
                icon: "mail",
                label: "Nieuw",
                value: "",
              },
            ],
          })
        }
      >
        Kaart toevoegen
      </button>
    </div>
  );
}

export function ContactFormInspector({
  content,
  onPatch,
  formLabel = "Contactformulier",
  sectionKey = "contact.form",
}: {
  content: ContactFormContent;
  onPatch: (patch: Partial<ContactFormContent>) => void;
  formLabel?: string;
  sectionKey?: "contact.form" | "offerte.form";
}) {
  const isOfferte = sectionKey === "offerte.form";
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/50">
        Het {formLabel.toLowerCase()} is vast onderdeel van de pagina: verbergen kan, verwijderen niet.
        Veldlabels komen uit de sitevertalingen.
      </p>
      <Field label="Kop boven formulier (optioneel)">
        <input
          className={inputClass}
          value={content.heading ?? ""}
          onChange={(e) => onPatch({ heading: e.target.value || undefined })}
        />
      </Field>
      {isOfferte ? (
        <>
          <FormScopeField
            label="Scope glasbewassing"
            value={content.glassScope}
            onChange={(glassScope) => onPatch({ glassScope })}
          />
          <FormScopeField
            label="Scope meubelreiniging"
            value={content.furnitureScope}
            onChange={(furnitureScope) => onPatch({ furnitureScope })}
          />
        </>
      ) : (
        <FormScopeField
          value={content.scope}
          onChange={(scope) => onPatch({ scope })}
        />
      )}
    </div>
  );
}

export function AboutMainInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  part,
}: {
  content: AboutMainContent;
  onPatch: (patch: Partial<{ [K in keyof AboutMainContent]: AboutMainContent[K] | null }>) => void;
  /** When set, only that visual part’s fields are shown (Secties per-part rows). */
  part?: string;
} & ImagePickerProps) {
  const show = (id: string) => !part || part === id;
  const aiKeys = (
    [
      ...(show("header") ? (["eyebrow", "heading"] as const) : []),
      ...(show("mission") ? (["missionTitle", "missionBody"] as const) : []),
      ...(show("vision") ? (["visionTitle", "visionBody"] as const) : []),
      ...(show("history") ? (["historyTitle", "historyBody"] as const) : []),
    ] as const
  ).slice();

  return (
    <div className="space-y-3">
      {show("header") ? (
        <>
          <InspectTextField
            label="Eyebrow"
            value={content.eyebrow ?? ""}
            onChange={(v) => onPatch({ eyebrow: v })}
            fieldPath="section:about.main:eyebrow"
            fieldHint="eyebrow"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Kop"
            value={content.heading}
            onChange={(v) => onPatch({ heading: v })}
            fieldPath="section:about.main:heading"
            fieldHint="heading"
            maxChars={120}
            enableAi={false}
            showEnDraft={false}
          />
        </>
      ) : null}

      {show("mission") ? (
        <>
          <InspectTextField
            label="Missie — titel"
            value={content.missionTitle ?? ""}
            onChange={(v) => onPatch({ missionTitle: v })}
            fieldPath="section:about.main:missionTitle"
            fieldHint="missionTitle"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Missie — tekst"
            value={content.missionBody ?? ""}
            onChange={(v) => onPatch({ missionBody: v })}
            fieldPath="section:about.main:missionBody"
            fieldHint="missionBody"
            multiline
            maxChars={1200}
            enableAi={false}
            showEnDraft={false}
          />
          {content.missionImage || content.image ? (
            <PrototypeImageField
              label="Missie — afbeelding"
              value={content.missionImage ?? content.image ?? PLACEHOLDER_IMAGE}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["about"]}
              onChange={(missionImage) => onPatch({ missionImage, image: missionImage })}
              onClear={() => onPatch({ missionImage: null, image: null })}
            />
          ) : (
            <button
              type="button"
              className={addBtnClass}
              onClick={() => onPatch({ missionImage: PLACEHOLDER_IMAGE, image: PLACEHOLDER_IMAGE })}
            >
              Foto toevoegen (missie)
            </button>
          )}
        </>
      ) : null}

      {show("vision") ? (
        <>
          <InspectTextField
            label="Visie — titel"
            value={content.visionTitle ?? ""}
            onChange={(v) => onPatch({ visionTitle: v })}
            fieldPath="section:about.main:visionTitle"
            fieldHint="visionTitle"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Visie — tekst"
            value={content.visionBody ?? ""}
            onChange={(v) => onPatch({ visionBody: v })}
            fieldPath="section:about.main:visionBody"
            fieldHint="visionBody"
            multiline
            maxChars={1200}
            enableAi={false}
            showEnDraft={false}
          />
          {content.visionImage ? (
            <PrototypeImageField
              label="Visie — afbeelding"
              value={content.visionImage}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["about"]}
              onChange={(visionImage) => onPatch({ visionImage })}
              onClear={() => onPatch({ visionImage: null })}
            />
          ) : (
            <button type="button" className={addBtnClass} onClick={() => onPatch({ visionImage: PLACEHOLDER_IMAGE })}>
              Foto toevoegen (visie)
            </button>
          )}
        </>
      ) : null}

      {show("history") ? (
        <>
          <InspectTextField
            label="Historie — titel"
            value={content.historyTitle ?? ""}
            onChange={(v) => onPatch({ historyTitle: v })}
            fieldPath="section:about.main:historyTitle"
            fieldHint="historyTitle"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Historie — tekst"
            value={content.historyBody ?? ""}
            onChange={(v) => onPatch({ historyBody: v })}
            fieldPath="section:about.main:historyBody"
            fieldHint="historyBody"
            multiline
            maxChars={1200}
            enableAi={false}
            showEnDraft={false}
          />
          {content.historyImage ? (
            <PrototypeImageField
              label="Historie — afbeelding"
              value={content.historyImage}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["about"]}
              onChange={(historyImage) => onPatch({ historyImage })}
              onClear={() => onPatch({ historyImage: null })}
            />
          ) : (
            <button type="button" className={addBtnClass} onClick={() => onPatch({ historyImage: PLACEHOLDER_IMAGE })}>
              Foto toevoegen (historie)
            </button>
          )}
        </>
      ) : null}

      {aiKeys.length > 0 ? (
        <SectionAiToolbar
          pathPrefix="section:about.main"
          fields={collectShallowStringFields(content as unknown as Record<string, unknown>, [...aiKeys], {
            includeEmpty: true,
          })}
          fieldLabels={{
            eyebrow: "Eyebrow",
            heading: "Kop",
            missionTitle: "Missie — titel",
            missionBody: "Missie — tekst",
            visionTitle: "Visie — titel",
            visionBody: "Visie — tekst",
            historyTitle: "Historie — titel",
            historyBody: "Historie — tekst",
          }}
          onApplyDutch={(nl) => {
            const patch: Partial<{ [K in keyof AboutMainContent]: AboutMainContent[K] | null }> = {};
            for (const key of aiKeys) {
              if (typeof nl[key] === "string") patch[key] = nl[key];
            }
            onPatch(patch);
          }}
        />
      ) : null}
    </div>
  );
}

function CardListEditor({
  cards,
  onChange,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  preferTags = ["services", "work"],
  enPathPrefix,
}: {
  cards: Array<ServiceCard | ProductCard>;
  onChange: (cards: Array<ServiceCard | ProductCard>) => void;
  /** e.g. `section:services.main:cards` for nested EN draft paths */
  enPathPrefix?: string;
} & ImagePickerProps & { preferTags?: string[] }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-white/50">Kaarten ({cards.length})</p>
      {cards.map((card, index) => (
        <div key={card.id} className={listItemClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">#{index + 1}</span>
            <RemoveIconButton
              label={`Kaart ${index + 1} verwijderen`}
              onClick={() => onChange(removeById(cards, card.id))}
            />
          </div>
          <PrototypeImageField
            label={`Kaartfoto #${index + 1}`}
            compact
            value={card.image ?? PLACEHOLDER_IMAGE}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
            preferTags={preferTags}
            onChange={(image) => onChange(updateCardAt(cards, card.id, { image }))}
          />
          <Field label="Titel">
            <input
              className={inputClass}
              value={card.title}
              onChange={(e) => onChange(updateCardAt(cards, card.id, { title: e.target.value }))}
            />
          </Field>
          {enPathPrefix ? (
            <ManualEnDraftField
              fieldPath={`${enPathPrefix}.${index}.title`}
              label="Titel"
            />
          ) : null}
          <Field label="Beschrijving">
            <textarea
              className={cn(inputClass, "min-h-[64px]")}
              value={card.description}
              onChange={(e) => onChange(updateCardAt(cards, card.id, { description: e.target.value }))}
            />
          </Field>
          {enPathPrefix ? (
            <ManualEnDraftField
              fieldPath={`${enPathPrefix}.${index}.description`}
              label="Beschrijving"
              multiline
            />
          ) : null}
          {card.link ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-white/50">Kaartlink</p>
                <button
                  type="button"
                  className={smallBtnClass}
                  onClick={() => {
                    const next = cards.map((c) => {
                      if (c.id !== card.id) return c;
                      const { link: _removed, ...rest } = c;
                      return rest;
                    });
                    onChange(next);
                  }}
                >
                  Link verwijderen
                </button>
              </div>
              <TypedLinkField
                label="Link"
                value={card.link}
                onChange={(link) => onChange(updateCardAt(cards, card.id, { link: link ?? undefined }))}
              />
            </div>
          ) : (
            <p className="text-[11px] text-white/40">Kaartlink is verwijderd.</p>
          )}
        </div>
      ))}
      <button
        type="button"
        className={addBtnClass}
        onClick={() =>
          onChange([
            ...cards,
            {
              id: createItemId("card"),
              title: "Nieuwe kaart",
              description: "",
              image: PLACEHOLDER_IMAGE,
            },
          ])
        }
      >
        Foto / kaart toevoegen
      </button>
      {cards.length === 0 ? (
        <p className="text-[11px] text-white/40">Nog geen kaarten — voeg hierboven een foto toe.</p>
      ) : null}
    </div>
  );
}

export function ServicesMainInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  part,
}: {
  content: ServicesMainContent;
  onPatch: (patch: Partial<ServicesMainContent>) => void;
  part?: string;
} & ImagePickerProps) {
  const showHeader = !part || part === "header";
  const showCards = !part || part === "cards";
  return (
    <div className="space-y-3">
      {showHeader ? (
        <>
          <InspectTextField
            label="Eyebrow"
            value={content.eyebrow ?? ""}
            onChange={(v) => onPatch({ eyebrow: v })}
            fieldPath="section:services.main:eyebrow"
            fieldHint="eyebrow"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Kop"
            value={content.heading}
            onChange={(v) => onPatch({ heading: v })}
            fieldPath="section:services.main:heading"
            fieldHint="heading"
            maxChars={120}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Intro"
            value={content.intro}
            onChange={(v) => onPatch({ intro: v })}
            fieldPath="section:services.main:intro"
            fieldHint="intro"
            multiline
            maxChars={600}
            enableAi={false}
            showEnDraft={false}
          />
          <SectionAiToolbar
            pathPrefix="section:services.main"
            fields={collectShallowStringFields(
              content as unknown as Record<string, unknown>,
              ["eyebrow", "heading", "intro"],
              { includeEmpty: true },
            )}
            fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", intro: "Intro" }}
            onApplyDutch={(nl) => {
              const patch: Partial<ServicesMainContent> = {};
              if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
              if (typeof nl.heading === "string") patch.heading = nl.heading;
              if (typeof nl.intro === "string") patch.intro = nl.intro;
              onPatch(patch);
            }}
          />
        </>
      ) : null}
      {showCards ? (
        <CardListEditor
          cards={content.cards}
          projectImages={projectImages}
          assetBaseUrl={assetBaseUrl}
          uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
          preferTags={["services", "work", "gallery"]}
          enPathPrefix="section:services.main:cards"
          onChange={(cards) => onPatch({ cards: cards as ServiceCard[] })}
        />
      ) : null}
    </div>
  );
}

export function ProductsMainInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: ProductsMainContent;
  onPatch: (patch: Partial<{ [K in keyof ProductsMainContent]: ProductsMainContent[K] | null }>) => void;
} & ImagePickerProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-white/50">
        Eén sectie: sectietitel, sectietekst, knoppen, webshop-notitie én flyer. Assortimentskaarten
        staan apart in &quot;Producten-info&quot;.
      </p>
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:products.main:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietitel"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:products.main:heading"
        fieldHint="heading"
        maxChars={160}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietekst"
        value={content.intro}
        onChange={(v) => onPatch({ intro: v })}
        fieldPath="section:products.main:intro"
        fieldHint="intro"
        multiline
        maxChars={1200}
        enableAi={false}
        showEnDraft={false}
      />
      <p className="text-[11px] leading-relaxed text-white/40">
        Gebruik een lege regel tussen alinea&apos;s voor meerdere paragrafen.
      </p>
      <InspectTextField
        label="Extra sectietekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath="section:products.main:body"
        fieldHint="body"
        multiline
        maxChars={500}
        enableAi={false}
        showEnDraft={false}
      />
      <p className="text-[11px] leading-relaxed text-white/40">
        Extra sectietekst verschijnt als melding onder de knoppen (webshop-notitie).
      </p>
      {content.image ? (
        <PrototypeImageField
          label="Flyer"
          value={content.image}
          projectImages={projectImages}
          assetBaseUrl={assetBaseUrl}
          uploadToMediaLibrary={uploadToMediaLibrary}
          mediaLibraryItems={mediaLibraryItems}
          resolveProjectImage={resolveProjectImage}
          preferTags={["products", "work"]}
          onChange={(image) => onPatch({ image })}
          onClear={() => onPatch({ image: null })}
        />
      ) : (
        <button
          type="button"
          className={addBtnClass}
          onClick={() =>
            onPatch({
              image: localImage("/images/cms/products-flyer.png", "McCoy Cleaning Products flyer"),
            })
          }
        >
          Flyer toevoegen
        </button>
      )}
      <SectionAiToolbar
        pathPrefix="section:products.main"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "intro", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{
          eyebrow: "Eyebrow",
          heading: "Sectietitel",
          intro: "Sectietekst",
          body: "Extra sectietekst",
        }}
        onApplyDutch={(nl) => {
          const patch: Partial<ProductsMainContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.intro === "string") patch.intro = nl.intro;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
    </div>
  );
}

export function ProductsInfoInspector({
  content,
  onPatch,
}: {
  content: ProductsInfoContent;
  onPatch: (patch: Partial<ProductsInfoContent>) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-white/50">
        Sectiekop + introtekst, daarna de assortimentskaarten. Kaarten hebben icoon + tekst (geen
        foto&apos;s).
      </p>
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:products.info:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietitel"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:products.info:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Sectietekst"
        value={content.intro ?? ""}
        onChange={(v) => onPatch({ intro: v })}
        fieldPath="section:products.info:intro"
        fieldHint="intro"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-white/50">Kaarten ({content.cards.length})</p>
        {content.cards.map((card, index) => (
          <div key={card.id} className={listItemClass}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-white/40">#{index + 1}</span>
              <RemoveIconButton
                label={`Kaart ${index + 1} verwijderen`}
                onClick={() => onPatch({ cards: removeById(content.cards, card.id) })}
              />
            </div>
            <Field label="Titel">
              <input
                className={inputClass}
                value={card.title}
                onChange={(e) =>
                  onPatch({ cards: updateCardAt(content.cards, card.id, { title: e.target.value }) })
                }
              />
            </Field>
            <ManualEnDraftField
              fieldPath={`section:products.info:cards.${index}.title`}
              label="Titel"
            />
            <Field label="Beschrijving">
              <textarea
                className={cn(inputClass, "min-h-[64px]")}
                value={card.description}
                onChange={(e) =>
                  onPatch({
                    cards: updateCardAt(content.cards, card.id, { description: e.target.value }),
                  })
                }
              />
            </Field>
            <ManualEnDraftField
              fieldPath={`section:products.info:cards.${index}.description`}
              label="Beschrijving"
              multiline
            />
            {card.link ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-white/50">Kaartlink</p>
                  <button
                    type="button"
                    className={smallBtnClass}
                    onClick={() => {
                      onPatch({
                        cards: content.cards.map((c) => {
                          if (c.id !== card.id) return c;
                          const { link: _removed, ...rest } = c;
                          return rest;
                        }),
                      });
                    }}
                  >
                    Link verwijderen
                  </button>
                </div>
                <TypedLinkField
                  label="Link"
                  value={card.link}
                  onChange={(link) =>
                    onPatch({
                      cards: updateCardAt(content.cards, card.id, { link: link ?? undefined }),
                    })
                  }
                />
              </div>
            ) : (
              <button
                type="button"
                className={addBtnClass}
                onClick={() =>
                  onPatch({
                    cards: updateCardAt(content.cards, card.id, {
                      link: { type: "internal_route", route: "contact" },
                    }),
                  })
                }
              >
                Link toevoegen
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={addBtnClass}
          onClick={() =>
            onPatch({
              cards: [
                ...content.cards,
                {
                  id: createItemId("card"),
                  title: "Nieuwe kaart",
                  description: "",
                  link: { type: "internal_route", route: "contact" },
                },
              ],
            })
          }
        >
          Kaart toevoegen
        </button>
        {content.cards.length === 0 ? (
          <p className="text-[11px] text-white/40">Nog geen kaarten — voeg hierboven een kaart toe.</p>
        ) : null}
      </div>
      <SectionAiToolbar
        pathPrefix="section:products.info"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "intro"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Sectietitel", intro: "Sectietekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<ProductsInfoContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.intro === "string") patch.intro = nl.intro;
          onPatch(patch);
        }}
      />
    </div>
  );
}

export function PartnersInspector({
  content,
  onPatch,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: PartnersContent;
  onPatch: (patch: Partial<PartnersContent>) => void;
} & ImagePickerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = content.items.find((i) => i.id === selectedId) ?? null;
  const selectedIndex = selected ? content.items.findIndex((i) => i.id === selected.id) : -1;

  const patchItem = (id: string, patch: Partial<(typeof content.items)[number]>) => {
    onPatch({
      items: content.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix="section:home.partners"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop" }}
        onApplyDutch={(nl) => {
          const patch: Partial<PartnersContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:home.partners:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:home.partners:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
          Logo&apos;s ({content.items.length})
        </p>
        <ImageStripPreview
          assetBaseUrl={assetBaseUrl}
          size="large"
          emptyLabel="Nog geen partnerlogo's — upload er hieronder meerdere tegelijk."
          removeLabel={(item) => `Verwijder logo${item.title || item.alt ? ` ${item.title || item.alt}` : ""}`}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          onRemove={(id) => {
            onPatch({ items: removeById(content.items, id) });
            if (selectedId === id) setSelectedId(null);
          }}
          items={content.items.map((item) => {
            const backdrop = resolveLogoBackdrop(item);
            return {
              id: item.id,
              src: item.image.src,
              alt: item.image.alt,
              title: item.name,
              cardStyle: { backgroundColor: backdrop },
            };
          })}
        />
        {selected && selectedIndex >= 0 ? (
          <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2.5">
            <p className="text-[11px] font-medium text-white/60">
              Geselecteerd: <span className="text-white/90">{selected.name || "Logo"}</span>
            </p>
            <Field label="Naam">
              <input
                className={inputClass}
                value={selected.name}
                onChange={(e) => patchItem(selected.id, { name: e.target.value })}
              />
            </Field>
            <ManualEnDraftField
              fieldPath={`section:home.partners:items.${selectedIndex}.name`}
              label="Naam"
            />
            <Field label="Logo-achtergrond">
              <select
                className={inputClass}
                value={
                  selected.logoBackdrop === "white"
                    ? "light"
                    : selected.logoBackdrop === "black"
                      ? "dark"
                      : (selected.logoBackdrop ?? "auto")
                }
                onChange={(e) => {
                  const logoBackdrop = e.target.value as LogoBackdropPreference;
                  patchItem(selected.id, { logoBackdrop });
                }}
                aria-describedby={`partner-backdrop-hint-${selected.id}`}
              >
                <option value="auto">Automatisch (plaatkleur)</option>
                <option value="light">Wit</option>
                <option value="dark">Zwart</option>
              </select>
            </Field>
            <p id={`partner-backdrop-hint-${selected.id}`} className="text-[10px] leading-snug text-white/40">
              Automatisch gebruikt de plaatkleur van de upload
              {selected.resolvedBackdrop
                ? ` (nu: ${resolveLogoBackdrop(selected)})`
                : " (standaard wit voor bestaande logo's)"}
              . Kies wit of zwart om handmatig te corrigeren.
            </p>
          </div>
        ) : content.items.length > 0 ? (
          <p className="text-[10px] text-white/40">Klik een logo om naam of achtergrond te wijzigen.</p>
        ) : null}
        <BulkImageAddButton
          label="Meerdere logo's uploaden"
          profile="logo"
          tags={["partners", "logo"]}
          uploadToMediaLibrary={uploadToMediaLibrary}
          onAdded={(uploaded) => {
            const added = uploaded.map((u) => ({
              id: createItemId("partner"),
              name: u.label,
              logoBackdrop: "auto" as const,
              resolvedBackdrop: u.logoBackdrop ?? "#ffffff",
              image: { ...u.image, alt: u.label, decorative: false },
            }));
            onPatch({ items: [...content.items, ...added] });
          }}
        />
      </div>
    </div>
  );
}

export function StatsInspector({
  content,
  onPatch,
}: {
  content: StatsContent;
  onPatch: (patch: Partial<StatsContent>) => void;
}) {
  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix="section:home.stats"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", body: "Tekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<StatsContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:home.stats:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading ?? ""}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:home.stats:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Tekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath="section:home.stats:body"
        fieldHint="body"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <p className="text-[11px] font-medium text-white/50">Statistieken ({content.items.length})</p>
      {content.items.map((item, index) => (
        <div key={item.id} className={listItemClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/40">#{index + 1}</span>
            <RemoveIconButton
              label={`Statistiek ${index + 1} verwijderen`}
              onClick={() => onPatch({ items: removeById(content.items, item.id) })}
            />
          </div>
          <Field label="Waarde">
            <input
              className={inputClass}
              value={item.value}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((s) => (s.id === item.id ? { ...s, value: e.target.value } : s)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.stats:items.${index}.value`}
            label="Waarde"
          />
          <Field label="Label">
            <input
              className={inputClass}
              value={item.label}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((s) => (s.id === item.id ? { ...s, label: e.target.value } : s)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.stats:items.${index}.label`}
            label="Label"
          />
        </div>
      ))}
      <button
        type="button"
        className={addBtnClass}
        onClick={() =>
          onPatch({
            items: [
              ...content.items,
              {
                id: createItemId("stat"),
                value: "0",
                label: "Nieuw",
              },
            ],
          })
        }
      >
        Item toevoegen
      </button>
    </div>
  );
}

export function WorkGalleryInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: WorkGalleryContent;
  onPatch: (patch: Partial<WorkGalleryContent>) => void;
} & ImagePickerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(content.items[0]?.id ?? null);
  const itemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  React.useEffect(() => {
    if (selectedId && content.items.some((i) => i.id === selectedId)) return;
    setSelectedId(content.items[0]?.id ?? null);
  }, [content.items, selectedId]);

  const selectItem = (id: string) => {
    setSelectedId(id);
    itemRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix="section:home.workGallery"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", body: "Tekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<WorkGalleryContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:home.workGallery:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:home.workGallery:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Tekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath="section:home.workGallery:body"
        fieldHint="body"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
          Foto&apos;s in sectie ({content.items.length})
        </p>
        <ImageStripPreview
          assetBaseUrl={assetBaseUrl}
          selectedId={selectedId}
          onSelect={selectItem}
          emptyLabel="Nog geen foto's — upload er hieronder meerdere tegelijk."
          items={content.items.map((item) => ({
            id: item.id,
            src: item.image.src,
            alt: item.image.alt,
            title: item.title,
          }))}
        />
        <BulkImageAddButton
          label="Meerdere foto's uploaden"
          profile="photo"
          tags={["gallery", "work"]}
          uploadToMediaLibrary={uploadToMediaLibrary}
          onAdded={(uploaded) => {
            const added = uploaded.map((u) => ({
              id: createItemId("gallery"),
              title: u.label,
              image: { ...u.image, alt: u.label, decorative: false },
            }));
            onPatch({ items: [...content.items, ...added] });
            if (added[0]) setSelectedId(added[0].id);
          }}
        />
      </div>

      <p className="text-[11px] font-medium text-white/50">Bewerken ({content.items.length})</p>
      {content.items.map((item, index) => (
        <div
          key={item.id}
          ref={(node) => {
            if (node) itemRefs.current.set(item.id, node);
            else itemRefs.current.delete(item.id);
          }}
          className={cn(
            listItemClass,
            selectedId === item.id && "border-sky-400/40 ring-1 ring-sky-400/25",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-[11px] text-white/40 hover:text-white/70"
              onClick={() => selectItem(item.id)}
            >
              #{index + 1}
            </button>
            <RemoveIconButton
              label={`Foto ${index + 1} verwijderen`}
              onClick={() => onPatch({ items: removeById(content.items, item.id) })}
            />
          </div>
          <PrototypeImageField
            label={`Foto — ${item.title || `#${index + 1}`}`}
            compact
            value={item.image}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
            preferTags={["gallery", "work"]}
            onChange={(image) =>
              onPatch({
                items: content.items.map((g) => (g.id === item.id ? { ...g, image } : g)),
              })
            }
          />
          <Field label="Titel">
            <input
              className={inputClass}
              value={item.title}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((g) => (g.id === item.id ? { ...g, title: e.target.value } : g)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.workGallery:items.${index}.title`}
            label="Titel"
          />
          <Field label="Bijschrift">
            <input
              className={inputClass}
              value={item.caption ?? ""}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((g) => (g.id === item.id ? { ...g, caption: e.target.value } : g)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.workGallery:items.${index}.caption`}
            label="Bijschrift"
          />
        </div>
      ))}
      <button
        type="button"
        className={addBtnClass}
        onClick={() => {
          const id = createItemId("gallery");
          onPatch({
            items: [
              ...content.items,
              {
                id,
                title: "Nieuwe foto",
                image: PLACEHOLDER_IMAGE,
              },
            ],
          });
          setSelectedId(id);
        }}
      >
        Lege foto toevoegen
      </button>
    </div>
  );
}

const BLOCK_STRING_KEYS = [
  "title",
  "subtitle",
  "body",
  "description",
  "eyebrow",
  "ctaLabel",
  "ctaHref",
  "image",
  "before",
  "after",
  "poster",
  "html",
  "quote",
  "author",
  "caption",
  "videoUrl",
] as const;

const BLOCK_STRING_KEY_SET = new Set<string>(BLOCK_STRING_KEYS);

const BLOCK_FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  subtitle: "Subtitel",
  body: "Tekst",
  description: "Beschrijving",
  eyebrow: "Eyebrow",
  ctaLabel: "CTA-label",
  ctaHref: "CTA-URL",
  image: "Afbeelding",
  before: "Voor (afbeelding)",
  after: "Na (afbeelding)",
  poster: "Videoposter",
  html: "HTML",
  quote: "Quote",
  author: "Auteur",
  caption: "Bijschrift",
  videoUrl: "Video-URL",
};

/** Destination URLs are edited via LinkField in advanced — avoid duplicate raw URL chrome. */
const BLOCK_LINK_KEYS_HIDDEN_IN_INSPECTOR = new Set(["ctaHref", "href", "url"]);

/** Only top-level string fields that already exist on this block — never invent empty keys. */
function editableStringKeys(blockData: Record<string, unknown>): string[] {
  const existing = Object.keys(blockData).filter((key) => typeof blockData[key] === "string");
  const ordered = BLOCK_STRING_KEYS.filter((key) => existing.includes(key));
  const extras = existing.filter((key) => !BLOCK_STRING_KEY_SET.has(key));
  return [...ordered, ...extras];
}

export function BlockDataInspector({
  blockType,
  blockData,
  onPatch,
  blockId,
}: {
  blockType?: string;
  blockData: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  /** When set, enables EN draft paths `block:{id}:{field}`. */
  blockId?: string;
}) {
  const presentKeys = editableStringKeys(blockData);
  const copyKeys = presentKeys.filter((key) => isTranslatableFieldKey(key));
  const mediaKeys = presentKeys.filter(
    (key) => !isTranslatableFieldKey(key) && !BLOCK_LINK_KEYS_HIDDEN_IN_INSPECTOR.has(key),
  );
  const pathPrefix = blockId ? `block:${blockId}` : undefined;
  const batchFields = collectShallowStringFields(blockData, copyKeys, { includeEmpty: true });
  const fieldLabels = Object.fromEntries(
    copyKeys.map((key) => [key, BLOCK_FIELD_LABELS[key] ?? key]),
  );

  return (
    <div className="space-y-4">
      {pathPrefix && copyKeys.length > 0 ? (
        <SectionAiToolbar
          pathPrefix={pathPrefix}
          fields={batchFields}
          fieldLabels={fieldLabels}
          onApplyDutch={(nl) => {
            const patch: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(nl)) {
              if (copyKeys.includes(key)) patch[key] = value;
            }
            onPatch(patch);
          }}
        />
      ) : null}

      {blockType ? (
        <p className="text-[11px] text-white/40">
          Bloktype: <span className="font-medium text-white/65">{blockType}</span>
        </p>
      ) : null}

      <div className="space-y-3">
        {copyKeys.map((key) => {
          const value = typeof blockData[key] === "string" ? (blockData[key] as string) : "";
          const multiline = key === "body" || key === "html" || key === "quote" || key === "description";
          return (
            <InspectTextField
              key={key}
              label={BLOCK_FIELD_LABELS[key] ?? key}
              value={value}
              onChange={(v) => onPatch({ [key]: v })}
              fieldPath={pathPrefix ? `${pathPrefix}:${key}` : undefined}
              fieldHint={key}
              multiline={multiline}
              maxChars={multiline ? 1200 : 200}
            enableAi={false}
            showEnDraft={false}
            />
          );
        })}
      </div>

      {mediaKeys.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.07] pt-3">
          {mediaKeys.map((key) => {
            const value = typeof blockData[key] === "string" ? (blockData[key] as string) : "";
            return (
              <Field key={key} label={BLOCK_FIELD_LABELS[key] ?? key}>
                <input
                  className={inputClass}
                  value={value}
                  onChange={(e) => onPatch({ [key]: e.target.value })}
                />
              </Field>
            );
          })}
        </div>
      ) : null}

      {"align" in blockData || "reverse" in blockData ? (
        <div className="space-y-3 border-t border-white/[0.07] pt-3">
          {"align" in blockData ? (
            <Field label="Uitlijning">
              <select
                className={selectClass}
                value={typeof blockData.align === "string" ? blockData.align : ""}
                onChange={(e) => onPatch({ align: e.target.value })}
              >
                <option className={optionClass} value="">
                  —
                </option>
                <option className={optionClass} value="left">
                  left
                </option>
                <option className={optionClass} value="center">
                  center
                </option>
                <option className={optionClass} value="right">
                  right
                </option>
              </select>
            </Field>
          ) : null}
          {"reverse" in blockData ? (
            <label className="flex items-center gap-2 text-xs text-white/55">
              <input
                type="checkbox"
                checked={Boolean(blockData.reverse)}
                onChange={(e) => onPatch({ reverse: e.target.checked })}
              />
              Omgekeerde layout (beeld links)
            </label>
          ) : null}
        </div>
      ) : null}

      {presentKeys.length === 0 && !("align" in blockData) && !("reverse" in blockData) ? (
        <p className="text-xs text-white/45">Geen bewerkbare sleutels op dit blok.</p>
      ) : null}
    </div>
  );
}

/**
 * Easy editor for privacy / terms: page title fields + reorderable text blocks.
 * Users add/edit/remove “secties” or “artikelen” without learning the block system.
 */
export function LegalMainInspector({
  content,
  onPatch,
  sectionKey,
  itemNoun = "Sectie",
  itemNounPlural,
}: {
  content: LegalMainContent;
  onPatch: (patch: Partial<LegalMainContent>) => void;
  sectionKey: "privacy.main" | "terms.main";
  itemNoun?: string;
  itemNounPlural?: string;
}) {
  const pathPrefix = `section:${sectionKey}`;
  const plural = itemNounPlural ?? `${itemNoun}s`;

  return (
    <div className="space-y-5">
      <p className="text-[11px] leading-relaxed text-white/50">
        Bewerk de paginatitel en voeg tekstblokken toe. Elk blok is een kop met tekst — sleep
        volgorde met omhoog/omlaag. Extra lay-outblokken kun je via &quot;Sectie toevoegen&quot; in
        de lijst plaatsen.
      </p>

      <SectionAiToolbar
        pathPrefix={pathPrefix}
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "updatedLabel"],
          { includeEmpty: true },
        )}
        fieldLabels={{
          eyebrow: "Eyebrow",
          heading: "Paginakop",
          updatedLabel: "Bijgewerkt-label",
        }}
        onApplyDutch={(nl) => {
          const patch: Partial<LegalMainContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.updatedLabel === "string") patch.updatedLabel = nl.updatedLabel;
          onPatch(patch);
        }}
      />

      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Paginakop
        </p>
        <InspectTextField
          label="Eyebrow"
          value={content.eyebrow ?? ""}
          onChange={(v) => onPatch({ eyebrow: v })}
          fieldPath={`${pathPrefix}:eyebrow`}
          fieldHint="eyebrow"
          maxChars={60}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Paginakop"
          value={content.heading}
          onChange={(v) => onPatch({ heading: v })}
          fieldPath={`${pathPrefix}:heading`}
          fieldHint="heading"
          maxChars={120}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Bijgewerkt-label"
          value={content.updatedLabel ?? ""}
          onChange={(v) => onPatch({ updatedLabel: v })}
          fieldPath={`${pathPrefix}:updatedLabel`}
          fieldHint="updatedLabel"
          maxChars={160}
          enableAi={false}
          showEnDraft={false}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {plural} ({content.articles.length})
          </p>
        </div>
        <ObjectListEditor<LegalArticle>
          items={content.articles}
          onChange={(articles) => onPatch({ articles })}
          createItem={() => ({
            id: createItemId("legal"),
            title: `Nieuw ${itemNoun.toLowerCase()}`,
            body: "",
          })}
          cloneItem={(item) => ({
            ...item,
            id: createItemId("legal"),
            title: `${item.title} (kopie)`,
          })}
          addLabel={`${itemNoun} toevoegen`}
          renderItem={(item, actions, index) => (
            <div className="grid gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {itemNoun} {index + 1}
              </p>
              <InspectTextField
                label="Titel"
                value={item.title}
                onChange={(v) => actions.update({ ...item, title: v })}
                fieldPath={`${pathPrefix}:articles.${index}.title`}
                fieldHint="title"
                maxChars={160}
                enableAi={false}
                showEnDraft={false}
              />
              <InspectTextField
                label="Tekst"
                value={item.body}
                onChange={(v) => actions.update({ ...item, body: v })}
                fieldPath={`${pathPrefix}:articles.${index}.body`}
                fieldHint="body"
                multiline
                maxChars={8000}
                enableAi={false}
                showEnDraft={false}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}

export function SelectedSectionInspector({
  selection,
  sectionContent,
  onSectionPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  blockData,
  blockType,
  onBlockPatch,
  part,
}: {
  selection: CmsSelection;
  sectionContent: PageSectionContent;
  onSectionPatch: (sectionKey: FixedSectionKey, patch: Record<string, unknown>) => void;
  projectImages?: Array<{ path: string; label: string; tags?: string[] }>;
  assetBaseUrl?: string;
  uploadToMediaLibrary?: ImagePickerProps["uploadToMediaLibrary"];
  mediaLibraryItems?: ImagePickerProps["mediaLibraryItems"];
  resolveProjectImage?: ImagePickerProps["resolveProjectImage"];
  blockData?: Record<string, unknown>;
  blockType?: string;
  onBlockPatch?: (patch: Record<string, unknown>) => void;
  /** Composite fixed-section part (e.g. mission / vision). */
  part?: string;
}) {
  if (!selection) {
    return (
      <p className="text-xs text-white/45">
        Selecteer een paginasectie op het canvas of in de sectielijst om inhoud te bewerken.
      </p>
    );
  }

  if (selection.kind === "block") {
    if (!blockData || !onBlockPatch || !blockType) {
      return <p className="text-xs text-amber-300">Blokgegevens niet beschikbaar.</p>;
    }
    return (
      <RegisteredBlockEditor
        presentation="inspector"
        block={{
          id: selection.blockId,
          type: blockType as import("@mccoy/cms-schema").BlockType,
          data: blockData,
        }}
        onChange={(next) => {
          onBlockPatch({ ...next.data, dataVersion: next.dataVersion });
        }}
      />
    );
  }

  const key = selection.sectionKey;
  const content = sectionContent[key];
  if (!content) {
    return <p className="text-xs text-amber-300">Geen inhoud voor {key}.</p>;
  }

  const imageProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  const partId = part ?? (selection.kind === "fixed" ? selection.part : undefined);

  if (key === "home.hero") {
    return (
      <HomeHeroInspector
        content={content as HomeHeroContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "contact.main" || key === "vacatures.main" || key === "offerte.main") {
    return (
      <FormChromeInspector
        content={content as FormPageChromeContent}
        sectionKey={key}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "contact.info" || key === "offerte.info") {
    return (
      <ContactInfoInspector
        content={content as ContactInfoContent}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "contact.form" || key === "offerte.form") {
    return (
      <ContactFormInspector
        content={content as ContactFormContent}
        onPatch={(patch) => onSectionPatch(key, patch)}
        formLabel={key === "offerte.form" ? "Offerteformulier" : "Contactformulier"}
        sectionKey={key}
      />
    );
  }
  if (key === "about.main") {
    return (
      <AboutMainInspector
        content={content as AboutMainContent}
        {...imageProps}
        part={partId}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "services.main") {
    return (
      <ServicesMainInspector
        content={content as ServicesMainContent}
        {...imageProps}
        part={partId}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "products.main") {
    return (
      <ProductsMainInspector
        content={content as ProductsMainContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "products.info") {
    return (
      <ProductsInfoInspector
        content={content as ProductsInfoContent}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "home.partners") {
    return (
      <PartnersInspector
        content={content as PartnersContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "home.stats") {
    return <StatsInspector content={content as StatsContent} onPatch={(patch) => onSectionPatch(key, patch)} />;
  }
  if (key === "home.workGallery") {
    return (
      <WorkGalleryInspector
        content={content as WorkGalleryContent}
        {...imageProps}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }
  if (key === "privacy.main" || key === "terms.main") {
    return (
      <LegalMainInspector
        content={content as LegalMainContent}
        sectionKey={key}
        itemNoun={key === "terms.main" ? "Artikel" : "Sectie"}
        itemNounPlural={key === "terms.main" ? "Artikelen" : "Secties"}
        onPatch={(patch) => onSectionPatch(key, patch)}
      />
    );
  }

  const fallbackKey = selection.sectionKey;
  return (
    <p className="text-xs text-white/50">
      Inspector voor <strong>{FIXED_SECTION_DEFS[fallbackKey]?.label ?? fallbackKey}</strong> volgt dezelfde typed
      content API. Gebruik voorlopig de sectielijst voor volgorde/zichtbaarheid.
    </p>
  );
}

export function buildSectionMutation(sectionKey: FixedSectionKey, patch: Record<string, unknown>): CmsMutation {
  return { kind: "section", sectionKey, patch };
}

// Re-export views for editor previews without pulling inspector into public routes.
export { HomeHeroView, FormPageChromeView };
export { ContentAlignControl } from "./ContentAlignControl";
