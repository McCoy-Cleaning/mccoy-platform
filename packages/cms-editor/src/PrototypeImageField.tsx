import * as React from "react";
import {
  externalImage,
  isSafeExternalUrl,
  type CmsImage,
  type CmsLink,
} from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import { compressProfileFromTags } from "./compress-image";
import {
  CMS_MAX_SOURCE_IMAGE_BYTES,
  readUploadedImages,
  removeUploadedImage,
  type CmsUploadedImageEntry,
} from "./uploaded-images";
import {
  StructuredLinkField,
  PAGE_DESTINATION_LINK_KINDS,
} from "./blocks/StructuredLinkField";
import type { ImagePickerProps } from "./inspector-types";
import { Field, inputClass, iconBtnClass, TrashIcon } from "./inspector-chrome";

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
    let catalog = projectImages;
    if (resolveProjectImage) {
      const resolvedOnly = projectImages.filter((img) => {
        const path = img.path.startsWith("/") ? img.path : `/${img.path}`;
        return Boolean(resolveProjectImage(path) ?? resolveProjectImage(img.path));
      });
      // Once the Storage map has hits, hide local-only paths that 404 on staging/prod.
      // While the map is still empty (loading / empty library), keep the full catalog.
      if (resolvedOnly.length > 0) catalog = resolvedOnly;
    }
    if (preferTags.length === 0) return { scoped: catalog, rest: [] as typeof catalog };
    const score = (img: { tags?: string[] }) =>
      preferTags.reduce((n, tag) => n + (img.tags?.includes(tag) ? 1 : 0), 0);
    const byScore = (a: (typeof catalog)[number], b: (typeof catalog)[number]) =>
      score(b) - score(a) || a.label.localeCompare(b.label);
    const matches = (img: { tags?: string[] }) => preferTags.some((tag) => img.tags?.includes(tag));
    return {
      scoped: catalog.filter(matches).sort(byScore),
      rest: catalog.filter((img) => !matches(img)).sort(byScore),
    };
  }, [projectImages, preferTags, resolveProjectImage]);

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

  const [brokenPaths, setBrokenPaths] = React.useState<Set<string>>(() => new Set());

  const ordered = React.useMemo(() => {
    const base = showAll || preferTags.length === 0 ? [...scoped, ...rest] : [...scoped];
    // Keep the active image visible even when it sits outside the scoped tags.
    let next = base;
    if (value.src && !base.some((img) => pathMatchesValue(img.path))) {
      const orphan = projectImages.find((img) => pathMatchesValue(img.path));
      if (orphan) next = [orphan, ...base];
    }
    return next.filter((img) => !brokenPaths.has(img.path));
  }, [
    showAll,
    preferTags.length,
    scoped,
    rest,
    projectImages,
    value.src,
    pathMatchesValue,
    brokenPaths,
  ]);

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
                    className="h-full w-full object-contain p-1 transition group-hover:scale-[1.04]"
                    loading="lazy"
                    onError={() => {
                      setBrokenPaths((prev) => {
                        if (prev.has(img.path)) return prev;
                        const next = new Set(prev);
                        next.add(img.path);
                        return next;
                      });
                    }}
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
