import * as React from "react";
import type { CmsImage, LogoBackdropResolved } from "@mccoy/cms-schema";
import type { CmsImageCompressProfile } from "./compress-image";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export type BulkUploadedImage = {
  image: CmsImage;
  label: string;
  logoBackdrop?: LogoBackdropResolved;
};

/**
 * Compress + store multiple files in the CMS upload library.
 * Continues after per-file failures; returns successes and error messages.
 */
export async function uploadCmsImagesBulk(
  files: FileList | File[],
  options: {
    profile: CmsImageCompressProfile;
    tags?: string[];
    uploadToMediaLibrary?: (input: {
      file: File;
      profile: CmsImageCompressProfile;
      tags: string[];
      alt?: string;
    }) => Promise<
      | {
          ok: true;
          image: CmsImage;
          label: string;
          reused?: boolean;
          logoBackdrop?: LogoBackdropResolved;
        }
      | { ok: false; reason: string }
    >;
  },
): Promise<{ items: BulkUploadedImage[]; errors: string[] }> {
  const list = Array.from(files);
  const items: BulkUploadedImage[] = [];
  const errors: string[] = [];
  const tags = options.tags ?? [];

  for (const file of list) {
    const label = file.name.replace(/\.[^.]+$/, "").trim() || "Upload";
    try {
      if (options.uploadToMediaLibrary) {
        const result = await options.uploadToMediaLibrary({
          file,
          profile: options.profile,
          tags,
          alt: label,
        });
        if (!result.ok) {
          errors.push(`${file.name}: ${result.reason}`);
          continue;
        }
        items.push({
          image: result.image,
          label: result.label || label,
          ...(result.logoBackdrop ? { logoBackdrop: result.logoBackdrop } : {}),
        });
        continue;
      }
      // Do not create new data-URL embeds — Storage upload is required.
      errors.push(
        `${file.name}: mediabibliotheek-upload ontbreekt (data-URL embeds zijn uitgeschakeld)`,
      );
    } catch {
      errors.push(`${file.name}: upload mislukt`);
    }
  }

  return { items, errors };
}

export function BulkImageAddButton({
  label = "Meerdere afbeeldingen toevoegen",
  profile,
  tags = [],
  disabled,
  onAdded,
  uploadToMediaLibrary,
}: {
  label?: string;
  profile: CmsImageCompressProfile;
  tags?: string[];
  disabled?: boolean;
  onAdded: (items: BulkUploadedImage[]) => void;
  uploadToMediaLibrary?: Parameters<typeof uploadCmsImagesBulk>[1]["uploadToMediaLibrary"];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setStatus(`Bezig met ${files.length} bestand${files.length === 1 ? "" : "en"}…`);
    try {
      const { items, errors } = await uploadCmsImagesBulk(files, {
        profile,
        tags,
        uploadToMediaLibrary,
      });
      if (items.length > 0) onAdded(items);
      if (errors.length > 0) {
        setError(errors.slice(0, 3).join(" · ") + (errors.length > 3 ? ` (+${errors.length - 3})` : ""));
      }
      setStatus(
        items.length > 0
          ? `${items.length} afbeelding${items.length === 1 ? "" : "en"} toegevoegd.`
          : null,
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400/35 bg-sky-400/10 px-3 py-2.5 text-[12px] font-semibold text-sky-100 transition hover:border-sky-400/55 hover:bg-sky-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploaden…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label={label}
        disabled={disabled || busy}
        onChange={(e) => void onPick(e.target.files)}
      />
      {status ? <p className="text-[11px] text-emerald-300/90">{status}</p> : null}
      {error ? (
        <p className="text-[11px] text-amber-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StripTrashIcon() {
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

/** Compact thumbnail strip so editors can see which images are in the section. */
export function ImageStripPreview({
  items,
  assetBaseUrl,
  onSelect,
  selectedId,
  onRemove,
  removeLabel = "Verwijder afbeelding",
  size = "default",
  emptyLabel = "Nog geen afbeeldingen",
}: {
  items: Array<{
    id: string;
    src: string;
    alt?: string;
    title?: string;
    /** Optional card matte class for logo previews. */
    cardClassName?: string;
    /** Optional inline styles (e.g. plate backgroundColor). */
    cardStyle?: React.CSSProperties;
  }>;
  assetBaseUrl?: string;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  /** When set, shows a delete icon on each thumbnail. */
  onRemove?: (id: string) => void;
  /** Accessible label for the delete control (Dutch CMS UI). */
  removeLabel?: string | ((item: { id: string; alt?: string; title?: string }) => string);
  /** `large` = fewer columns, bigger logos (partners). */
  size?: "default" | "large";
  emptyLabel?: string;
}) {
  const mediaSrc = (src: string) => {
    if (!src) return "";
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    if (!assetBaseUrl) return src;
    const path = src.startsWith("/") ? src : `/${src}`;
    return `${assetBaseUrl.replace(/\/$/, "")}${path}`;
  };

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/15 bg-black/20 px-3 py-4 text-center text-[11px] text-white/40">
        {emptyLabel}
      </p>
    );
  }

  const gridClass =
    size === "large" ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "grid grid-cols-3 gap-2 sm:grid-cols-4";
  const padClass = size === "large" ? "p-3" : "p-1.5";

  return (
    <ul className={gridClass} aria-label="Afbeeldingen in deze sectie">
      {items.map((item) => {
        const selected = selectedId === item.id;
        const frameClass = `relative aspect-[4/3] w-full overflow-hidden rounded-lg border transition ${
          item.cardClassName ?? (item.cardStyle ? "" : "bg-black/40")
        } ${
          selected
            ? "border-sky-400/70 ring-1 ring-sky-400/40"
            : "border-white/12 hover:border-white/30"
        }`;
        const img = (
          <img
            src={mediaSrc(item.src)}
            alt=""
            className={`h-full w-full object-contain ${padClass}`}
          />
        );
        const deleteAria =
          typeof removeLabel === "function" ? removeLabel(item) : removeLabel;

        return (
          <li key={item.id} className="relative">
            {onSelect ? (
              <button
                type="button"
                title={item.title || item.alt || item.id}
                aria-pressed={selected}
                onClick={() => onSelect(item.id)}
                className={`${frameClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50`}
                style={item.cardStyle}
              >
                {img}
              </button>
            ) : (
              <div
                className={frameClass}
                title={item.title || item.alt || item.id}
                style={item.cardStyle}
              >
                {img}
              </div>
            )}
            {onRemove ? (
              <button
                type="button"
                className="absolute right-1.5 top-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white/80 shadow-sm transition hover:border-red-400/50 hover:bg-red-500/25 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
                aria-label={deleteAria}
                title={deleteAria}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
              >
                <StripTrashIcon />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
