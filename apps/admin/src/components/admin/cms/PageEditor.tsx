import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Settings } from "lucide-react";
import { InspectTextField } from "@mccoy/cms-editor";
import { cms } from "@/lib/cms/store";
import type { Page } from "@/lib/cms/types";
import { useCmsImagePickerProps } from "@/lib/cms/use-cms-image-picker-props";
import { BlockRenderer } from "./BlockRenderer";
import { TemplatePicker } from "./TemplatePicker";
import { AdminCmsContentAiProvider } from "./AdminCmsContentAiProvider";
import { LocalePublishPanel } from "./LocalePublishPanel";
import { cn } from "@/lib/utils";
import { appConfirm } from "@/lib/app-dialogs";

export function PageEditor({ page, embedded = false }: { page: Page; embedded?: boolean }) {
  const [pickerAt, setPickerAt] = React.useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState(false);
  const imagePickerProps = useCmsImagePickerProps();

  return (
    <AdminCmsContentAiProvider pageId={page.id}>
    <div className="space-y-4 animate-fade-in pb-24">
      {/* Toolbar */}
      {!embedded && (
      <div className="sticky top-0 z-30 -mx-4 lg:-mx-0 px-4 lg:px-0 backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-2">
          <Link to="/admin/website" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{page.title}</div>
            <div className="truncate text-[11px] text-white/40">{page.slug} · {page.blocks.length} secties</div>
          </div>
          <button
            onClick={() => setPreviewMode((v) => !v)}
            className={cn("hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition", previewMode ? "border-[#1e88e5] bg-[#1e88e5]/20 text-white" : "border-white/10 bg-white/5 text-white/70 hover:text-white")}
          >
            {previewMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {previewMode ? "Bewerken" : "Preview"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" /><span className="hidden sm:inline">Instellingen</span>
          </button>
        </div>
      </div>
      )}

      {/* Blocks */}
      <div className={cn("space-y-2", embedded && "space-y-3")}>
        {!previewMode && (
          <AddButton onClick={() => setPickerAt(0)} />
        )}
        {page.blocks.map((block, i) => (
          <React.Fragment key={block.id}>
            <div
              className={cn(
                "group relative rounded-2xl border transition",
                previewMode
                  ? "border-transparent p-6"
                  : embedded
                    ? "border-white/10 bg-white/[0.02] p-5 sm:p-7 min-h-[12rem] hover:border-primary/40"
                    : "border-white/10 bg-white/[0.02] p-6 hover:border-[#1e88e5]/40",
              )}
            >
              {!previewMode && (
                <div className="absolute -top-3 right-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => cms.moveBlock(page.id, block.id, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/80 text-white/70 hover:text-white disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => cms.moveBlock(page.id, block.id, 1)} disabled={i === page.blocks.length - 1} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/80 text-white/70 hover:text-white disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                  <button
                    onClick={() => {
                      void (async () => {
                        if (
                          !(await appConfirm({
                            title: "Sectie verwijderen?",
                            description:
                              "Deze sectie verdwijnt uit het concept. Na Opslaan & publiceren verdwijnt ze ook van de live pagina.",
                            confirmLabel: "Verwijderen",
                            tone: "destructive",
                          }))
                        ) {
                          return;
                        }
                        cms.deleteBlock(page.id, block.id);
                      })();
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/80 text-white/70 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <BlockRenderer
                block={block}
                {...imagePickerProps}
                onChange={(patch) => cms.updateBlock(page.id, block.id, patch)}
              />
            </div>
            {!previewMode && <AddButton onClick={() => setPickerAt(i + 1)} />}
          </React.Fragment>
        ))}
        {page.blocks.length === 0 && !previewMode && (
          <div className="text-center py-16 rounded-2xl border border-dashed border-white/15 bg-white/[0.02]">
            <div className="text-white/50 text-sm">Nog geen secties. Klik hierboven om er één toe te voegen.</div>
          </div>
        )}
      </div>

      <TemplatePicker
        open={pickerAt !== null}
        onClose={() => setPickerAt(null)}
        onPick={(type) => { if (pickerAt !== null) cms.addBlock(page.id, type, pickerAt); }}
      />

      {settingsOpen && <PageSettings page={page} onClose={() => setSettingsOpen(false)} />}

      <LocalePublishPanel page={page} />
    </div>
    </AdminCmsContentAiProvider>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 py-2.5 text-[12px] font-medium text-white/40 transition hover:border-sky-400/45 hover:bg-sky-400/[0.06] hover:text-sky-100"
    >
      <Plus className="h-3.5 w-3.5" /> Sectie toevoegen
    </button>
  );
}

function PageSettings({ page, onClose }: { page: Page; onClose: () => void }) {
  const [title, setTitle] = React.useState(page.title);
  const [description, setDescription] = React.useState(page.description);
  const [slug, setSlug] = React.useState(page.slug);
  const [inNav, setInNav] = React.useState(page.inNav);
  const [navError, setNavError] = React.useState<string | null>(null);
  const inNavCap = cms.canEnableInNav(page.id);
  const inNavDisabled = page.isCustom && !inNav && !inNavCap.ok;

  const save = () => {
    const enTitle = page.enFieldDrafts?.["page:meta:title"]?.trim();
    const enDesc = page.enFieldDrafts?.["page:meta:description"]?.trim();
    const localeContent = {
      ...(page.localeContent ?? {
        nl: {
          navigationLabel: title,
          pageTitle: title,
          seo: { title, description },
        },
      }),
      nl: {
        navigationLabel: title,
        pageTitle: title,
        seo: { title, description },
      },
      en:
        enTitle || enDesc
          ? {
              navigationLabel: enTitle || title,
              pageTitle: enTitle || title,
              seo: {
                title: enTitle || title,
                description: enDesc || description,
              },
            }
          : page.localeContent?.en,
    };
    const result = cms.updatePage(page.id, {
      title,
      description,
      slug: page.isCustom ? (slug.startsWith("/") ? slug : `/${slug}`) : page.slug,
      inNav,
      localeContent,
    });
    if (result && !result.ok) {
      setNavError(result.reason);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0a0a0f] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold">Pagina instellingen</h3>
        <InspectTextField
          label="Titel (voor SEO)"
          value={title}
          onChange={setTitle}
          fieldPath="page:meta:title"
          fieldHint="seo title"
          maxChars={70}
        />
        <InspectTextField
          label="Meta beschrijving"
          value={description}
          onChange={setDescription}
          fieldPath="page:meta:description"
          fieldHint="seo description"
          multiline
          maxChars={160}
        />
        <span className="text-[10px] text-white/40">{description.length}/160 tekens</span>
        {page.isCustom && (
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wider text-white/50">URL slug</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-mono outline-none focus:border-[#1e88e5]" />
          </label>
        )}
        <label
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3",
            inNavDisabled && "opacity-60",
          )}
        >
          <div>
            <div className="text-sm font-medium">Toon in navigatie</div>
            <div className="text-xs text-white/40">
              Maximaal {cms.getMaxExtraCustomNavPages()} extra pagina’s naast het standaardmenu.
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
            aria-checked={inNav}
            aria-label="Toon in navigatie"
            disabled={inNavDisabled}
            onClick={() => {
              setInNav((v) => !v);
              setNavError(null);
            }}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              inNav ? "bg-[#1e88e5]" : "bg-white/15",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition",
                inNav && "translate-x-5",
              )}
            />
          </button>
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">Annuleren</button>
          <button onClick={save} className="rounded-xl bg-[#1e88e5] px-4 py-2 text-sm font-semibold">Opslaan</button>
        </div>
      </div>
    </div>
  );
}