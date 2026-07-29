import * as React from "react";
import {
  localImage,
  type CmsButton,
  type CmsImage,
  type CmsLink,
} from "@mccoy/cms-schema";
import { StructuredLinkField, PAGE_DESTINATION_LINK_KINDS } from "./StructuredLinkField";
import { EnDraftFor } from "./en-draft-fields";

export const inputClass =
  "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-[15px] text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-sky-400/50";

export const selectClass = `${inputClass} cursor-pointer`;

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = React.useId();
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className="block space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-white/65">
        {label}
      </label>
      {control}
      {hint ? <span className="block text-xs text-white/40">{hint}</span> : null}
    </div>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-[13px] font-semibold uppercase tracking-wider text-white/55">{title}</h4>
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/15 px-4 py-4 text-[13px] leading-relaxed text-white/50">{children}</p>;
}

/** Typed internal/external link — delegates to shared StructuredLinkField. */
export function BlockLinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CmsLink | null;
  onChange: (link: CmsLink | null) => void;
}) {
  return (
    <StructuredLinkField
      label={label}
      value={value}
      onChange={onChange}
      allowedKinds={PAGE_DESTINATION_LINK_KINDS}
    />
  );
}

export function CmsButtonEditor({
  label,
  value,
  onChange,
  enLabelPath,
}: {
  label: string;
  value: CmsButton | undefined;
  onChange: (next: CmsButton | undefined) => void;
  /** Full EN draft path for the button label (e.g. `block:{id}:cta.label`). */
  enLabelPath?: string;
}) {
  const active = value ?? { label: "", link: { type: "internal_route" as const, route: "contact" as const } };
  return (
    <Section title={label}>
      <Field label="Knoptekst" hint={!value ? "Leeg laten om knop te verbergen" : undefined}>
        <input
          className={inputClass}
          value={value?.label ?? ""}
          placeholder="Bijv. Neem contact op"
          onChange={(e) => {
            const labelText = e.target.value;
            if (!labelText.trim()) {
              onChange(undefined);
              return;
            }
            onChange({ ...active, label: labelText });
          }}
        />
      </Field>
      <EnDraftFor fieldPath={enLabelPath} label="Knoptekst" />
      {value ? (
        <BlockLinkField
          label="Link"
          value={value.link}
          onChange={(link) => {
            if (!link) {
              onChange(undefined);
              return;
            }
            onChange({ ...value, link });
          }}
        />
      ) : null}
    </Section>
  );
}

const PLACEHOLDER = localImage("/images/hero-placeholder.jpg", "Afbeelding");
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export function BlockImageField({
  label,
  value,
  onChange,
  projectImages = [],
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems = [],
  resolveProjectImage,
  preferTags = [],
  enAltPath,
}: {
  label: string;
  value: CmsImage | undefined;
  onChange: (next: CmsImage | undefined) => void;
  preferTags?: string[];
  /** Full EN draft path for alt text (e.g. `block:{id}:image.alt`). */
  enAltPath?: string;
} & import("../image-picker-props").CmsImagePickerProps) {
  const img = value;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null);
  const [srcError, setSrcError] = React.useState<string | null>(null);

  const mediaSrc = (src: string) => {
    if (!src) return "";
    if (/^(https?:|data:|blob:)/i.test(src)) return src;
    if (!assetBaseUrl) return src;
    const path = src.startsWith("/") ? src : `/${src}`;
    return `${assetBaseUrl.replace(/\/$/, "")}${path}`;
  };

  const onUploadFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadStatus(null);
    if (!uploadToMediaLibrary) {
      setUploadError(
        "Uploaden naar de mediabibliotheek is niet beschikbaar. Kies een projectpad of https-URL.",
      );
      return;
    }
    setUploadBusy(true);
    setUploadStatus("Uploaden naar mediabibliotheek…");
    try {
      const result = await uploadToMediaLibrary({
        file,
        profile: preferTags.some((t) => t === "logo" || t === "brand") ? "logo" : "photo",
        tags: preferTags.length > 0 ? preferTags : ["cms"],
        alt: value?.alt || label,
      });
      if (!result.ok) {
        setUploadStatus(null);
        setUploadError(result.reason);
        return;
      }
      onChange({
        ...result.image,
        alt: value?.alt || result.image.alt || result.label || label,
        decorative: value?.decorative === true,
      });
      setUploadStatus(
        result.reused
          ? "Bestaande afbeelding uit bibliotheek hergebruikt."
          : "Geüpload naar mediabibliotheek.",
      );
    } catch {
      setUploadStatus(null);
      setUploadError("Uploaden mislukt. Probeer een ander bestand.");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applyLocalPath = (path: string, altFallback?: string) => {
    const src = path.startsWith("/") ? path : `/${path}`;
    const resolved = resolveProjectImage?.(src) ?? resolveProjectImage?.(path);
    if (resolved) {
      onChange({
        ...resolved,
        alt: value?.alt || resolved.alt || altFallback || label,
        decorative: value?.decorative === true,
      });
      return;
    }
    setSrcError(null);
    onChange({
      assetId: `local:${src.replace(/^\//, "")}`,
      src,
      alt: value?.alt || altFallback || label,
      decorative: value?.decorative === true,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-white/60">{label}</p>
        {value ? (
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[13px] font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
            onClick={() => onChange(undefined)}
          >
            Verwijderen
          </button>
        ) : null}
      </div>
      {img ? (
        <div
          className="relative overflow-hidden rounded-lg border border-white/10 bg-black/40"
          style={{ aspectRatio: "16 / 10", maxHeight: 144 }}
        >
          <img
            src={mediaSrc(img.src)}
            alt={img.decorative ? "" : img.alt || label}
            className="h-full w-full object-contain"
            aria-hidden={img.decorative === true}
          />
        </div>
      ) : (
        <EmptyHint>
          {uploadToMediaLibrary
            ? "Geen afbeelding — upload naar de mediabibliotheek of kies een projectpad."
            : "Geen afbeelding — vul een pad of https-URL in."}
        </EmptyHint>
      )}

      {uploadToMediaLibrary ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <button
            type="button"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-sky-400/35 bg-sky-400/10 px-4 text-[15px] font-semibold text-sky-100 hover:bg-sky-400/15 disabled:opacity-50"
            disabled={uploadBusy}
            aria-busy={uploadBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadBusy ? "Uploaden…" : "Foto uploaden vanaf uw apparaat"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label={`${label} uploaden`}
            disabled={uploadBusy}
            onChange={(e) => void onUploadFile(e.target.files)}
          />
          {uploadStatus ? (
            <p className="text-[13px] text-emerald-300/90" role="status">
              {uploadStatus}
            </p>
          ) : null}
          {uploadError ? (
            <p className="text-[13px] text-red-300" role="alert">
              {uploadError}
            </p>
          ) : null}
        </div>
      ) : null}

      {projectImages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-white/50">Of kies een bestaande projectfoto:</p>
          <div className="grid grid-cols-4 gap-2" role="listbox" aria-label={`${label} kiezen`}>
            {(preferTags.length > 0
              ? [
                  ...projectImages.filter((p) => preferTags.some((t) => p.tags?.includes(t))),
                  ...projectImages.filter((p) => !preferTags.some((t) => p.tags?.includes(t))),
                ]
              : projectImages
            )
              .slice(0, 12)
              .map((item) => {
                const src = item.path.startsWith("/") ? item.path : `/${item.path}`;
                const selected = value?.src === src || value?.src.endsWith(src);
                return (
                  <button
                    key={item.path}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={item.label}
                    onClick={() => applyLocalPath(item.path, item.label)}
                    className={`h-14 overflow-hidden rounded-lg border bg-black/50 ${
                      selected ? "border-sky-400 ring-2 ring-sky-400/50" : "border-white/10 hover:border-white/35"
                    }`}
                  >
                    <img src={mediaSrc(src)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}

      <details className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <summary className="cursor-pointer text-[13px] text-white/60 hover:text-white/85">
          Pad of https-URL
        </summary>
        <div className="mt-2 space-y-2 pb-1">
          <Field label="Bron">
            <input
              className={inputClass}
              value={value?.src?.startsWith("data:") ? "" : (value?.src ?? "")}
              placeholder="/images/… of https://…"
              onChange={(e) => {
                const src = e.target.value.trim();
                if (!src) {
                  setSrcError(null);
                  onChange(undefined);
                  return;
                }
                if (/^data:/i.test(src)) {
                  setSrcError(
                    "Data-URL's zijn niet toegestaan. Upload naar de mediabibliotheek.",
                  );
                  return;
                }
                setSrcError(null);
                onChange({
                  assetId: value?.assetId?.startsWith("storage:")
                    ? value.assetId
                    : `local:${src.replace(/^\//, "")}`,
                  src,
                  alt: value?.alt || label,
                  decorative: value?.decorative === true,
                });
              }}
            />
          </Field>
          {srcError ? (
            <p className="text-[13px] text-amber-200" role="alert">
              {srcError}
            </p>
          ) : null}
        </div>
      </details>
      <Field label="Alt-tekst">
        <input
          className={inputClass}
          value={value?.alt ?? ""}
          onChange={(e) => {
            if (!value) {
              onChange({ ...PLACEHOLDER, alt: e.target.value });
              return;
            }
            onChange({ ...value, alt: e.target.value });
          }}
        />
      </Field>
      <EnDraftFor fieldPath={enAltPath} label="Alt-tekst" />
      <label className="flex items-center gap-2.5 text-[13px] text-white/75">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-white/20 accent-sky-500"
          checked={value?.decorative === true}
          onChange={(e) => {
            if (!value) return;
            onChange({ ...value, decorative: e.target.checked });
          }}
          disabled={!value}
        />
        Decoratief (verberg voor screenreaders)
      </label>
      {!value ? (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[13px] font-medium text-sky-300 transition hover:bg-sky-400/10"
          onClick={() => onChange({ ...PLACEHOLDER })}
        >
          Standaard placeholder gebruiken
        </button>
      ) : null}
    </div>
  );
}
