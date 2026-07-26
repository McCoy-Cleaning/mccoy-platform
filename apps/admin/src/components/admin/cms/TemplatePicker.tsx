import * as React from "react";
import { X } from "lucide-react";
import {
  blockedBlockTypesForPage,
  getBlockDataDefinition,
  UNPUBLISHABLE_BLOCK_WARNING_NL,
  type CmsPage,
} from "@mccoy/cms-schema";
import { TEMPLATES, CATEGORY_ORDER, PAGE_PARITY_BLOCK_TYPES } from "@/lib/cms/templates";
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
  onPick: (type: BlockType) => void;
  /** When set, page-level block instance policies hide saturated types. */
  page?: CmsPage | null;
}) {
  const [cat, setCat] = React.useState<string>("Pagina");
  const [q, setQ] = React.useState("");
  const blocked = React.useMemo(
    () => (page ? new Set(blockedBlockTypesForPage(page)) : new Set<BlockType>()),
    [page],
  );

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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-4xl max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0f] shadow-2xl overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/10 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">Kies een sectie</h3>
            <p className="mt-0.5 text-[11px] text-white/45">
              Zelfde bloktypes als op de live pagina (hero, tekst, beeld, …).
            </p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><X className="h-4 w-4" /></button>
        </header>
        <div className="border-b border-white/10 p-4 space-y-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek..." className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-[#1e88e5]" />
          <div className="flex gap-1.5 flex-wrap">
            {["Pagina", "Alle", ...CATEGORY_ORDER].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-xs transition", cat === c ? "border-[#1e88e5] bg-[#1e88e5]/20 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white")}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const Icon = t.icon;
              const publishable = getBlockDataDefinition(t.type).capabilities.publishable;
              return (
                <button
                  key={t.type}
                  type="button"
                  data-cms-template={t.type}
                  aria-label={t.name}
                  onClick={() => { onPick(t.type); onClose(); }}
                  className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#1e88e5]/50 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#1e88e5]/20 text-[#1e88e5]"><Icon className="h-4 w-4" /></div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">{t.category}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold">{t.name}</div>
                    {!publishable ? (
                      <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                        Nog niet publiceerbaar
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-white/50 mt-1 line-clamp-2">{t.description}</div>
                  {!publishable ? (
                    <p className="mt-2 text-[10px] leading-snug text-amber-200/90 line-clamp-3">
                      {UNPUBLISHABLE_BLOCK_WARNING_NL}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <div className="text-center text-sm text-white/40 py-12">Geen resultaten.</div>}
        </div>
      </div>
    </div>
  );
}
