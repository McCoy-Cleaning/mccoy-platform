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
  LoaderCircle,
  X,
  Eye,
  Pencil,
  Undo2,
  Redo2,
} from "lucide-react";
import { type CmsPage, type Locale } from "@mccoy/cms-schema";
import { cms, useCms, useEditablePage } from "@/lib/cms/store";
import { useCmsEditParentBridge } from "@/lib/cms/edit-bridge";
import { buildStorefrontEditCanvasUrl } from "@/lib/cms/edit-canvas-url";
import { PageEditor } from "@/components/admin/cms/PageEditor";
import { BuiltinLayoutEditor, AddSectionFab } from "@/components/admin/cms/BuiltinLayoutEditor";
import { TemplatePicker } from "@/components/admin/cms/TemplatePicker";
import { CanvasMediaPicker } from "@/components/admin/cms/CanvasMediaPicker";
import type { BlockType } from "@/lib/cms/types";
import type { CmsUiCommand } from "@mccoy/cms-schema";
import {
  LegacyCmsImagesPanel,
  pageHasLegacyEmbeddedImages,
} from "@/components/admin/cms/LegacyCmsImagesPanel";
import { cn } from "@/lib/utils";
import { appConfirm } from "@/lib/app-dialogs";
import { notifyToast } from "@/lib/notify-toast";

export const Route = createFileRoute("/_app/website/$pageId")({
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
  const stableAdminOrigin = React.useMemo(() => {
    const fromEnv = (import.meta.env.VITE_ADMIN_ORIGIN as string | undefined)?.replace(/\/$/, "");
    if (fromEnv && !fromEnv.includes("localhost")) return fromEnv;
    return "https://mccoy-platform-admin-git-development-mccoy1.vercel.app";
  }, []);
  const onEphemeralAdminHost = React.useMemo(() => {
    try {
      const host = window.location.hostname.toLowerCase();
      if (!host.endsWith(".vercel.app")) return false;
      if (host.includes("-git-")) return false;
      return /-[a-z0-9]{6,}-[a-z0-9-]+\.vercel\.app$/i.test(host);
    } catch {
      return false;
    }
  }, []);
  const stableAdminHref = `${stableAdminOrigin}${window.location.pathname}${window.location.search}`;

  return (
    <div className={cn("relative h-full min-h-0", minHeightClass)}>
      {onEphemeralAdminHost ? (
        <div
          role="status"
          className="absolute inset-x-0 top-0 z-20 border-b border-amber-500/40 bg-amber-50 px-4 py-2.5 text-center"
        >
          <p className="text-xs font-medium text-amber-950 leading-relaxed">
            Je gebruikt een tijdelijke Vercel-deployment-URL. Productie-www mag alleen de{" "}
            <span className="font-semibold">stable</span> admin embedden — open{" "}
            <a className="underline font-semibold" href={stableAdminHref}>
              {stableAdminOrigin}
            </a>{" "}
            (niet de …-xxxxx-… deploy-link).
          </p>
        </div>
      ) : null}
      {reachability === "unreachable" ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 grid place-items-center bg-[#e8e8e8] p-6 text-center"
        >
          <div className="max-w-md space-y-3">
            <p className="text-sm font-semibold text-neutral-800">
              Edit canvas kan de storefront niet laden
            </p>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Geen response op <span className="font-mono text-[11px]">{origin}</span>. Start de
              storefront (standaard poort 5173) of zet{" "}
              <span className="font-mono text-[11px]">VITE_STOREFRONT_ORIGIN</span> op de poort waar
              de storefront draait — daarna deze pagina herladen.
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
        className={cn("block h-full w-full border-0 bg-background", className)}
        style={{ border: 0, display: "block", width: "100%" }}
        onLoad={onLoad}
      />
    </div>
  );
}

function storefrontEditUrl(slug: string, pageId: string, locale: Locale) {
  return buildStorefrontEditCanvasUrl({
    origin: storefrontOrigin(),
    slug,
    pageId,
    locale,
  });
}

/** NL/EN switch for the website preview iframe (not inspector EN draft fields). */
function PreviewLocaleToggle({
  locale,
  onLocale,
  className,
}: {
  locale: Locale;
  onLocale: (l: Locale) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex rounded-xl border border-white/10 bg-white/5 p-1", className)}
      role="group"
      aria-label="Voorbeeldtaal"
      data-cms-toolbar="preview-locale"
    >
      {(["nl", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onLocale(l)}
          aria-pressed={locale === l}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold uppercase transition",
            locale === l ? "bg-[#1e88e5] text-white shadow" : "text-white/55 hover:text-white",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function PageEditorRoute() {
  const { pageId } = Route.useParams();
  const state = useCms();
  const navigate = useNavigate();
  const page = state.pages.find((p) => p.id === pageId);

  React.useEffect(() => {
    if (!page) navigate({ to: "/website", replace: true });
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

function BuiltinPageSplitEditor({
  pageId,
  slug,
  title,
}: {
  pageId: string;
  slug: string;
  title: string;
}) {
  const state = useCms();
  const hasDraft = cms.hasDraft(pageId);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [previewLocale, setPreviewLocale] = React.useState<Locale>("nl");
  const [sectionsOpen, setSectionsOpen] = React.useState(false);
  const [pickerAt, setPickerAt] = React.useState<number | null>(null);
  const [mediaTarget, setMediaTarget] = React.useState<
    Extract<CmsUiCommand, { kind: "openMediaPicker" }>["target"] | null
  >(null);
  const mediaPickerOpenRef = React.useRef(false);
  mediaPickerOpenRef.current = mediaTarget != null;
  const editRef = React.useRef<HTMLIFrameElement>(null);
  const origin = React.useMemo(() => storefrontOrigin(), []);
  const bridge = useCmsEditParentBridge(pageId, editRef, origin);
  const publishInFlight = React.useRef(false);
  const [publishing, setPublishing] = React.useState(false);

  // Run Producten layout ensure on open. Do NOT depend on draft[pageId]
  // (ensure writes draft; that dependency caused an ensure→commit→effect OOM loop).
  // Call ensure immediately AND after reconcile — Strict Mode can cancel in-flight work.
  React.useEffect(() => {
    if (pageId === "page_products") {
      cms.ensureProductsBlocksMigration(pageId);
    }
    if (pageId === "page_home") {
      cms.ensureHomeHeroBlocksMigration(pageId);
    }
    if (pageId === "page_about") {
      cms.ensureAboutBlocksMigration(pageId);
    }
    if (pageId === "page_offerte") {
      cms.ensureOfferteBlocksMigration(pageId);
    }
    if (pageId === "page_privacy" || pageId === "page_terms") {
      cms.ensureLegalBlocksMigration(pageId);
    }
    const refreshFromServer = () => {
      // File picker / media modal steals focus; reconciling on return used to race
      // uploads and could push a stale draft into the edit iframe.
      if (mediaPickerOpenRef.current) return;
      void cms.reconcileLocalCustomPagesWithServer().then(() => {
        if (mediaPickerOpenRef.current) return;
        if (pageId === "page_products") {
          cms.ensureProductsBlocksMigration(pageId);
        }
        if (pageId === "page_home") {
          cms.ensureHomeHeroBlocksMigration(pageId);
        }
        if (pageId === "page_about") {
          cms.ensureAboutBlocksMigration(pageId);
        }
        if (pageId === "page_offerte") {
          cms.ensureOfferteBlocksMigration(pageId);
        }
        if (pageId === "page_privacy" || pageId === "page_terms") {
          cms.ensureLegalBlocksMigration(pageId);
        }
        bridge.bump();
      });
    };
    refreshFromServer();
    const onFocus = () => refreshFromServer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshFromServer();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pageId, bridge.bump]);

  const editUrl = storefrontEditUrl(slug, pageId, previewLocale);
  const page = cms.getEditablePage(pageId) ?? state.pages.find((p) => p.id === pageId);
  const publishedUpdatedAt = state.pages.find((p) => p.id === pageId)?.updatedAt;

  // Re-push the revisioned draft whenever local admin state changes (layout ops,
  // section-content patches from Secties, saved/discard, etc.). Depend only on
  // the store's own object refs (stable unless `write()` ran) — never on the result
  // of `cms.getEditablePage`, which allocates a fresh object on every call and would
  // otherwise re-trigger this effect (and thus `bump`'s `setRevision`) forever.
  React.useEffect(() => {
    bridge.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.bump, pageId, state.draft[pageId], state.saved[pageId], publishedUpdatedAt]);

  React.useEffect(() => {
    // Advanced settings only: canvas edits stay on the website; do not auto-open the drawer.
    const cmd = bridge.uiCommand;
    if (!cmd) return;
    if (cmd.kind === "openAddPicker") {
      setPickerAt(cmd.atIndex);
      bridge.clearUiCommand();
      return;
    }
    if (cmd.kind === "openAdvanced") {
      bridge.setSelection(cmd.selection);
      setSectionsOpen(true);
      bridge.clearUiCommand();
      return;
    }
    if (cmd.kind === "openMediaPicker") {
      setMediaTarget(cmd.target);
      bridge.clearUiCommand();
    }
  }, [bridge.uiCommand, bridge.clearUiCommand, bridge.setSelection]);

  // Editor history shortcuts (admin chrome). Canvas iframe sends undo/redo when
  // focus is inside the storefront and not in an active text field.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        bridge.undo();
        return;
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        bridge.redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bridge]);

  // Removed: auto-open Secties on every canvas selection (WYSIWYG — edit on canvas).
  // React.useEffect(() => {
  //   if (bridge.selection) setSectionsOpen(true);
  // }, [bridge.selection]);

  const onSave = () => {
    if (publishInFlight.current) return;
    publishInFlight.current = true;
    setPublishing(true);
    void (async () => {
      try {
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
            dedupeKey: `cms-publish-blocked:${pageId}`,
          });
          return;
        }
        const result = await cms.savePage(pageId);
        if (!result.ok) {
          notifyToast({
            kind: "error",
            title: "Opslaan mislukt",
            description: result.reason,
            dedupeKey: `cms-publish-error:${pageId}`,
          });
          return;
        }
        if ("warning" in result && result.warning) {
          notifyToast({
            kind: "warning",
            title: result.warning,
            dedupeKey: `cms-publish-warning:${pageId}`,
          });
        } else {
          notifyToast({
            kind: "success",
            title: ("message" in result && result.message) || "Opgeslagen.",
            dedupeKey: `cms-publish-success:${pageId}`,
          });
        }
        setTimeout(() => {
          try {
            editRef.current?.contentWindow?.location.reload();
          } catch {
            /* cross-origin */
          }
        }, 50);
      } finally {
        publishInFlight.current = false;
        setPublishing(false);
      }
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
      bridge.clearHistory();
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
        pageId={pageId}
        title={title}
        slug={slug}
        hasDraft={hasDraft}
        onSave={onSave}
        saving={publishing}
        onDiscard={onDiscard}
        device={device}
        onDevice={setDevice}
        previewLocale={previewLocale}
        onPreviewLocale={setPreviewLocale}
        saveLabel="Opslaan & publiceren"
        interactionMode={bridge.interactionMode}
        onInteractionMode={bridge.setInteractionMode}
        canUndo={bridge.canUndo}
        canRedo={bridge.canRedo}
        onUndo={() => bridge.undo()}
        onRedo={() => bridge.redo()}
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

      {/* WYSIWYG: full-width website canvas; Secties only as advanced overlay. */}
      <div className="relative mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-primary/30 bg-primary/[0.03]">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-white/10 px-4 py-2.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              bridge.interactionMode === "preview" ? "bg-emerald-400" : "bg-primary",
            )}
          />
          <span className="text-sm font-semibold text-white/70">
            {bridge.interactionMode === "preview"
              ? "Voorbeeld (bewerken uit)"
              : "Website bewerken"}
          </span>
          <PreviewLocaleToggle
            locale={previewLocale}
            onLocale={setPreviewLocale}
            className="ml-auto"
          />
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <DeviceFrame device={device}>
            <EditCanvasIframe
              iframeRef={editRef}
              editUrl={editUrl}
              origin={origin}
              onLoad={() => bridge.bump()}
              className="h-full w-full border-0 bg-background"
            />
          </DeviceFrame>
          {bridge.interactionMode === "edit" && !sectionsOpen ? (
            <AddSectionFab
              onClick={() => setPickerAt(page?.layout.length ?? 0)}
            />
          ) : null}

          {sectionsOpen ? (
            <div className="absolute inset-0 z-30 flex justify-end bg-black/35 xl:bg-transparent xl:pointer-events-none">
              <div className="pointer-events-auto h-full w-full max-w-[min(560px,100%)] border-l border-white/10 bg-[#0c0e12]/97 shadow-2xl backdrop-blur-xl xl:max-w-[clamp(420px,32vw,520px)]">
                <BuiltinLayoutEditor
                  pageId={pageId}
                  open={sectionsOpen}
                  onOpenChange={setSectionsOpen}
                  showOpenButton={false}
                  docked
                  canvasSelection={bridge.selection}
                  onSelectLayoutItem={(selection) => {
                    bridge.setSelection(selection);
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <TemplatePicker
        open={pickerAt !== null}
        onClose={() => setPickerAt(null)}
        page={page}
        onPick={(type: BlockType, templateId: string) => {
          if (pickerAt === null) return;
          const result = bridge.applyMutation({
            kind: "layout",
            op: "add",
            blockType: type,
            atIndex: pickerAt,
            templateId,
          });
          setPickerAt(null);
          if (result.ok) {
            bridge.bump();
            notifyToast({
              kind: "success",
              title: "Sectie toegevoegd",
              dedupeKey: `cms-add-section:${pageId}`,
            });
          } else {
            notifyToast({
              kind: "error",
              title: "Sectie toevoegen mislukt",
              description: result.reason,
            });
          }
        }}
      />

      <CanvasMediaPicker
        pageId={pageId}
        target={mediaTarget}
        onClose={() => setMediaTarget(null)}
        onApplied={() => bridge.bump()}
        applyMutation={bridge.applyMutation}
      />
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
  const [previewLocale, setPreviewLocale] = React.useState<Locale>("nl");
  const editRef = React.useRef<HTMLIFrameElement>(null);
  const origin = React.useMemo(() => storefrontOrigin(), []);
  const bridge = useCmsEditParentBridge(pageId, editRef, origin);
  const publishInFlight = React.useRef(false);
  const [publishing, setPublishing] = React.useState(false);
  const hasDraft = cms.hasDraft(pageId) || page.isDraftOnly;
  const editUrl = storefrontEditUrl(page.slug, pageId, previewLocale);

  React.useEffect(() => {
    const refreshFromServer = () => {
      void cms.reconcileLocalCustomPagesWithServer().then(() => bridge.bump());
    };
    refreshFromServer();
    const onFocus = () => refreshFromServer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshFromServer();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bridge.bump]);

  const publishedUpdatedAt = state.pages.find((p) => p.id === pageId)?.updatedAt;

  React.useEffect(() => {
    bridge.bump();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge.bump, pageId, state.draft[pageId], state.saved[pageId], publishedUpdatedAt]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        bridge.undo();
        return;
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        bridge.redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bridge]);

  const onSave = () => {
    if (publishInFlight.current) return;
    publishInFlight.current = true;
    setPublishing(true);
    void (async () => {
      try {
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
            dedupeKey: `cms-publish-blocked:${pageId}`,
          });
          return;
        }
        const result = await cms.savePage(pageId);
        if (!result.ok) {
          notifyToast({
            kind: "error",
            title: "Opslaan mislukt",
            description: result.reason,
            dedupeKey: `cms-publish-error:${pageId}`,
          });
          return;
        }
        if ("warning" in result && result.warning) {
          notifyToast({
            kind: "warning",
            title: result.warning,
            dedupeKey: `cms-publish-warning:${pageId}`,
          });
        } else {
          notifyToast({
            kind: "success",
            title: ("message" in result && result.message) || "Opgeslagen.",
            dedupeKey: `cms-publish-success:${pageId}`,
          });
        }
        setTimeout(() => {
          try {
            editRef.current?.contentWindow?.location.reload();
          } catch {
            /* cross-origin */
          }
        }, 50);
      } finally {
        publishInFlight.current = false;
        setPublishing(false);
      }
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
      bridge.clearHistory();
      if (wasDraftOnly) {
        navigate({ to: "/website" });
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
        pageId={pageId}
        title={page.title}
        slug={page.slug}
        hasDraft={!!hasDraft}
        onSave={onSave}
        saving={publishing}
        onDiscard={onDiscard}
        device="desktop"
        onDevice={() => {}}
        showDevice={false}
        previewLocale={previewLocale}
        onPreviewLocale={setPreviewLocale}
        saveLabel={page.isDraftOnly ? "Pagina publiceren" : "Opslaan & publiceren"}
        interactionMode={bridge.interactionMode}
        onInteractionMode={bridge.setInteractionMode}
        canUndo={bridge.canUndo}
        canRedo={bridge.canRedo}
        onUndo={() => bridge.undo()}
        onRedo={() => bridge.redo()}
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
        <PaneShell
          label="Voorbeeld van uw website"
          tone="edit"
          hidden={false}
          headerEnd={<PreviewLocaleToggle locale={previewLocale} onLocale={setPreviewLocale} />}
        >
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
          "absolute bottom-5 right-5 z-20 inline-flex items-center gap-2.5 rounded-full border px-5 py-3 text-[15px] font-semibold shadow-xl backdrop-blur-md transition",
          open
            ? "border-primary/40 bg-primary text-primary-foreground"
            : "border-white/15 bg-black/75 text-white hover:border-white/30 hover:bg-black/85",
        )}
      >
        <Layers className="h-5 w-5" />
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
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">
              Pagina-editor
            </p>
            <div className="mt-2 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setTab("sections")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                  tab === "sections"
                    ? "bg-primary text-primary-foreground"
                    : "text-white/70 hover:text-white",
                )}
              >
                <Layers className="h-4 w-4" /> Secties
              </button>
              <button
                type="button"
                onClick={() => setTab("settings")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                  tab === "settings"
                    ? "bg-primary text-primary-foreground"
                    : "text-white/70 hover:text-white",
                )}
              >
                <Settings className="h-4 w-4" /> Instellingen
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Sluiten"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
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
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white outline-none transition placeholder:text-white/35 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30";

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
    <div className="space-y-5 p-5">
      <label className="block">
        <span className="a-label">Titel (voor Google)</span>
        <input
          className={metaInputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="a-label">Webadres (URL)</span>
        <input
          className={cn(metaInputClass, "font-mono")}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="a-label">Korte beschrijving (voor Google)</span>
        <textarea
          className={cn(metaInputClass, "min-h-[96px]")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={160}
        />
        <span className="mt-1 block text-xs text-white/40">{description.length}/160 tekens</span>
      </label>
      <label
        className={cn(
          "flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4",
          inNavDisabled && "opacity-60",
        )}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-white">Tonen in het menu</div>
          <div className="mt-1 text-sm leading-relaxed text-white/50">
            Deze pagina verschijnt als knop bovenaan de website. Maximaal{" "}
            {cms.getMaxExtraCustomNavPages()} extra pagina’s naast Home, Diensten, enz.
          </div>
          {inNavDisabled || navError ? (
            <div className="mt-2 text-sm text-amber-300/90">
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
            "relative h-8 w-14 shrink-0 rounded-full transition",
            showInNav ? "bg-primary" : "bg-white/15",
          )}
        >
          <span
            className={cn(
              "absolute top-1 left-1 h-6 w-6 rounded-full bg-white transition",
              showInNav && "translate-x-6",
            )}
          />
        </button>
      </label>
      <button type="button" onClick={save} className="a-btn a-btn-primary w-full">
        <Save className="h-4 w-4" /> Instellingen bijwerken
      </button>
      {savedFlash ? (
        <p className="text-center text-sm text-emerald-300/90">
          Concept bijgewerkt ✓ — klik op “
          {page.isDraftOnly ? "Pagina publiceren" : "Opslaan & publiceren"}” hierboven om dit live
          te zetten.
        </p>
      ) : null}
    </div>
  );
}

function SplitToolbar({
  pageId,
  title,
  slug,
  hasDraft,
  onSave,
  saving,
  onDiscard,
  device,
  onDevice,
  showDevice = true,
  previewLocale,
  onPreviewLocale,
  saveLabel = "Opslaan & publiceren",
  interactionMode = "edit",
  onInteractionMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: {
  pageId: string;
  title: string;
  slug: string;
  hasDraft: boolean;
  onSave: () => void;
  saving: boolean;
  onDiscard: () => void;
  device: "desktop" | "mobile";
  onDevice: (d: "desktop" | "mobile") => void;
  showDevice?: boolean;
  previewLocale: Locale;
  onPreviewLocale: (l: Locale) => void;
  saveLabel?: string;
  interactionMode?: "edit" | "preview";
  onInteractionMode?: (mode: "edit" | "preview") => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}) {
  const navigate = useNavigate();
  const [translationState, setTranslationState] = React.useState(() =>
    cms.getAutomaticEnTranslationStatus(pageId),
  );

  React.useEffect(() => {
    setTranslationState(cms.getAutomaticEnTranslationStatus(pageId));
    return cms.subscribeAutomaticEnTranslationStatus(pageId, setTranslationState);
  }, [pageId]);

  const savingLabel =
    translationState?.state === "translating" ? "Ontbrekende EN-velden vertalen…" : "Publiceren…";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/60 p-3 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/website"
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
              void navigate({ to: "/website" });
            })();
          }}
          aria-label="Terug naar alle pagina's"
          title="Terug naar alle pagina's"
          className="a-icon-btn"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="truncate text-lg font-bold tracking-tight">
              <span className="text-white/45 font-medium">Bewerken:</span> {title}
            </div>
            {hasDraft ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Concept — nog niet live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Gepubliceerd
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-sm text-white/40 font-mono">{slug}</div>
        </div>

        <PreviewLocaleToggle locale={previewLocale} onLocale={onPreviewLocale} />

        {showDevice && (
          <div
            className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
            role="group"
            aria-label="Voorbeeldweergave"
          >
            <button
              onClick={() => onDevice("desktop")}
              aria-label="Desktop"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-lg transition",
                device === "desktop"
                  ? "bg-[#1e88e5] text-white shadow"
                  : "text-white/55 hover:text-white",
              )}
              title="Bekijk als computer"
            >
              <Monitor className="h-5 w-5" />
            </button>
            <button
              onClick={() => onDevice("mobile")}
              aria-label="Mobiel"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-lg transition",
                device === "mobile"
                  ? "bg-[#1e88e5] text-white shadow"
                  : "text-white/55 hover:text-white",
              )}
              title="Bekijk als telefoon"
            >
              <Smartphone className="h-5 w-5" />
            </button>
          </div>
        )}

        {onInteractionMode ? (
          <div
            className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
            role="group"
            aria-label="Bewerkingsmodus"
          >
            <button
              type="button"
              onClick={() => onInteractionMode("edit")}
              aria-pressed={interactionMode === "edit"}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition",
                interactionMode === "edit"
                  ? "bg-[#1e88e5] text-white shadow"
                  : "text-white/55 hover:text-white",
              )}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Bewerken
            </button>
            <button
              type="button"
              onClick={() => onInteractionMode("preview")}
              aria-pressed={interactionMode === "preview"}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition",
                interactionMode === "preview"
                  ? "bg-[#1e88e5] text-white shadow"
                  : "text-white/55 hover:text-white",
              )}
            >
              <Eye className="h-4 w-4" aria-hidden />
              Voorbeeld
            </button>
          </div>
        ) : null}

        <div
          className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1"
          role="group"
          aria-label="Geschiedenis"
        >
          <button
            type="button"
            onClick={() => onUndo?.()}
            disabled={!canUndo || saving || !onUndo}
            data-cms-toolbar="undo"
            aria-label="Ongedaan maken"
            title="Ongedaan maken (Ctrl+Z)"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onRedo?.()}
            disabled={!canRedo || saving || !onRedo}
            data-cms-toolbar="redo"
            aria-label="Opnieuw uitvoeren"
            title="Opnieuw uitvoeren (Ctrl+Y)"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-35"
          >
            <Redo2 className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <button
          type="button"
          onClick={onDiscard}
          disabled={!hasDraft || saving}
          data-cms-toolbar="discard"
          aria-label="Verwerpen"
          title="Niet-opgeslagen wijzigingen ongedaan maken"
          className="a-btn a-btn-secondary"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden md:inline">Verwerpen</span>
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!hasDraft || saving}
          aria-busy={saving}
          data-cms-toolbar="save"
          aria-label={saveLabel}
          className="a-btn a-btn-primary"
        >
          {saving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}{" "}
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
      <p className="mt-2.5 border-t border-white/5 px-1 pt-2.5 text-[13px] leading-snug text-white/45">
        U bewerkt de echte website. Wijzigingen blijven concept tot u op{" "}
        <span className="font-semibold text-white/70">“{saveLabel}”</span> klikt.
      </p>
    </div>
  );
}

function PaneShell({
  label,
  tone,
  hidden,
  children,
  scroll = false,
  className,
  headerEnd,
}: {
  label: string;
  tone: "edit" | "preview";
  hidden: boolean;
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  headerEnd?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 rounded-3xl border overflow-hidden flex flex-col",
        tone === "edit" ? "border-primary/30 bg-primary/[0.03]" : "border-white/10 bg-white/[0.02]",
        hidden && "hidden lg:flex",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-2.5">
        <span
          className={cn("h-2 w-2 rounded-full", tone === "edit" ? "bg-primary" : "bg-emerald-400")}
        />
        <span className="text-sm font-semibold text-white/70">{label}</span>
        {headerEnd ? <div className="ml-auto">{headerEnd}</div> : null}
      </div>
      <div className={cn("flex-1 min-h-0", scroll && "overflow-auto")}>{children}</div>
    </div>
  );
}

/** Desktop storefront layout width (CSS px). Visual scale fills the admin pane. */
const DESKTOP_CANVAS_WIDTH = 1280;

/**
 * Desktop: paint at a real desktop width (1280), then scale to fill the pane —
 * both down (narrow) and up (wide) so no empty right gutter remains next to the
 * canvas. Iframe layout stays 1280 CSS px (E10 parity). Mobile: phone chrome.
 */
function DeviceFrame({
  device,
  children,
}: {
  device: "desktop" | "mobile";
  children: React.ReactNode;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [hostHeight, setHostHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    if (device !== "desktop") return;
    const el = hostRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setHostHeight(h);
      // Fill host width completely — never leave an unused side strip.
      setScale(w > 0 ? w / DESKTOP_CANVAS_WIDTH : 1);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  if (device === "mobile") {
    // Content box is exactly 390 CSS px. Decorative chrome uses ring (not border)
    // so border-box does not shrink the iframe below the storefront mobile viewport.
    return (
      <div className="flex h-full items-start justify-center overflow-auto p-4">
        <div
          data-cms-device-frame="mobile"
          className="relative h-[calc(100%-1rem)] max-h-[820px] w-[390px] overflow-hidden rounded-[2rem] shadow-2xl"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 rounded-[2rem] ring-4 ring-inset ring-white/10"
          />
          <div className="h-full w-full overflow-hidden rounded-[2rem]">{children}</div>
        </div>
      </div>
    );
  }

  const needsScale = Math.abs(scale - 1) > 0.001;
  const innerHeight = scale > 0 && hostHeight > 0 ? hostHeight / scale : "100%";

  // Always paint at DESKTOP_CANVAS_WIDTH so Preview matches a real desktop
  // storefront (1280 CSS). Scale to fill the admin host (no empty right gutter).
  return (
    <div ref={hostRef} className="h-full w-full min-w-0 overflow-hidden bg-background">
      <div
        className="origin-top-left will-change-transform motion-reduce:transition-none"
        style={{
          width: DESKTOP_CANVAS_WIDTH,
          height: innerHeight,
          transform: needsScale ? `scale(${scale})` : undefined,
          transition: "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
