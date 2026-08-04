import * as React from "react";
import { X } from "lucide-react";
import {
  blockedBlockTypesForPage,
  getBlockDataDefinition,
  UNPUBLISHABLE_BLOCK_WARNING_NL,
  type CmsPage,
} from "@mccoy/cms-schema";
import { SectionTypeThumbnail } from "@mccoy/cms-editor";
import { TEMPLATES, CATEGORY_ORDER, PAGE_PARITY_BLOCK_TYPES, templateId } from "@/lib/cms/templates";
import type { BlockType } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

export function TemplatePicker({
  open,
  onClose,
  onPick,
  page,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: BlockType, templateId: string) => void;
  /** When set, page-level block instance policies hide saturated types. */
  page?: CmsPage | null;
}) {
  const [cat, setCat] = React.useState<string>("Pagina");
  const [q, setQ] = React.useState("");
  const searchId = React.useId();
  const titleId = React.useId();
  const blocked = React.useMemo(
    () => (page ? new Set(blockedBlockTypesForPage(page)) : new Set<BlockType>()),
    [page],
  );

  React.useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = TEMPLATES.filter((t) => {
    if (blocked.has(t.type)) return false;
    if (cat === "Pagina") {
      if (!PAGE_PARITY_BLOCK_TYPES.includes(t.type)) return false;
    } else if (cat !== "Alle" && t.category !== cat) {
      return false;
    }
    if (q && !`${t.name} ${t.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0a0a0f] shadow-2xl sm:max-h-[80vh] sm:max-w-4xl sm:rounded-3xl"
      >
        <header className="flex items-start gap-3 border-b border-white/10 p-5">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-2xl font-bold tracking-tight text-white">
              Kies een sectie
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              Tik op een voorbeeld om het aan uw pagina toe te voegen — daarna vult u het zelf in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 border-b border-white/10 p-5">
          <label htmlFor={searchId} className="sr-only">
            Zoek sectietype
          </label>
          <input
            id={searchId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek… (bijvoorbeeld galerij of tekst)"
            className="a-input"
          />
          <div className="flex flex-wrap gap-2">
            {["Pagina", "Alle", ...CATEGORY_ORDER].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  cat === c
                    ? "border-[#1e88e5] bg-[#1e88e5]/20 text-white"
                    : "border-white/10 bg-white/5 text-white/60 hover:text-white",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/45">Geen resultaten.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => {
                const tid = templateId(t);
                const publishable = getBlockDataDefinition(t.type).capabilities.publishable;
                return (
                  <button
                    key={tid}
                    type="button"
                    data-cms-template={tid}
                    aria-label={`${t.name}. ${t.description}`}
                    onClick={() => {
                      onPick(t.type, tid);
                      onClose();
                    }}
                    className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#1e88e5]/50 hover:bg-white/[0.07]"
                  >
                    <SectionTypeThumbnail type={t.type} className="mb-3" />
                    <div className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                      {t.category}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-white">{t.name}</span>
                      {!publishable ? (
                        <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                          Nog niet publiceerbaar
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/55">
                      {t.description}
                    </p>
                    {!publishable ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-snug text-amber-200/90">
                        {UNPUBLISHABLE_BLOCK_WARNING_NL}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
