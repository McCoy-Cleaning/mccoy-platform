import * as React from "react";
import { cms, useCms } from "./store";

type Mode = "off" | "edit" | "preview";

interface EditCtx {
  mode: Mode;
  pageId: string | null;
  /** Read the effective value for a key (draft in edit/preview, saved otherwise). */
  get: (key: string, fallback: string) => string;
  /** Write a draft value (edit mode only). */
  set: (key: string, value: string) => void;
}

const Ctx = React.createContext<EditCtx>({
  mode: "off",
  pageId: null,
  get: (_, fb) => fb,
  set: () => {},
});

/** Map URL pathname to the CMS pageId for the built-in pages. */
export function pageIdForPath(path: string): string | null {
  const p = path.replace(/\/$/, "") || "/";
  const map: Record<string, string> = {
    "/": "page_home",
    "/about": "page_about",
    "/services": "page_services",
    "/products": "page_products",
    "/contact": "page_contact",
    "/vacatures": "page_vacatures",
  };
  return map[p] ?? null;
}

export function EditProvider({ children }: { children: React.ReactNode }) {
  const state = useCms();
  const [mode, setMode] = React.useState<Mode>("off");
  const [pageId, setPageId] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  // Detect mode from URL query params (kept in sync with iframe navigation).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const detect = () => {
      const sp = new URLSearchParams(window.location.search);
      const m = sp.get("_cmsMode") as Mode | null;
      const pid = sp.get("_cmsPage");
      const path = window.location.pathname;
      const resolvedPid = pid || pageIdForPath(path);
      setPageId(resolvedPid);
      setMode(m === "edit" || m === "preview" ? m : "off");
    };
    detect();
    window.addEventListener("popstate", detect);
    return () => window.removeEventListener("popstate", detect);
  }, []);

  // Re-render when store changes.
  React.useEffect(() => setTick((t) => t + 1), [state]);

  const get = React.useCallback(
    (key: string, fallback: string) => {
      if (!pageId) return fallback;
      if (mode === "edit" || mode === "preview") {
        const draft = cms.getDraft(pageId);
        return draft[key] ?? fallback;
      }
      const saved = cms.getSaved(pageId);
      return saved[key] ?? fallback;
    },
    [pageId, mode, tick],
  );

  const set = React.useCallback(
    (key: string, value: string) => {
      if (!pageId || mode !== "edit") return;
      cms.setDraft(pageId, key, value);
    },
    [pageId, mode],
  );

  const value = React.useMemo(() => ({ mode, pageId, get, set }), [mode, pageId, get, set]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEdit() {
  return React.useContext(Ctx);
}

/* ============ Primitives ============ */

/**
 * Inline-editable text. Renders plain text on the site (or preview iframe),
 * and a contentEditable element in edit mode with a subtle outline.
 */
export function Editable({
  k,
  children,
  as = "span",
  className,
  multiline = false,
}: {
  k: string;
  children: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  multiline?: boolean;
}) {
  const { get, set, mode } = useEdit();
  const value = get(k, children);
  const Tag = as as any;

  if (mode !== "edit") {
    return <Tag className={className}>{value}</Tag>;
  }

  return (
    <Tag
      className={`${className ?? ""} outline-none ring-offset-2 ring-offset-transparent rounded-sm transition hover:ring-2 hover:ring-primary/40 focus:ring-2 focus:ring-primary`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const v = e.currentTarget.innerText.trim();
        if (v !== value) set(k, v);
      }}
      ref={(el: HTMLElement | null) => {
        if (el && el.innerText !== value) el.innerText = value;
      }}
    />
  );
}

/**
 * Editable image. In edit mode, hovering shows an "Replace" affordance that
 * triggers a file picker. Returns a data URL and stores it as the override.
 */
export function EditableImg({
  k,
  src,
  alt = "",
  className,
}: {
  k: string;
  src: string;
  alt?: string;
  className?: string;
}) {
  const { get, set, mode } = useEdit();
  const value = get(k, src);
  const inputRef = React.useRef<HTMLInputElement>(null);

  if (mode !== "edit") {
    return <img src={value} alt={alt} className={className} />;
  }

  return (
    <span className="relative group inline-block">
      <img src={value} alt={alt} className={className} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition text-white text-xs font-medium rounded"
      >
        Vervangen
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) {
            alert("Afbeelding groter dan 2MB.");
            return;
          }
          const url = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = reject;
            r.readAsDataURL(f);
          });
          set(k, url);
        }}
      />
    </span>
  );
}