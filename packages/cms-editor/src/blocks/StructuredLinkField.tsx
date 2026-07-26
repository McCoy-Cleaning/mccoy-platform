import * as React from "react";
import {
  BUILTIN_ROUTE_LABELS,
  BUILTIN_ROUTE_PATHS,
  CMS_LINK_UI_LABELS_NL,
  isSafeExternalUrl,
  linkFromLegacyHref,
  parseCmsLink,
  type BuiltinRouteKey,
  type CmsLink,
  type CmsLinkKind,
} from "@mccoy/cms-schema";
import { inputClass, selectClass } from "./shared-fields";

export type StructuredLinkPageOption = {
  id: string;
  title: string;
  slug: string;
};

/** Standard klikbestemming options: geen / pagina / externe (no e-mail or telefoon). */
export const PAGE_DESTINATION_LINK_KINDS: CmsLinkKind[] = [
  "none",
  "internal_route",
  "internal",
  "external",
];

export type StructuredLinkFieldProps = {
  label: string;
  value: CmsLink | string | null | undefined;
  onChange: (link: CmsLink | null) => void;
  /** Which link kinds to offer. Defaults to geen / pagina / externe. */
  allowedKinds?: CmsLinkKind[];
  /** Custom pages for the Pagina grouped picker. */
  pages?: StructuredLinkPageOption[];
  className?: string;
};

type UiMode = "none" | "page" | "external" | "email" | "phone";

/**
 * Editor-facing link normalize: keep incomplete drafts so the UI mode
 * (externe) does not snap back to "geen link" while typing.
 * Publish/actionable checks still use parseCmsLink / isActionableCmsLink.
 */
function toLink(value: CmsLink | string | null | undefined): CmsLink | null {
  if (!value) return null;
  if (typeof value === "string") return linkFromLegacyHref(value);
  const parsed = parseCmsLink(value);
  if (parsed) return parsed;
  if (
    value.type === "none" ||
    value.type === "external" ||
    value.type === "email" ||
    value.type === "phone" ||
    value.type === "internal" ||
    value.type === "internal_route"
  ) {
    return value;
  }
  return null;
}

function kindToUi(kind: CmsLinkKind): UiMode {
  if (kind === "internal_route" || kind === "internal") return "page";
  if (kind === "external") return "external";
  if (kind === "email") return "email";
  if (kind === "phone") return "phone";
  return "none";
}

function pageSelectValue(link: CmsLink | null): string {
  if (link?.type === "internal_route") return `route:${link.route}`;
  if (link?.type === "internal") return `page:${link.pageId}`;
  return "";
}

/**
 * Shared structured link editor for page builders.
 * One Pagina control (grouped builtin + custom) plus externe / geen.
 * Storage still distinguishes internal_route vs internal — never labels “CMS”.
 */
export function StructuredLinkField({
  label,
  value,
  onChange,
  allowedKinds = PAGE_DESTINATION_LINK_KINDS,
  pages = [],
  className,
}: StructuredLinkFieldProps) {
  const link = toLink(value);
  const kinds = allowedKinds.length ? allowedKinds : PAGE_DESTINATION_LINK_KINDS;
  const [externalError, setExternalError] = React.useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = React.useState(
    Boolean(link && "openInNewTab" in link && link.openInNewTab),
  );
  const builtinKeys = Object.keys(BUILTIN_ROUTE_PATHS) as BuiltinRouteKey[];

  const allowNone = kinds.includes("none");
  const allowPage = kinds.includes("internal_route") || kinds.includes("internal");
  const allowExternal = kinds.includes("external");
  const allowEmail = kinds.includes("email");
  const allowPhone = kinds.includes("phone");

  const uiModes: UiMode[] = [];
  if (allowNone) uiModes.push("none");
  if (allowPage) uiModes.push("page");
  if (allowExternal) uiModes.push("external");
  if (allowEmail) uiModes.push("email");
  if (allowPhone) uiModes.push("phone");

  const storedMode = kindToUi(link?.type ?? "none");
  const mode = uiModes.includes(storedMode) ? storedMode : allowNone ? "none" : (uiModes[0] ?? "none");
  const legacyUnsupported =
    (storedMode === "email" || storedMode === "phone") && !uiModes.includes(storedMode);

  const setMode = (next: UiMode) => {
    setExternalError(null);
    if (next === "none") {
      onChange({ type: "none" });
      return;
    }
    if (next === "page") {
      if (kinds.includes("internal_route")) {
        onChange({ type: "internal_route", route: "home" });
        return;
      }
      const first = pages[0];
      if (first) {
        onChange({ type: "internal", pageId: first.id });
        return;
      }
      onChange({ type: "internal_route", route: "contact" });
      return;
    }
    if (next === "external") {
      onChange({ type: "external", url: "https://", openInNewTab: true });
      return;
    }
    if (next === "email") {
      onChange({ type: "email", email: "" });
      return;
    }
    onChange({ type: "phone", phone: "" });
  };

  const onPagePick = (raw: string) => {
    if (raw.startsWith("route:")) {
      const route = raw.slice("route:".length) as BuiltinRouteKey;
      onChange({
        type: "internal_route",
        route,
        openInNewTab: link && "openInNewTab" in link ? link.openInNewTab : undefined,
      });
      return;
    }
    if (raw.startsWith("page:")) {
      onChange({
        type: "internal",
        pageId: raw.slice("page:".length),
        openInNewTab: link && "openInNewTab" in link ? link.openInNewTab : undefined,
      });
    }
  };

  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{label}</p>
        <div
          className="inline-flex flex-wrap rounded-lg border border-white/[0.08] bg-black/30 p-0.5"
          role="group"
          aria-label={`${label} — linktype`}
        >
          {uiModes.map((key) => {
            const text = CMS_LINK_UI_LABELS_NL[key];
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={
                  active
                    ? "rounded-md bg-sky-500 px-2 py-1 text-[10px] font-semibold text-white"
                    : "rounded-md px-2 py-1 text-[10px] font-semibold text-white/50 hover:text-white"
                }
                aria-pressed={active}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>

      {legacyUnsupported ? (
        <p className="text-[11px] text-amber-300/90">
          Deze link was {CMS_LINK_UI_LABELS_NL[storedMode]}. Kies Geen link, Pagina of Externe link.
        </p>
      ) : null}

      {mode === "page" ? (
        <select
          className={selectClass}
          value={pageSelectValue(link)}
          aria-label="Kies een pagina"
          onChange={(e) => onPagePick(e.target.value)}
        >
          {kinds.includes("internal_route") ? (
            <optgroup label="Websitepagina’s">
              {builtinKeys.map((k) => (
                <option key={k} value={`route:${k}`}>
                  {BUILTIN_ROUTE_LABELS[k]} ({BUILTIN_ROUTE_PATHS[k]})
                </option>
              ))}
            </optgroup>
          ) : null}
          {kinds.includes("internal") ? (
            <optgroup label="Aangemaakte pagina’s">
              {pages.length === 0 ? (
                <option value="" disabled>
                  Geen aangemaakte pagina’s
                </option>
              ) : (
                pages.map((p) => (
                  <option key={p.id} value={`page:${p.id}`}>
                    {p.title} ({p.slug})
                  </option>
                ))
              )}
            </optgroup>
          ) : null}
        </select>
      ) : null}

      {mode === "external" ? (
        <div className="space-y-1">
          <input
            type="url"
            className={inputClass}
            placeholder="https://…"
            aria-label="Externe URL"
            value={link?.type === "external" ? link.url : ""}
            onChange={(e) => {
              const url = e.target.value;
              if (url && !isSafeExternalUrl(url, { allowHttpInDev: true }) && url !== "https://") {
                setExternalError("Alleen https:// (of http://localhost in development) is toegestaan.");
              } else {
                setExternalError(null);
              }
              onChange({
                type: "external",
                url,
                openInNewTab: link?.type === "external" ? link.openInNewTab ?? true : true,
              });
            }}
          />
          {externalError ? <p className="text-xs text-red-400">{externalError}</p> : null}
        </div>
      ) : null}

      {mode === "email" && link?.type === "email" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="email"
            className={inputClass}
            placeholder="naam@bedrijf.nl"
            aria-label="E-mailadres"
            value={link.email}
            onChange={(e) => onChange({ type: "email", email: e.target.value, subject: link.subject })}
          />
          <input
            type="text"
            className={inputClass}
            placeholder="Onderwerp (optioneel)"
            aria-label="E-mailonderwerp"
            value={link.subject ?? ""}
            onChange={(e) =>
              onChange({
                type: "email",
                email: link.email,
                subject: e.target.value || undefined,
              })
            }
          />
        </div>
      ) : null}

      {mode === "phone" && link?.type === "phone" ? (
        <input
          type="tel"
          className={inputClass}
          placeholder="+31 6 …"
          aria-label="Telefoonnummer"
          value={link.phone}
          onChange={(e) => onChange({ type: "phone", phone: e.target.value })}
        />
      ) : null}

      {mode !== "none" && mode !== "email" && mode !== "phone" ? (
        <div className="pt-0.5">
          <button
            type="button"
            className="text-[10px] font-medium text-white/35 transition hover:text-white/60"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? "▸ Minder opties" : "▸ Meer opties"}
          </button>
          {advancedOpen && link && "openInNewTab" in link ? (
            <label className="mt-1.5 flex items-center gap-2 text-[11px] text-white/55">
              <input
                type="checkbox"
                checked={!!link.openInNewTab}
                onChange={(e) => onChange({ ...link, openInNewTab: e.target.checked })}
              />
              Openen in nieuw tabblad
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
