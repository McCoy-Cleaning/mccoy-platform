import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { ArrowLeft, Save, RotateCcw, Monitor, Smartphone, Pencil, Eye, ExternalLink, Settings } from "lucide-react";
import { cms, useCms } from "@/lib/cms/store";
import { PageEditor } from "@/components/admin/cms/PageEditor";
import { BlocksView } from "@/components/admin/cms/BlockView";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/website/$pageId")({
  component: PageEditorRoute,
});

function PageEditorRoute() {
  const { pageId } = Route.useParams();
  const state = useCms();
  const navigate = useNavigate();
  const page = state.pages.find((p) => p.id === pageId);

  React.useEffect(() => {
    if (!page) navigate({ to: "/admin/website", replace: true });
  }, [page, navigate]);

  if (!page) return null;

  return page.isCustom ? (
    <CustomPageSplitEditor pageId={page.id} />
  ) : (
    <BuiltinPageSplitEditor pageId={page.id} slug={page.slug} title={page.title} />
  );
}

/* ================================================================= */
/*                    Built-in page: iframe split                    */
/* ================================================================= */

function BuiltinPageSplitEditor({ pageId, slug, title }: { pageId: string; slug: string; title: string }) {
  const state = useCms();
  const hasDraft = !!state.draft[pageId] && Object.keys(state.draft[pageId] || {}).length > 0;
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [mobileTab, setMobileTab] = React.useState<"edit" | "preview">("edit");
  const editRef = React.useRef<HTMLIFrameElement>(null);
  const previewRef = React.useRef<HTMLIFrameElement>(null);

  const editUrl = `${slug}?_cmsMode=edit&_cmsPage=${pageId}`;
  const previewUrl = `${slug}?_cmsMode=preview&_cmsPage=${pageId}`;

  // Reload preview whenever the draft changes (debounced so typing feels fast).
  const draftKey = JSON.stringify(state.draft[pageId] || {});
  React.useEffect(() => {
    const iframe = previewRef.current;
    if (!iframe) return;
    const t = setTimeout(() => {
      try {
        iframe.contentWindow?.location.reload();
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [draftKey]);

  const onSave = () => {
    cms.savePage(pageId);
    // Reload edit iframe to reflect fresh saved state.
    setTimeout(() => editRef.current?.contentWindow?.location.reload(), 50);
  };

  const onDiscard = () => {
    if (!confirm("Alle niet-opgeslagen wijzigingen verwijderen?")) return;
    cms.discardDraft(pageId);
    setTimeout(() => editRef.current?.contentWindow?.location.reload(), 50);
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
        mobileTab={mobileTab}
        onMobileTab={setMobileTab}
      />

      <div className="flex-1 min-h-0 grid gap-3 mt-3 lg:grid-cols-2">
        {/* EDIT PANE */}
        <PaneShell label="Bewerken" tone="edit" hidden={mobileTab !== "edit"}>
          <DeviceFrame device={device}>
            <iframe
              ref={editRef}
              src={editUrl}
              title="edit"
              className="h-full w-full border-0 bg-background"
            />
          </DeviceFrame>
        </PaneShell>

        {/* PREVIEW PANE */}
        <PaneShell label="Preview" tone="preview" hidden={mobileTab !== "preview"}>
          <DeviceFrame device={device}>
            <iframe
              ref={previewRef}
              src={previewUrl}
              title="preview"
              className="h-full w-full border-0 bg-background pointer-events-none"
            />
          </DeviceFrame>
        </PaneShell>
      </div>
    </div>
  );
}

/* ================================================================= */
/*                    Custom page: block split                       */
/* ================================================================= */

function CustomPageSplitEditor({ pageId }: { pageId: string }) {
  const state = useCms();
  const page = state.pages.find((p) => p.id === pageId)!;
  const [mobileTab, setMobileTab] = React.useState<"edit" | "preview">("edit");

  const onSave = () => {
    cms.savePage(pageId);
  };
  const onDiscard = () => {
    if (!confirm(page.isDraftOnly ? "Deze pagina verwijderen? (Nog niet opgeslagen)" : "Wijzigingen verwerpen?")) return;
    cms.discardDraft(pageId);
    if (page.isDraftOnly) {
      window.location.href = "/admin/website";
    }
  };

  const hasDraft = page.isDraftOnly || false;

  return (
    <div className="flex flex-col animate-fade-in min-h-[calc(100vh-6rem)]">
      <SplitToolbar
        title={page.title}
        slug={page.slug}
        hasDraft={hasDraft}
        onSave={onSave}
        onDiscard={onDiscard}
        device="desktop"
        onDevice={() => {}}
        mobileTab={mobileTab}
        onMobileTab={setMobileTab}
        showDevice={false}
        saveLabel={page.isDraftOnly ? "Pagina publiceren" : "Opslaan"}
      />

      <div className="flex-1 min-h-0 grid gap-3 mt-3 lg:grid-cols-2">
        <PaneShell label="Bewerken" tone="edit" hidden={mobileTab !== "edit"} scroll>
          <PageEditor page={page} embedded />
        </PaneShell>

        <PaneShell label="Preview" tone="preview" hidden={mobileTab !== "preview"} scroll>
          <div className="min-h-full bg-background text-foreground rounded-xl overflow-hidden">
            <div className="py-8">
              <BlocksView blocks={page.blocks} />
              {page.blocks.length === 0 && (
                <div className="text-center py-20 text-white/40 text-sm">Nog geen inhoud. Voeg secties toe in het editorvenster.</div>
              )}
            </div>
          </div>
        </PaneShell>
      </div>
    </div>
  );
}

/* ================================================================= */
/*                          Shared UI                                */
/* ================================================================= */

function SplitToolbar({
  title,
  slug,
  hasDraft,
  onSave,
  onDiscard,
  device,
  onDevice,
  mobileTab,
  onMobileTab,
  showDevice = true,
  saveLabel = "Opslaan",
}: {
  title: string;
  slug: string;
  hasDraft: boolean;
  onSave: () => void;
  onDiscard: () => void;
  device: "desktop" | "mobile";
  onDevice: (d: "desktop" | "mobile") => void;
  mobileTab: "edit" | "preview";
  onMobileTab: (t: "edit" | "preview") => void;
  showDevice?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2 backdrop-blur-xl">
      <Link to="/admin/website" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold">{title}</div>
          {hasDraft && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Niet-opgeslagen wijzigingen
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-white/40 font-mono">{slug}</div>
      </div>

      {/* Mobile tab toggle */}
      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5 lg:hidden">
        <button
          onClick={() => onMobileTab("edit")}
          className={cn("inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg", mobileTab === "edit" ? "bg-primary text-primary-foreground" : "text-white/70")}
        >
          <Pencil className="h-3 w-3" /> Bewerk
        </button>
        <button
          onClick={() => onMobileTab("preview")}
          className={cn("inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg", mobileTab === "preview" ? "bg-primary text-primary-foreground" : "text-white/70")}
        >
          <Eye className="h-3 w-3" /> Preview
        </button>
      </div>

      {showDevice && (
        <div className="hidden lg:inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5">
          <button onClick={() => onDevice("desktop")} className={cn("grid h-8 w-8 place-items-center rounded-lg", device === "desktop" ? "bg-white/10 text-white" : "text-white/50")} title="Desktop">
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDevice("mobile")} className={cn("grid h-8 w-8 place-items-center rounded-lg", device === "mobile" ? "bg-white/10 text-white" : "text-white/50")} title="Mobiel">
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <a href={slug} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:text-white">
        <ExternalLink className="h-3.5 w-3.5" /> Live
      </a>

      <button
        onClick={onDiscard}
        disabled={!hasDraft}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
      >
        <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Verwerpen</span>
      </button>
      <button
        onClick={onSave}
        disabled={!hasDraft}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
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
  return <div className="h-full w-full">{children}</div>;
}