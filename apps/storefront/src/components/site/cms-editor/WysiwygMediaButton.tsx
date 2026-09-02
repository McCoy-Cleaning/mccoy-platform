import * as React from "react";
import { createPortal } from "react-dom";
import { AppWindow, ImagePlus, Link2 } from "lucide-react";
import {
  createDefaultBlock,
  listPopupContentTypeOptions,
  resolveCmsButtonUiMode,
  type BuiltinRouteKey,
  type CmsButton,
  type CmsButtonUiMode,
  type CmsImage,
  type CmsLink,
  type FixedSectionKey,
  type PopupContentBlockType,
} from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

type MediaTarget =
  | {
      kind: "section";
      sectionKey: FixedSectionKey;
      field: string;
      listItemId?: string;
      listImageKey?: string;
    }
  | { kind: "block"; blockId: string; field: string; listItemId?: string; listImageKey?: string };

/** Floating replace control over the real image — opens admin media picker. */
export function WysiwygMediaFrame({
  children,
  target,
  className,
  image,
  emptyLabel = "Afbeelding toevoegen",
  emptyAspectClass = "aspect-[4/3]",
  emptyPlaceholder = false,
}: {
  children: React.ReactNode;
  target: MediaTarget;
  className?: string;
  /** When missing, show a dashed upload placeholder instead of empty space. */
  image?: CmsImage | null;
  emptyLabel?: string;
  emptyAspectClass?: string;
  /** When true and image is missing, show dashed upload tile instead of children. */
  emptyPlaceholder?: boolean;
}) {
  const { showEditorChrome, sendUiCommand } = useLiveEditApi();
  const [hovered, setHovered] = React.useState(false);

  const openPicker = () => {
    sendUiCommand({ kind: "openMediaPicker", target });
  };

  if (!showEditorChrome) return <>{children}</>;

  if (!image && emptyPlaceholder) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          data-cms-editor-chrome
          data-cms-media-placeholder=""
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-sky-400/40 bg-sky-500/5 px-4 py-8 text-sm font-semibold text-sky-200",
            "hover:border-sky-400/70 hover:bg-sky-500/10",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300",
            emptyAspectClass,
          )}
          aria-label={emptyLabel}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openPicker();
          }}
        >
          <ImagePlus className="h-5 w-5" aria-hidden />
          {emptyLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn("relative", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {children}
      {hovered ? (
        <div
          data-cms-editor-chrome
          className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center"
        >
          <button
            type="button"
            data-cms-editor-chrome
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            aria-label="Afbeelding vervangen"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openPicker();
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Vervangen
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Compact popover: knoptekst + bestemming (pagina / URL / popup). */
export function WysiwygButtonEditor({
  button,
  onChange,
  children,
}: {
  button: CmsButton;
  onChange: (next: CmsButton) => void;
  children: React.ReactNode;
}) {
  const { showEditorChrome } = useLiveEditApi();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(button.label);
  const [mode, setMode] = React.useState<CmsButtonUiMode>(() => resolveCmsButtonUiMode(button));
  const [href, setHref] = React.useState(linkToHref(button.link));
  const [popupType, setPopupType] = React.useState<PopupContentBlockType>(
    () => button.popup?.type ?? "richText",
  );
  const popupOptions = React.useMemo(() => listPopupContentTypeOptions(), []);
  const labelInputRef = React.useRef<HTMLInputElement | null>(null);
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = React.useState<{ top: number; left: number; place: "below" | "above" } | null>(
    null,
  );

  React.useEffect(() => {
    // Don't clobber in-progress edits while the panel is open.
    if (open) return;
    setLabel(button.label);
    setMode(resolveCmsButtonUiMode(button));
    setHref(linkToHref(button.link));
    setPopupType(button.popup?.type ?? "richText");
  }, [button, open]);

  React.useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    const PANEL_W = 320;
    const PANEL_H = 420;
    const GAP = 8;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - GAP;
      const place: "below" | "above" = spaceBelow >= Math.min(PANEL_H, 280) ? "below" : "above";
      let top = place === "below" ? r.bottom + GAP : Math.max(GAP, r.top - PANEL_H - GAP);
      let left = r.left;
      left = Math.min(left, window.innerWidth - PANEL_W - GAP);
      left = Math.max(GAP, left);
      if (place === "above") {
        top = Math.min(top, r.top - GAP);
        top = Math.max(GAP, top);
      }
      setPanelPos({ top, left, place });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => labelInputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open, panelPos]);

  if (!showEditorChrome) return <>{children}</>;

  const apply = () => {
    const nextLabel = label.trim() || button.label;
    if (mode === "none") {
      onChange({
        label: nextLabel,
        action: "link",
        link: { type: "none" },
        popup: button.popup,
      });
    } else if (mode === "popup") {
      const block = createDefaultBlock(popupType);
      onChange({
        label: nextLabel,
        action: "popup",
        link: { type: "none" },
        popup: { type: popupType, data: block.data },
      });
    } else if (mode === "external") {
      const raw = href.trim() || "https://";
      onChange({
        label: nextLabel,
        action: "link",
        link: {
          type: "external",
          url: /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
          openInNewTab: true,
        },
        popup: button.popup,
      });
    } else {
      // page
      onChange({
        label: nextLabel,
        action: "link",
        link: hrefToLink(href.trim() || linkToHref(button.link) || "/contact"),
        popup: button.popup,
      });
    }
    setOpen(false);
  };

  const panel =
    open && panelPos
      ? createPortal(
          <div
            data-cms-editor-chrome
            role="dialog"
            aria-label="Knopinstellingen"
            className="fixed z-[200] max-h-[min(28rem,calc(100vh-1rem))] w-80 overflow-y-auto rounded-xl border border-white/15 bg-[#0d1017] p-3 text-left shadow-2xl"
            style={{ top: panelPos.top, left: panelPos.left }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Tekst
              <input
                ref={labelInputRef}
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>

            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              Bestemming
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Bestemming">
              {(
                [
                  { id: "page" as const, label: "Pagina", hint: "Interne route" },
                  { id: "external" as const, label: "URL", hint: "Externe link" },
                  { id: "popup" as const, label: "Popup", hint: "Modaal venster" },
                  { id: "none" as const, label: "Geen", hint: "Alleen tekst" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === opt.id}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-left",
                    mode === opt.id
                      ? "border-sky-400/50 bg-sky-400/15"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25",
                  )}
                  onClick={() => setMode(opt.id)}
                >
                  <span className="block text-xs font-semibold text-white">{opt.label}</span>
                  <span className="block text-[10px] text-white/45">{opt.hint}</span>
                </button>
              ))}
            </div>

            {mode === "page" || mode === "external" ? (
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
                {mode === "page" ? "Pagina / pad" : "URL"}
                <input
                  className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder={mode === "page" ? "/contact" : "https://…"}
                />
              </label>
            ) : null}

            {mode === "popup" ? (
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-white/50">
                Popup-inhoud
                <select
                  className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                  value={popupType}
                  onChange={(e) => setPopupType(e.target.value as PopupContentBlockType)}
                >
                  {popupOptions.map((opt) => (
                    <option key={opt.type} value={opt.type} className="bg-[#0d1017]">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {mode === "none" ? (
              <p className="mt-3 text-xs leading-relaxed text-white/45">
                De knoptekst wordt getoond zonder klikbare bestemming.
              </p>
            ) : null}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-2.5 py-1 text-xs text-white/60 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Annuleren
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
                onClick={apply}
              >
                {mode === "popup" ? (
                  <AppWindow className="h-3 w-3" aria-hidden />
                ) : (
                  <Link2 className="h-3 w-3" aria-hidden />
                )}
                Toepassen
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className="relative inline-flex max-w-full">
      {/* Published pixels stay inert in edit mode; overlay owns open/close. */}
      <span className="pointer-events-none inline-flex">{children}</span>
      <button
        type="button"
        data-cms-inline-edit=""
        aria-expanded={open}
        aria-label={`Knop bewerken: ${button.label}`}
        tabIndex={open ? -1 : 0}
        className={cn(
          "absolute inset-0 z-[1] rounded-full outline-none transition",
          open ? "pointer-events-none ring-2 ring-sky-400" : "hover:ring-2 hover:ring-sky-400/50",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      />
      {panel}
    </div>
  );
}

const BUILTIN_ROUTES = new Set<string>([
  "home",
  "services",
  "products",
  "about",
  "contact",
  "vacatures",
  "offerte",
  "privacy",
  "terms",
]);

function linkToHref(link: CmsLink): string {
  if (link.type === "internal_route") {
    return link.route === "home" ? "/" : `/${link.route}`;
  }
  if (link.type === "internal") return link.pageId;
  if (link.type === "external") return link.url;
  if (link.type === "email") return `mailto:${link.email}`;
  if (link.type === "phone") return `tel:${link.phone}`;
  return "";
}

function hrefToLink(raw: string): CmsLink {
  const value = raw.trim();
  if (value.startsWith("mailto:")) return { type: "email", email: value.slice(7) };
  if (value.startsWith("tel:")) return { type: "phone", phone: value.slice(4) };
  if (/^https?:\/\//i.test(value)) return { type: "external", url: value };
  const path = value.replace(/^\//, "");
  const routeKey = (!path || path === "/" ? "home" : path.split("/")[0]!) as BuiltinRouteKey;
  if (BUILTIN_ROUTES.has(routeKey)) {
    return { type: "internal_route", route: routeKey };
  }
  return { type: "external", url: value.startsWith("/") ? value : `/${value}` };
}

export type { CmsImage };
