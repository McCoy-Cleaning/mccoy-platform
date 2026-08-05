import * as React from "react";
import {
  createDefaultBlock,
  localImage,
  resolveCmsButtonUiMode,
  type CmsButton,
  type CmsButtonUiMode,
  type CmsImage,
  type CmsLink,
  type PopupContentBlockType,
} from "@mccoy/cms-schema";
import { StructuredLinkField, PAGE_DESTINATION_LINK_KINDS } from "./StructuredLinkField";
import { EnDraftFor } from "./en-draft-fields";
import { getPopupContentEditor } from "./popup-editor-bridge";
import { PopupContentTypeChooser } from "./PopupContentTypePicker";
import type { CmsImagePickerProps } from "../image-picker-props";
import { EmptyHint, Field, Section, inputClass, selectClass } from "./field-chrome";

export { EmptyHint, Field, Section, inputClass, selectClass };

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

function ActionToggle({
  mode,
  onChange,
  allowPopup,
}: {
  mode: CmsButtonUiMode;
  onChange: (next: CmsButtonUiMode) => void;
  allowPopup: boolean;
}) {
  const options: Array<{ key: CmsButtonUiMode; label: string }> = [
    { key: "none", label: "Geen link" },
    { key: "page", label: "Pagina" },
    { key: "external", label: "Externe link" },
  ];
  if (allowPopup) options.push({ key: "popup", label: "Open popup" });

  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-white/70">Wat doet de knop?</p>
      <div
        className="inline-flex flex-wrap rounded-xl border border-white/[0.08] bg-black/30 p-1"
        role="group"
        aria-label="Wat doet de knop?"
      >
        {options.map((opt) => {
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={
                active
                  ? "rounded-lg bg-sky-500 px-3 py-2 text-[13px] font-semibold text-white"
                  : "rounded-lg px-3 py-2 text-[13px] font-semibold text-white/55 hover:text-white"
              }
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function defaultPopupContent(type: PopupContentBlockType = "richText"): NonNullable<CmsButton["popup"]> {
  const block = createDefaultBlock(type);
  return { type, data: block.data };
}

/** True while editing content that lives inside a button popup (disables nested popup action). */
const InsideButtonPopupContext = React.createContext(false);

export function CmsButtonEditor({
  label,
  value,
  onChange,
  enLabelPath,
  allowPopupAction = true,
  nestedPopup = false,
  defaultLabel = "",
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  label: string;
  value: CmsButton | undefined;
  onChange: (next: CmsButton | undefined) => void;
  /** Full EN draft path for the button label (e.g. `block:{id}:cta.label`). */
  enLabelPath?: string;
  /** When false, popup is hidden (used inside popup content). */
  allowPopupAction?: boolean;
  /** True when editing a button that lives inside popup content. */
  nestedPopup?: boolean;
  /** Prefill knoptekst when the editor creates a button from empty. */
  defaultLabel?: string;
  blockId?: string;
} & CmsImagePickerProps) {
  const insidePopupContent = React.useContext(InsideButtonPopupContext);
  const active = value ?? {
    label: defaultLabel,
    link: { type: "none" as const },
  };
  const canPopup = allowPopupAction && !nestedPopup && !insidePopupContent;
  const rawMode = resolveCmsButtonUiMode(active);
  const resolvedMode: CmsButtonUiMode = !canPopup && rawMode === "popup" ? "none" : rawMode;
  const [pinnedMode, setPinnedMode] = React.useState<CmsButtonUiMode | null>(null);
  const mode: CmsButtonUiMode =
    pinnedMode && (pinnedMode !== "popup" || canPopup) ? pinnedMode : resolvedMode;

  React.useEffect(() => {
    if (pinnedMode && resolvedMode === pinnedMode) {
      setPinnedMode(null);
    }
  }, [pinnedMode, resolvedMode]);

  const popup = active.popup ?? defaultPopupContent();
  const popupType: PopupContentBlockType = popup.type;
  const NestedEditor = mode === "popup" ? getPopupContentEditor(popupType) : null;

  const imagePickerProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };

  const setMode = (next: CmsButtonUiMode) => {
    if (!value?.label.trim()) return;
    setPinnedMode(next);
    if (next === "none") {
      onChange({
        label: value.label,
        action: "link",
        link: { type: "none" },
        popup: value.popup,
      });
      return;
    }
    if (next === "page") {
      onChange({
        label: value.label,
        action: "link",
        link:
          value.link?.type === "internal" || value.link?.type === "internal_route"
            ? value.link
            : { type: "internal_route", route: "contact" },
        popup: value.popup,
      });
      return;
    }
    if (next === "external") {
      onChange({
        label: value.label,
        action: "link",
        link:
          value.link?.type === "external"
            ? value.link
            : { type: "external", url: "https://", openInNewTab: true },
        popup: value.popup,
      });
      return;
    }
    onChange({
      label: value.label,
      action: "popup",
      link: { type: "none" },
      popup: value.popup ?? defaultPopupContent(),
    });
  };

  const nestedEditor = NestedEditor ? (
    <NestedEditor
      value={popup.data}
      onChange={(next) => {
        const data =
          next && typeof next === "object" && !Array.isArray(next)
            ? (next as Record<string, unknown>)
            : popup.data;
        onChange({
          ...value!,
          action: "popup",
          link: { type: "none" },
          popup: { type: popupType, data },
        });
      }}
      presentation="inspector"
      blockId={blockId ? `${blockId}-popup` : undefined}
      {...imagePickerProps}
    />
  ) : (
    <EmptyHint>Deze inhoud kan hier niet worden bewerkt.</EmptyHint>
  );

  return (
    <Section title={label}>
      <Field label="Knoptekst" hint={!value ? "Leeg laten om knop te verbergen" : undefined}>
        <input
          className={inputClass}
          value={value?.label ?? ""}
          placeholder={defaultLabel || "Bijv. Neem contact op"}
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
        <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <ActionToggle mode={mode} onChange={setMode} allowPopup={canPopup} />

          {mode === "none" ? (
            <p className="text-[13px] leading-relaxed text-white/45">
              De knoptekst wordt niet getoond als klikbare link op de website.
            </p>
          ) : null}

          {mode === "page" || mode === "external" ? (
            <StructuredLinkField
              label={mode === "page" ? "Welke pagina?" : "Externe URL"}
              value={
                mode === "external" && value.link?.type !== "external"
                  ? { type: "external", url: "https://", openInNewTab: true }
                  : value.link
              }
              onChange={(link) => {
                if (!link) {
                  onChange({ ...value, action: "link", link: { type: "none" } });
                  setPinnedMode("none");
                  return;
                }
                if (link.type === "external") setPinnedMode("external");
                if (link.type === "internal" || link.type === "internal_route") {
                  setPinnedMode("page");
                }
                onChange({ ...value, action: "link", link });
              }}
              hideTypeToggle
              allowedKinds={
                mode === "page"
                  ? ["internal_route", "internal"]
                  : ["external"]
              }
            />
          ) : null}

          {mode === "popup" ? (
            <div className="space-y-4">
              <PopupContentTypeChooser
                value={popupType}
                onChange={(type) => {
                  onChange({
                    ...value,
                    action: "popup",
                    link: { type: "none" },
                    popup: defaultPopupContent(type),
                  });
                }}
              />
              <div className="space-y-3 rounded-xl border border-white/[0.08] bg-black/25 p-3.5">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-white/45">
                  Inhoud van de popup
                </p>
                <InsideButtonPopupContext.Provider value={true}>
                  {nestedEditor}
                </InsideButtonPopupContext.Provider>
              </div>
            </div>
          ) : null}
        </div>
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
                    <img src={mediaSrc(src)} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
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
