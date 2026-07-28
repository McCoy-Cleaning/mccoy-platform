import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Monitor,
  Smartphone,
  Settings,
  Layers,
  X,
} from "lucide-react";
import { type CmsPage } from "@mccoy/cms-schema";
import { cms, useCms, useEditablePage } from "@/lib/cms/store";
import { useCmsEditParentBridge } from "@/lib/cms/edit-bridge";
import { PageEditor } from "@/components/admin/cms/PageEditor";
import { BuiltinLayoutEditor } from "@/components/admin/cms/BuiltinLayoutEditor";
import {
  LegacyCmsImagesPanel,
  pageHasLegacyEmbeddedImages,
} from "@/components/admin/cms/LegacyCmsImagesPanel";
import { cn } from "@/lib/utils";
import { appConfirm } from "@/lib/app-dialogs";
import { notifyToast } from "@/lib/notify-toast";

export const Route = createFileRoute("/admin/website/$pageId")({
  component: PageEditorRoute,
});

function storefrontOrigin() {
  const fromEnv = import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.port === "5174") {
    return `${window.location.protocol}//${window.location.hostname}:5173`;
  }
  return window.location.origin;
}

/** Probe storefront so the edit iframe does not silently show a broken-document icon. */
function useStorefrontReachability(origin: string, editUrl: string) {
  const [status, setStatus] = React.useState<"checking" | "ok" | "unreachable">("checking");

  React.useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);

    void (async () => {
      let ok = false;
      try {
        await fetch(origin + "/", {
          method: "GET",
          mode: "no-cors",
          signal: ctrl.signal,
          cache: "no-store",
        });
        // no-cors → opaque; reaching the network without throw counts as reachable.
        ok = true;
      } catch {
        ok = false;
      } finally {
        window.clearTimeout(timer);
      }
      if (cancelled) return;
      setStatus(ok ? "ok" : "unreachable");
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [origin, editUrl]);

  return status;
}

function EditCanvasIframe({
  iframeRef,
  editUrl,
  origin,
  onLoad,
  className,
  minHeightClass,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  editUrl: string;
  origin: string;
  onLoad: () => void;
  className?: string;
  minHeightClass?: string;
}) {
  const reachability = useStorefrontReachability(origin, editUrl);

  return (
    <div className={cn("relative h-full min-h-0", minHeightClass)}>
      {reachability === "unreachable" ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 grid place-items-center bg-[#e8e8e8] p-6 text-center"
        >
          <div className="max-w-md space-y-3">
            <p className="text-sm font-semibold text-neutral-800">Edit canvas kan de storefront niet laden</p>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Geen response op <span className="font-mono text-[11px]">{origin}</span>. Start de storefront
              (standaard poort 5173) of zet <span className="font-mono text-[11px]">VITE_STOREFRONT_ORIGIN</span>{" "}
              op de poort waar de storefront draait — daarna deze pagina herladen.
            </p>
            <a
              href={editUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
            >
              Open storefront-edit URL
            </a>
          </div>
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        src={reachability === "unreachable" ? undefined : editUrl}
        title="edit"
        className={cn("h-full w-full border-0 bg-background", className)}
        onLoad={onLoad}
      />
    </div>
  );
}

function storefrontPageUrl(slug: string, query?: string) {
  const origin = storefrontOrigin();
  const path = slug === "/" ? "/" : slug.startsWith("/") ? slug : `/${slug}`;
  if (!query) return `${origin}${path}`;
  return `${origin}${path}?${query.replace(/^\?/, "")}`;
}

function PageEditorRoute() {
  const { pageId } = Route.useParams();
  const state = useCms();
  const navigate = useNavigate();
  const page = state.pages.find((p) => p.id === pageId);

  React.useEffect(() => {
    if (!page) navigate({ to: "/admin/website", replace: true });
  }, [page, navigate]);

  React.useEffect(() => {
    if (!pageId) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cms.hasDraft(pageId)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pageId]);

  if (!page) return null;

  return page.isCustom ? (
    <CustomPageSplitEditor pageId={page.id} />
  ) : (
    <BuiltinPageSplitEditor pageId={page.id} slug={page.slug} title={page.title} />
  );
}

function BuiltinPageSplitEditor({ pageId, slug, title }: { pageId: string; slug: string; title: string }) {
  const state = useCms();
  const hasDraft = cms.hasDraft(pageId);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [sectionsOpen, setSectionsOpen] = React.useState(false);
  const editRef = React.useRef<HTMLIFrameElement>(null);
  const origin = React.useMemo(() => storefrontOrigin(), []);
  const bridge = useCmsEditParentBridge(pageId, editRef, origin);

  React.useEffect(() => {
    void cms.reconcileLocalCustomPagesWithServer();
  }, []);

  const editUrl = storefrontPageUrl(slug, `_cmsMode=edit&_cmsPage=${encodeURIComponent(pageId)}`);
  const page = cms.getEditablePage(pageId) ?? state.pages.find((p) => p.id === pageId);

  // Re-push the revisioned draft whenever local admin state changes (layout ops,
  // section-content patches from Secties, saved/discard, etc.). Depend only on
  // the store's own object refs (stable unless `write()` ran) — never on the result
  // of `cms.getEditablePage`, which allocates a fresh object on every call and would
  // otherwise re-trigger this effect (and thus `bump`'s `setRevision`) forever.
  React.useEffect(() => {
    bridge.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.bump, pageId, state.draft[pageId], state.saved[pageId]]);

  React.useEffect(() => {
    if (bridge.selection) setSectionsOpen(true);
  }, [bridge.selection]);

  const onSave = () => {
    void (async () => {
      if (page && pageHasLegacyEmbeddedImages(page)) {
        document.getElementById("cms-legacy-images-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        notifyToast({
          kind: "error",
          title: "Publiceren geblokkeerd",
          description:
            "Deze pagina bevat nog ingesloten data-URL-afbeeldingen. Gebruik het amber paneel “Migreer ingesloten afbeeldingen” hierboven, daarna opnieuw Opslaan & publiceren. Nieuwe carousel-/galerij-uploads gaan naar de mediabibliotheek.",
        });
        return;
      }
      const result = await cms.savePage(pageId);
      if (!result.ok) {
        notifyToast({
          kind: "error",
          title: "Opslaan mislukt",
          description: result.reason,
        });
        return;
      }
      if ("warning" in result && result.warning) {
        notifyToast({ kind: "warning", title: result.warning });
      } else {
        notifyToast({ kind: "success", title: "Opgeslagen." });
      }
      setTimeout(() => {
        try {
          editRef.current?.contentWindow?.location.reload();
        } catch {
          /* cross-origin */
        }
      }, 50);
    })();
  };

  const onDiscard = () => {
    void (async () => {
      if (
        !(await appConfirm({
          title: "Wijzigingen verwerpen?",
          description:
            "Alle niet-opgeslagen wijzigingen op deze pagina verdwijnen. De laatst gepubliceerde of opgeslagen versie blijft behouden.",
          confirmLabel: "Verwerpen",
          tone: "destructive",
        }))
      ) {
        return;
      }
      cms.discardDraft(pageId);
      cms.clearPreviewSnapshot(pageId);
      setTimeout(() => {
        try {
          editRef.current?.contentWindow?.location.reload();
        } catch {
          /* cross-origin */
        }
      }, 50);
    })();
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col animate-fade-in">
      <SplitToolbar
        title={title}
        slug={slug}
        hasDraft={hasDraft}
        onSave={onSave}
        onDiscard={onDiscard}
        device={device}
        onDevice={setDevice}
        saveLabel="Opslaan & publiceren"
      />

      {page ? (
        <div className="mt-3">
          <LegacyCmsImagesPanel
            page={page}
            onReplacePage={(next) => {
              const result = cms.updatePage(pageId, next);
              if (!result.ok) {
                notifyToast({
                  kind: "error",
                  title: "Pagina bijwerken mislukt",
                  description: result.reason,
                });
              } else bridge.bump();
            }}
          />
        </div>
      ) : null}

      <div className="flex-1 min-h-0 grid gap-3 mt-3 lg:grid-cols-1">
        <PaneShell label="Edit canvas" tone="edit" hidden={false}>
          <div className="relative h-full min-h-0">
            <DeviceFrame device={device}>
              <EditCanvasIframe
                iframeRef={editRef}
                editUrl={editUrl}
                origin={origin}
                onLoad={() => bridge.bump()}
                className="h-full w-full border-0 bg-background"
              />
            </DeviceFrame>
            <BuiltinLayoutEditor
              pageId={pageId}
              open={sectionsOpen}
              onOpenChange={setSectionsOpen}
              canvasSelection={bridge.selection}
              onSelectLayoutItem={(selection) => {
                bridge.setSelection(selection);
              }}
            />
          </div>
        </PaneShell>
      </div>
    </div>
  );
}

function CustomPageSplitEditor({ pageId }: { pageId: string }) {
  const state = useCms();
  const navigate = useNavigate();
  const published = state.pages.find((p) => p.id === pageId)!;
  const editablePage = useEditablePage(pageId);
  const page = editablePage ?? published;
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const editRef = React.useRef<HTMLIFrameElement>(null);
  const origin = React.useMemo(() => storefrontOrigin(), []);
  const bridge = useCmsEditParentBridge(pageId, editRef, origin);
  const hasDraft = cms.hasDraft(pageId) || page.isDraftOnly;
  const editUrl = storefrontPageUrl(page.slug, `_cmsMode=edit&_cmsPage=${encodeURIComponent(pageId)}`);

  React.useEffect(() => {
    void cms.reconcileLocalCustomPagesWithServer();
  }, []);

  React.useEffect(() => {
    bridge.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.bump, pageId, state.draft[pageId], state.saved[pageId]]);

  const onSave = () => {
    void (async () => {
      if (pageHasLegacyEmbeddedImages(page)) {
        document.getElementById("cms-legacy-images-panel")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        notifyToast({
          kind: "error",
          title: "Publiceren geblokkeerd",
          description:
            "Deze pagina bevat nog ingesloten data-URL-afbeeldingen. Gebruik het amber paneel “Migreer ingesloten afbeeldingen” hierboven, daarna opnieuw Opslaan & publiceren. Nieuwe carousel-/galerij-uploads gaan naar de mediabibliotheek.",
        });
        return;
      }
      const result = await cms.savePage(pageId);
      if (!result.ok) {
        notifyToast({
          kind: "error",
          title: "Opslaan mislukt",
          description: result.reason,
        });
        return;
      }
      if ("warning" in result && result.warning) {
        notifyToast({ kind: "warning", title: result.warning });
      } else {
        notifyToast({ kind: "success", title: "Opgeslagen." });
      }
      setTimeout(() => {
        try {
          editRef.current?.contentWindow?.location.reload();
        } catch {
          /* cross-origin */
        }
      }, 50);
    })();
  };
  const onDiscard = () => {
    void (async () => {
      if (
        !(await appConfirm({
          title: page.isDraftOnly ? "Pagina verwijderen?" : "Wijzigingen verwerpen?",
          description: page.isDraftOnly
            ? "Deze pagina is nog niet gepubliceerd. Verwijderen wist het concept volledig."
            : "Niet-opgeslagen wijzigingen verdwijnen. De laatst gepubliceerde versie blijft behouden.",
          confirmLabel: page.isDraftOnly ? "Verwijderen" : "Verwerpen",
          tone: "destructive",
        }))
      ) {
        return;
      }
      const wasDraftOnly = page.isDraftOnly;
      cms.discardDraft(pageId);
      cms.clearPreviewSnapshot(pageId);
      if (wasDraftOnly) {
        navigate({ to: "/admin/website" });
        return;
      }
      setTimeout(() => {
        try {
          editRef.current?.contentWindow?.location.reload();
        } catch {
          /* cross-origin */
        }
      }, 50);
    })();
  };

  const onMetaSave = (
    patch: Partial<Pick<CmsPage, "title" | "slug" | "description" | "inNav">>,
  ): { ok: true } | { ok: false; reason: string } => {
    const result = cms.updatePage(pageId, patch);
    if (result.ok) bridge.bump();
    return result;
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col animate-fade-in">
      <SplitToolbar
        title={page.title}
        slug={page.slug}
        hasDraft={!!hasDraft}
        onSave={onSave}
        onDiscard={onDiscard}
        device="desktop"
        onDevice={() => {}}
        showDevice={false}
        saveLabel={page.isDraftOnly ? "Pagina publiceren" : "Opslaan & publiceren"}
      />

      <div className="mt-3 space-y-3">
        <LegacyCmsImagesPanel
          page={page}
          onReplacePage={(next) => {
            const result = cms.updatePage(pageId, next);
            if (!result.ok) {
              notifyToast({
                kind: "error",
                title: "Pagina bijwerken mislukt",
                description: result.reason,
              });
            } else bridge.bump();
          }}
        />
      </div>

      <div className="flex-1 min-h-0 grid gap-3 mt-3 lg:grid-cols-1">
        <PaneShell label="Edit canvas" tone="edit" hidden={false}>
          <div className="relative h-full min-h-0">
            <EditCanvasIframe
              iframeRef={editRef}
              editUrl={editUrl}
              origin={origin}
              onLoad={() => bridge.bump()}
              className="h-full min-h-[70vh] w-full border-0 bg-background"
              minHeightClass="min-h-[70vh]"
            />
            <CustomPageDrawer
              page={page}
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              onMetaSave={onMetaSave}
            />
          </div>
        </PaneShell>
      </div>
    </div>
  );
}

/** Slide-over with tabs for custom-page CMS blocks (existing `PageEditor`) + page-meta settings. */
function CustomPageDrawer({
  page,
  open,
  onOpenChange,
  onMetaSave,
}: {
  page: CmsPage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMetaSave: (
    patch: Partial<Pick<CmsPage, "title" | "slug" | "description" | "inNav">>,
  ) => { ok: true } | { ok: false; reason: string };
}) {
  const [tab, setTab] = React.useState<"sections" | "settings">("sections");

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="cms-custom-page-panel"
        aria-label="Pagina"
        data-cms-toolbar="custom-page"
        className={cn(
          "absolute bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition",
          open
            ? "border-primary/40 bg-primary text-primary-foreground"
            : "border-white/15 bg-black/75 text-white hover:border-white/30 hover:bg-black/85",
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        Pagina
      </button>

      <div
        className={cn(
          "absolute inset-0 z-10 bg-black/25 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
      />

      <aside
        id="cms-custom-page-panel"
        role="dialog"
        aria-label="Pagina beheren"
        aria-hidden={!open}
        className={cn(
          "absolute inset-y-0 right-0 z-20 flex w-[min(100%,min(48rem,92vw))] flex-col border-l border-white/10 bg-[#0c0e12]/97 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/80">
              Pagina-editor
            </p>
            <div className="mt-1.5 inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5">
              <button
                type="button"
                onClick={() => setTab("sections")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium",
                  tab === "sections" ? "bg-primary text-primary-foreground" : "text-white/70",
                )}
              >
                <Layers className="h-3.5 w-3.5" /> Secties
              </button>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium",
                  tab === "settings" ? "bg-primary text-primary-foreground" : "text-white/70",
                )}
              >
                <Settings className="h-3.5 w-3.5" /> Instellingen
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Sluiten"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "sections" ? (
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <PageEditor page={page} embedded />
            </div>
          ) : (
            <CustomPageMetaForm page={page} onSave={onMetaSave} />
          )}
        </div>
      </aside>
    </>
  );
}

const metaInputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-primary/50";

function CustomPageMetaForm({
  page,
  onSave,
}: {
  page: CmsPage;
  onSave: (
    patch: Partial<Pick<CmsPage, "title" | "slug" | "description" | "inNav">>,
  ) => { ok: true } | { ok: false; reason: string };
}) {
  const [title, setTitle] = React.useState(page.title);
  const [slug, setSlug] = React.useState(page.slug);
  const [description, setDescription] = React.useState(page.description);
  const [showInNav, setShowInNav] = React.useState(page.inNav);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [navError, setNavError] = React.useState<string | null>(null);
  const inNavCap = cms.canEnableInNav(page.id);
  const inNavDisabled = !showInNav && !inNavCap.ok;

  React.useEffect(() => {
    setTitle(page.title);
    setSlug(page.slug);
    setDescription(page.description);
    setShowInNav(page.inNav);
  }, [page.id, page.updatedAt]);

  const save = () => {
    setNavError(null);
    const result = onSave({
      title,
      slug: slug.startsWith("/") ? slug : `/${slug}`,
      description,
      inNav: showInNav,
    });
    if (!result.ok) {
      setNavError(result.reason);
      if (showInNav && !page.inNav) setShowInNav(false);
      return;
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  return (
    <div className="space-y-4 p-5">
      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium text-white/50">Titel (voor SEO)</span>
        <input className={metaInputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium text-white/50">URL slug</span>
        <input
          className={cn(metaInputClass, "font-mono")}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium text-white/50">Meta beschrijving</span>
        <textarea
          className={cn(metaInputClass, "min-h-[88px]")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={160}
        />
        <span className="text-[10px] text-white/35">{description.length}/160 tekens</span>
      </label>
      <label
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3",
          inNavDisabled && "opacity-60",
        )}
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">Toon in navigatie</div>
          <div className="text-xs text-white/40">
            Verschijnt als menu-item in de hoofdnavigatie. Maximaal {cms.getMaxExtraCustomNavPages()}{" "}
            extra pagina’s naast Home, Diensten, enz.
          </div>
          {inNavDisabled || navError ? (
            <div className="mt-1 text-xs text-amber-300/90">
              {navError ?? (!inNavCap.ok ? inNavCap.reason : null)}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showInNav}
          aria-label="Toon in navigatie"
          disabled={inNavDisabled}
          onClick={() => {
            setShowInNav((v) => !v);
            setNavError(null);
          }}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition",
            showInNav ? "bg-primary" : "bg-white/15",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition",
              showInNav && "translate-x-5",
            )}
          />
        </button>
      </label>
      <button
        type="button"
        onClick={save}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
      >
        <Save className="h-3.5 w-3.5" /> Instellingen bijwerken
      </button>
      {savedFlash ? (
        <p className="text-center text-xs text-emerald-300/90">
          Concept bijgewerkt ✓ — klik op “{page.isDraftOnly ? "Pagina publiceren" : "Opslaan & publiceren"}” hierboven om dit live te zetten.
        </p>
      ) : null}
    </div>
  );
}

function SplitToolbar({
  title,
  slug,
  hasDraft,
  onSave,
  onDiscard,
  device,
  onDevice,
  showDevice = true,
  saveLabel = "Opslaan & publiceren",
}: {
  title: string;
  slug: string;
  hasDraft: boolean;
  onSave: () => void;
  onDiscard: () => void;
  device: "desktop" | "mobile";
  onDevice: (d: "desktop" | "mobile") => void;
  showDevice?: boolean;
  saveLabel?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur-xl">
      <Link
        to="/admin/website"
        onClick={(e) => {
          if (!hasDraft) return;
          e.preventDefault();
          void (async () => {
            if (
              !(await appConfirm({
                title: "Pagina verlaten?",
                description:
                  "Er zijn niet-opgeslagen wijzigingen. Het concept blijft bewaard tot je het opslaat of verwerpt — je kunt later terugkomen.",
                confirmLabel: "Verlaten",
                tone: "warning",
              }))
            ) {
              return;
            }
            void navigate({ to: "/admin/website" });
          })();
        }}
        className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="truncate text-sm font-semibold">{title}</div>
          {hasDraft ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Concept — nog niet live
            </span>
          ) : (
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Live
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-white/40 font-mono">{slug}</div>
      </div>

      {showDevice && (
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5">
          <button onClick={() => onDevice("desktop")} aria-label="Desktop" className={cn("grid h-8 w-8 place-items-center rounded-lg", device === "desktop" ? "bg-white/10 text-white" : "text-white/50")} title="Desktop">
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDevice("mobile")} aria-label="Mobiel" className={cn("grid h-8 w-8 place-items-center rounded-lg", device === "mobile" ? "bg-white/10 text-white" : "text-white/50")} title="Mobiel">
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onDiscard}
        disabled={!hasDraft}
        data-cms-toolbar="discard"
        aria-label="Verwerpen"
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
      >
        <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Wijzigingen verwerpen</span>
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!hasDraft}
        data-cms-toolbar="save"
        aria-label={saveLabel}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40 disabled:pointer-events-none"
      >
        <Save className="h-3.5 w-3.5" /> {saveLabel}
      </button>
    </div>
  );
}

function PaneShell({
  label,
  tone,
  hidden,
  children,
  scroll = false,
}: {
  label: string;
  tone: "edit" | "preview";
  hidden: boolean;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className={cn("min-h-0 rounded-2xl border overflow-hidden flex flex-col", tone === "edit" ? "border-primary/30 bg-primary/[0.03]" : "border-white/10 bg-white/[0.02]", hidden && "hidden lg:flex")}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider">
        <span className={cn("h-1.5 w-1.5 rounded-full", tone === "edit" ? "bg-primary" : "bg-emerald-400")} />
        <span className="text-white/60">{label}</span>
      </div>
      <div className={cn("flex-1 min-h-0", scroll && "overflow-auto")}>{children}</div>
    </div>
  );
}

function DeviceFrame({ device, children }: { device: "desktop" | "mobile"; children: React.ReactNode }) {
  if (device === "mobile") {
    return (
      <div className="flex h-full items-start justify-center p-4 overflow-auto">
        <div className="w-[390px] h-[calc(100%-1rem)] max-h-[820px] rounded-[2rem] border-4 border-white/10 overflow-hidden shadow-2xl">
          {children}
        </div>
      </div>
    );
  }
  // Keep a desktop canvas width so sections render the large layout even when the
  // Secties drawer narrows the pane — horizontal scroll instead of a cramped mobile variant.
  return (
    <div className="h-full w-full overflow-auto">
      <div className="h-full min-w-[1080px] w-full">{children}</div>
    </div>
  );
}
