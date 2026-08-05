import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import {
  Globe2,
  Trash2,
  Pencil,
  Eye,
  ExternalLink,
  Layers,
  Navigation,
  ImageIcon,
  Lightbulb,
} from "lucide-react";
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
    const refresh = () => {
      void cms.reconcileLocalCustomPagesWithServer();
    };
    refresh();
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        icon={Globe2}
        accent="#1e88e5"
        title="Uw website"
        subtitle="Kies een pagina om teksten en foto's aan te passen."
        actions={[
          { label: "Bekijk live website", icon: ExternalLink, href: (import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined) || "http://localhost:5173" },
        ]}
      />

      <div className="flex items-start gap-3 rounded-2xl border border-[#1e88e5]/25 bg-[#1e88e5]/[0.07] p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1e88e5]/15 text-[#2f9ff0]">
          <Lightbulb className="h-5 w-5" />
        </span>
        <p className="text-[15px] leading-relaxed text-white/70">
          <strong className="font-semibold text-white">Zo werkt het:</strong> klik op{" "}
          <strong className="font-semibold text-white">Aanpassen</strong> bij een pagina. U ziet dan
          direct een voorbeeld van uw website. Pas gerust aan — niets gaat live voordat u op{" "}
          <strong className="font-semibold text-white">Opslaan &amp; publiceren</strong> klikt.
        </p>
      </div>

      <section aria-labelledby="website-pages-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="website-pages-heading" className="text-lg font-semibold text-white/90">
            Pagina's ({publishedPages.length})
          </h2>
          {customCount > 0 ? (
            <span className="text-sm text-white/45">{customCount} zelf gemaakt</span>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishedPages.map((p) => {
            const inNav = p.isCustom
              ? customPageIsInNavigation(publishedNav, p.id)
              : p.inNav;
            return (
              <article
                key={p.id}
                className="group relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-[#1e88e5]/40 hover:bg-white/[0.07] hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)]"
              >
                <Link
                  to="/admin/website/$pageId"
                  params={{ pageId: p.id }}
                  className="block min-w-0 flex-1"
                  aria-label={`${p.title} aanpassen`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1e88e5]/15 text-[#2f9ff0]">
                      <Layers className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-bold tracking-tight">{p.title}</div>
                      <div className="truncate text-sm text-white/40 font-mono">{p.slug}</div>
                    </div>
                    {p.isCustom && (
                      <span className="shrink-0 rounded-full border border-purple-400/30 bg-purple-400/10 px-2.5 py-1 text-xs font-semibold text-purple-200">
                        Eigen
                      </span>
                    )}
                  </div>
                  <p className="mt-4 min-h-[3rem] text-[15px] leading-relaxed text-white/55 line-clamp-2">
                    {p.description}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-sm text-white/45">
                    <span>{countEditorSections(p.layout)} secties</span>
                    <span aria-hidden>·</span>
                    <span className={inNav ? "font-medium text-emerald-300" : ""}>
                      {inNav ? "Zichtbaar in het menu" : "Niet in het menu"}
                    </span>
                  </div>
                </Link>
                <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4">
                  <Link
                    to="/admin/website/$pageId"
                    params={{ pageId: p.id }}
                    className="a-btn a-btn-primary flex-1"
                  >
                    <Pencil className="h-4 w-4" />
                    Aanpassen
                  </Link>
                  <a
                    href={p.slug}
                    target="_blank"
                    rel="noreferrer"
                    className="a-icon-btn"
                    title="Bekijk op de live website"
                    aria-label={`${p.title} bekijken op de live website`}
                  >
                    <Eye className="h-5 w-5" />
                  </a>
                  {p.isCustom && (
                    <button
                      type="button"
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
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 transition hover:border-red-400/50 hover:bg-red-500/20"
                      title="Pagina verwijderen"
                      aria-label={`${p.title} verwijderen`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="website-extra-heading">
        <div className="mb-4">
          <h2 id="website-extra-heading" className="text-lg font-semibold text-white/90">
            Ook handig
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/admin/website/media"
            className="group relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-[#1e88e5]/40 hover:bg-white/[0.07]"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1e88e5]/15 text-[#2f9ff0]">
                <ImageIcon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold tracking-tight">Foto's &amp; bestanden</div>
                <div className="text-sm text-white/45">Uw mediabibliotheek</div>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55">
              Al uw afbeeldingen op één plek: uploaden, hergebruiken en opruimen.
            </p>
          </Link>
          <Link
            to="/admin/website/other/navigation"
            className="group relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-[#1e88e5]/40 hover:bg-white/[0.07]"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#1e88e5]/15 text-[#2f9ff0]">
                <Navigation className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold tracking-tight">Menu bovenaan</div>
                <div className="text-sm text-white/45">Navigatie van de website</div>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55">
              Bepaal welke knoppen bezoekers bovenaan de website zien.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
