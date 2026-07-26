import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Globe2, Trash2, Pencil, Eye, ExternalLink, Layers, Navigation, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { cms, useCms } from "@/lib/cms/store";
import { appConfirm } from "@/lib/app-dialogs";
import { notifyToast } from "@/lib/notify-toast";
import {
  customPageIsInNavigation,
  countEditorSections,
  effectiveSiteNavigation,
} from "@mccoy/cms-schema";

export const Route = createFileRoute("/admin/website/")({
  component: WebsitePage,
});

function WebsitePage() {
  const state = useCms();
  const customCount = state.pages.filter((p) => p.isCustom).length;
  const publishedPages = state.pages.filter((p) => !p.isCustom || !p.isDraftOnly);
  const publishedNav = effectiveSiteNavigation(state.navigation, null);

  React.useEffect(() => {
    void cms.reconcileLocalCustomPagesWithServer();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Globe2}
        accent="#1e88e5"
        title="Website"
        subtitle="Klik op een pagina om secties te bewerken, toe te voegen of te verwijderen."
        actions={[
          { label: "Live site", icon: ExternalLink, href: (import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined) || "http://localhost:5173" },
        ]}
      />

      <div className="rounded-2xl border border-[#1e88e5]/20 bg-[#1e88e5]/5 p-4 text-xs text-white/60">
        <strong className="text-white/80">Tip:</strong> alle wijzigingen worden lokaal opgeslagen (mock backend). Afbeeldingen tellen mee voor de opslag — houd het beperkt tot enkele per pagina.
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Pagina&apos;s ({publishedPages.length})</h3>
          {customCount > 0 ? (
            <span className="text-[11px] text-white/40">{customCount} aangepaste pagina&apos;s</span>
          ) : null}
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
                  <span>{countEditorSections(p.layout)} secties</span>
                  <span>·</span>
                  {(() => {
                    const inNav = p.isCustom
                      ? customPageIsInNavigation(publishedNav, p.id)
                      : p.inNav;
                    return (
                      <span className={inNav ? "text-emerald-300" : ""}>
                        {inNav ? "In nav" : "Verborgen"}
                      </span>
                    );
                  })()}
                </div>
              </Link>
              <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <a href={p.slug} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white" title="Bekijk live"><Eye className="h-3.5 w-3.5" /></a>
                <Link to="/admin/website/$pageId" params={{ pageId: p.id }} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-white" title="Bewerken"><Pencil className="h-3.5 w-3.5" /></Link>
                {p.isCustom && (
                  <button
                    onClick={() => {
                      void (async () => {
                        if (
                          !(await appConfirm({
                            title: `Pagina “${p.title}” verwijderen?`,
                            description:
                              "De pagina verdwijnt uit de website-lijst en is niet meer bewerkbaar. Gepubliceerde inhoud en navigatielinks die ernaar verwijzen moeten apart worden opgeschoond.",
                            confirmLabel: "Verwijderen",
                            tone: "destructive",
                          }))
                        ) {
                          return;
                        }
                        const result = await cms.deletePage(p.id);
                        if (!result.ok) {
                          notifyToast({
                            kind: "error",
                            title: "Verwijderen mislukt",
                            description: result.reason,
                          });
                          return;
                        }
                        notifyToast({ kind: "success", title: "Pagina verwijderd." });
                      })();
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/60 text-white/70 hover:text-red-300"
                    title="Verwijderen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Overig</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/admin/website/media"
            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-[#1e88e5]/40 hover:bg-white/[0.06]"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1e88e5]/20 text-[#1e88e5]">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Mediabibliotheek</div>
                <div className="truncate text-[11px] text-white/40">Supabase Storage</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/50 line-clamp-2 min-h-[2.5rem]">
              Upload, archiveer en hergebruik afbeeldingen voor hero, partners, galerij en meer.
            </div>
          </Link>
          <Link
            to="/admin/website/other/navigation"
            className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-[#1e88e5]/40 hover:bg-white/[0.06]"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#1e88e5]/20 text-[#1e88e5]">
                <Navigation className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Navigatie</div>
                <div className="truncate text-[11px] text-white/40">Sitebreed menu</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/50 line-clamp-2 min-h-[2.5rem]">
              Logo, menu-links en knoppen voor desktop én tablet/mobiel (zelfde compacte ontwerp).
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
