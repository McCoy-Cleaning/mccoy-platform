import * as React from "react";
import { X } from "lucide-react";
import {
  blockedBlockTypesForPage,
  getBlockDataDefinition,
  UNPUBLISHABLE_BLOCK_WARNING_NL,
  type CmsPage,
} from "@mccoy/cms-schema";
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
        <header className="flex items-center gap-3 border-b border-white/10 p-5">
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-bold tracking-tight">Kies een sectie</h3>
            <p className="mt-1 text-sm text-white/50">
              Tik op een blok om het aan uw pagina toe te voegen — daarna vult u het zelf in.
            </p>
          </div>
          <button onClick={onClose} aria-label="Sluiten" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div className="border-b border-white/10 p-5 space-y-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek..." className="a-input" />
          <div className="flex gap-2 flex-wrap">
            {["Pagina", "Alle", ...CATEGORY_ORDER].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-4 py-2 text-sm font-medium transition", cat === c ? "border-[#1e88e5] bg-[#1e88e5]/20 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white")}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const Icon = t.icon;
              const tid = templateId(t);
              const publishable = getBlockDataDefinition(t.type).capabilities.publishable;
              return (
                <button
                  key={tid}
                  type="button"
                  data-cms-template={tid}
                  aria-label={t.name}
                  onClick={() => { onPick(t.type, tid); onClose(); }}
                  className="group text-left rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-[#1e88e5]/50 hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#1e88e5]/15 text-[#2f9ff0]"><Icon className="h-5 w-5" /></div>
                    <div className="text-xs uppercase tracking-wider text-white/40">{t.category}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold">{t.name}</div>
                    {!publishable ? (
                      <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                        Nog niet publiceerbaar
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm leading-relaxed text-white/55 mt-1.5 line-clamp-2">{t.description}</div>
                  {!publishable ? (
                    <p className="mt-2 text-xs leading-snug text-amber-200/90 line-clamp-3">
                      {UNPUBLISHABLE_BLOCK_WARNING_NL}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
