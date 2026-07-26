import * as React from "react";
import { X } from "lucide-react";
import { TEMPLATES, CATEGORY_ORDER } from "@/lib/cms/templates";
import type { BlockType } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

export function TemplatePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: BlockType) => void }) {
  const [cat, setCat] = React.useState<string>("Alle");
  const [q, setQ] = React.useState("");

  const filtered = TEMPLATES.filter((t) => {
    if (cat !== "Alle" && t.category !== cat) return false;
    if (q && !`${t.name} ${t.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-4xl max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0f] shadow-2xl overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/10 p-4">
          <h3 className="text-lg font-bold flex-1">Kies een sectie</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5"><X className="h-4 w-4" /></button>
        </header>
        <div className="border-b border-white/10 p-4 space-y-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek..." className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-[#1e88e5]" />
          <div className="flex gap-1.5 flex-wrap">
            {["Alle", ...CATEGORY_ORDER].map((c) => (
              <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-xs transition", cat === c ? "border-[#1e88e5] bg-[#1e88e5]/20 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white")}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.type}
                  onClick={() => { onPick(t.type); onClose(); }}
                  className="group text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#1e88e5]/50 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#1e88e5]/20 text-[#1e88e5]"><Icon className="h-4 w-4" /></div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40">{t.category}</div>
                  </div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-white/50 mt-1 line-clamp-2">{t.description}</div>
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