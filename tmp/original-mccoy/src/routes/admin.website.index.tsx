import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Globe2, Plus, Trash2, Pencil, Eye, ExternalLink, Layers } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { cms, useCms } from "@/lib/cms/store";

export const Route = createFileRoute("/admin/website/")({
  component: WebsitePage,
});

function WebsitePage() {
  const state = useCms();
  const [showNew, setShowNew] = React.useState(false);
  const customCount = state.pages.filter((p) => p.isCustom && !p.isDraftOnly).length;
  const publishedPages = state.pages.filter((p) => !p.isCustom || !p.isDraftOnly);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Globe2}
        accent="#1e88e5"
        title="Website"
        subtitle="Klik op een pagina om secties te bewerken, toe te voegen of te verwijderen."
        actions={[
          { label: "Live site", icon: ExternalLink, href: "/" },
          { label: "Nieuwe pagina", icon: Plus, onClick: () => setShowNew(true) },
        ]}
      />

      <div className="rounded-2xl border border-[#1e88e5]/20 bg-[#1e88e5]/5 p-4 text-xs text-white/60">
        <strong className="text-white/80">Tip:</strong> alle wijzigingen worden lokaal opgeslagen (mock backend). Afbeeldingen tellen mee voor de opslag — houd het beperkt tot enkele per pagina.
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Pagina's ({state.pages.length})</h3>
          <span className="text-[11px] text-white/40">{customCount}/4 aangepaste pagina's</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {publishedPages.map((p) => (
            <div key={p.id} className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-[#1e88e5]/40 hover:bg-white/[0.06]">
              <Link to="/admin/website/$pageId" params={{ pageId: p.id }} className="block space-y-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1e88e5]/20 text-[#1e88e5]"><Layers className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.title}</div>
                    <div className="truncate text-[11px] text-white/40 font-mono">{p.slug}</div>
                  </div>
                  {p.isCustom && <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-[10px] font-medium text-purple-300">Custom</span>}
                </div>
                <div className="text-xs text-white/50 line-clamp-2 min-h-[2.5rem]">{p.description}</div>
                <div className="flex items-center gap-3 pt-2 border-t border-white/5 text-[11px] text-white/40">
                  <span>{p.blocks.length} secties</span>
                  <span>·</span>
                  <span className={p.inNav ? "text-emerald-300" : ""}>{p.inNav ? "In nav" : "Verborgen"}</span>
                </div>
              </Link>
              <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <a href={p.slug} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white" title="Bekijk live"><Eye className="h-3.5 w-3.5" /></a>
                <Link to="/admin/website/$pageId" params={{ pageId: p.id }} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white" title="Bewerken"><Pencil className="h-3.5 w-3.5" /></Link>
                {p.isCustom && (
                  <button onClick={() => { if (confirm(`Pagina "${p.title}" verwijderen?`)) cms.deletePage(p.id); }} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-red-300" title="Verwijderen"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            </div>
          ))}
          {customCount < 4 && (
            <button onClick={() => setShowNew(true)} className="grid place-items-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] p-5 text-white/40 transition hover:border-[#1e88e5]/50 hover:text-[#1e88e5] min-h-[160px]">
              <div className="flex flex-col items-center gap-2">
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">Nieuwe pagina</span>
                <span className="text-[10px] text-white/30">{4 - customCount} beschikbaar</span>
              </div>
            </button>
          )}
        </div>
      </section>

      {showNew && <NewPageDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewPageDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (title && !slug) setSlug(title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  }, [title, slug]);

  const create = () => {
    try {
      const page = cms.addPage({ title: title.trim(), slug: slug.trim() });
      onClose();
      navigate({ to: "/admin/website/$pageId", params: { pageId: page.id } });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0f] p-6 space-y-4">
        <h3 className="text-lg font-bold">Nieuwe pagina</h3>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-white/50">Titel</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-[#1e88e5]" placeholder="Bijv. Referenties" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wider text-white/50">URL slug</span>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
            <span className="text-sm text-white/40">/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="flex-1 bg-transparent text-sm font-mono outline-none" placeholder="referenties" />
          </div>
        </label>
        {error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-300">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">Annuleren</button>
          <button onClick={create} disabled={!title.trim() || !slug.trim()} className="rounded-xl bg-[#1e88e5] px-4 py-2 text-sm font-semibold disabled:opacity-40">Aanmaken</button>
        </div>
      </div>
    </div>
  );
}