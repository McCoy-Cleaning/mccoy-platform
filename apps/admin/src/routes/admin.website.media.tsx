import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { ImageIcon, Trash2, Archive, RotateCcw, Upload, Search, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import {
  listCmsMediaLibrary,
  uploadCmsMediaFromFile,
  adminArchiveCmsMedia,
  adminRestoreCmsMedia,
  adminDeleteCmsMedia,
  adminFindCmsMediaReferences,
  adminUpdateCmsMediaMeta,
  type CmsMediaAssetDto,
} from "@/lib/cms/media-client";
import { appConfirm, appPrompt } from "@/lib/app-dialogs";

export const Route = createFileRoute("/admin/website/media")({
  component: MediaLibraryPage,
});

function MediaLibraryPage() {
  const [items, setItems] = React.useState<CmsMediaAssetDto[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<"active" | "archived">("active");
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [refsById, setRefsById] = React.useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await listCmsMediaLibrary({ q: q.trim() || undefined, status: statusFilter });
      if (!result.ok) {
        setError(result.error);
        setItems([]);
        return;
      }
      setItems(result.items as CmsMediaAssetDto[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setBusy(false);
    }
  }, [q, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, q]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = items.length > 0 && items.every((asset) => selectedIds.has(asset.id));

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (items.length === 0) return prev;
      if (items.every((asset) => prev.has(asset.id))) {
        const next = new Set(prev);
        for (const asset of items) next.delete(asset.id);
        return next;
      }
      const next = new Set(prev);
      for (const asset of items) next.add(asset.id);
      return next;
    });
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    let okCount = 0;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const profile = file.type === "image/gif" ? "gif" : file.type === "image/png" ? "logo" : "photo";
      const result = await uploadCmsMediaFromFile({
        file,
        profile: profile === "gif" ? "gif" : profile === "logo" ? "logo" : "photo",
        tags: ["library"],
        altDefault: file.name.replace(/\.[^.]+$/, ""),
      });
      if (result.ok) okCount += 1;
      else errors.push(`${file.name}: ${result.error}`);
    }
    setStatus(
      okCount > 0
        ? `${okCount} afbeelding${okCount === 1 ? "" : "en"} geüpload${errors.length ? ` · ${errors.length} mislukt` : ""}.`
        : null,
    );
    if (errors.length) setError(errors.slice(0, 3).join(" · "));
    if (fileRef.current) fileRef.current.value = "";
    await load();
    setBusy(false);
  };

  const onArchive = async (asset: CmsMediaAssetDto) => {
    const reason = await appPrompt({
      title: "Afbeelding archiveren?",
      description:
        "Archiveren verbergt de afbeelding in de bibliotheek. De publieke URL blijft bereikbaar voor bestaande pagina’s.",
      label: "Reden (optioneel)",
      placeholder: "Bijv. vervangen door nieuwere versie",
      confirmLabel: "Archiveren",
      required: false,
    });
    if (reason === null) return;
    setBusy(true);
    const result = await adminArchiveCmsMedia({ data: { assetId: asset.id, reason: reason || undefined } });
    if (!result.ok) setError(result.error);
    else setStatus("Gearchiveerd (URL blijft publiek bereikbaar).");
    await load();
    setBusy(false);
  };

  const onRestore = async (asset: CmsMediaAssetDto) => {
    setBusy(true);
    const result = await adminRestoreCmsMedia({ data: { assetId: asset.id } });
    if (!result.ok) setError(result.error);
    await load();
    setBusy(false);
  };

  const deleteAssets = async (assets: CmsMediaAssetDto[]) => {
    if (assets.length === 0) return;

    const blocked: { asset: CmsMediaAssetDto; refCount: number }[] = [];
    const deletable: CmsMediaAssetDto[] = [];
    for (const asset of assets) {
      const refs = await adminFindCmsMediaReferences({ data: { assetId: asset.id } });
      const refCount = refs.ok ? refs.references.length : 0;
      setRefsById((prev) => ({ ...prev, [asset.id]: refCount }));
      if (refCount > 0) blocked.push({ asset, refCount });
      else deletable.push(asset);
    }

    if (blocked.length > 0 && deletable.length === 0) {
      setError(
        blocked.length === 1
          ? `Kan niet verwijderen: nog ${blocked[0]!.refCount} referentie(s) in concept/gepubliceerde pagina’s. Vervang die eerst.`
          : `Kan niet verwijderen: ${blocked.length} geselecteerde afbeeldingen hebben nog referenties. Vervang die eerst.`,
      );
      return;
    }

    const label =
      deletable.length === 1
        ? `“${deletable[0]!.originalFilename || deletable[0]!.id.slice(0, 8)}”`
        : `${deletable.length} afbeeldingen`;
    const confirmed = await appConfirm({
      title:
        deletable.length === 1
          ? "Afbeelding definitief verwijderen?"
          : `${deletable.length} afbeeldingen definitief verwijderen?`,
      description: [
        `Je staat op het punt ${label} permanent uit Storage en de catalogus te verwijderen.`,
        "Dit kan niet ongedaan worden gemaakt. Gebruik dit alleen als er geen referenties meer zijn.",
        blocked.length > 0
          ? `${blocked.length} geselecteerde afbeelding(en) met referenties worden overgeslagen.`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      confirmLabel: deletable.length === 1 ? "Verwijderen" : `${deletable.length} verwijderen`,
      tone: "destructive",
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setStatus(null);
    let okCount = 0;
    const failedIds = new Set<string>();
    const errors: string[] = [];
    for (const asset of deletable) {
      const result = await adminDeleteCmsMedia({ data: { assetId: asset.id } });
      if (!result.ok) {
        failedIds.add(asset.id);
        errors.push(`${asset.originalFilename || asset.id.slice(0, 8)}: ${result.error}`);
        if ("references" in result && result.references) {
          setRefsById((prev) => ({ ...prev, [asset.id]: result.references!.length }));
        }
      } else {
        okCount += 1;
      }
    }
    if (okCount > 0) {
      setStatus(
        okCount === 1
          ? "Asset verwijderd uit Storage en catalogus."
          : `${okCount} assets verwijderd uit Storage en catalogus.`,
      );
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const asset of deletable) {
        if (!failedIds.has(asset.id)) next.delete(asset.id);
      }
      return next;
    });
    if (errors.length) setError(errors.slice(0, 3).join(" · "));
    await load();
    setBusy(false);
  };

  const onDelete = async (asset: CmsMediaAssetDto) => {
    await deleteAssets([asset]);
  };

  const onBulkDelete = async () => {
    const selected = items.filter((asset) => selectedIds.has(asset.id));
    await deleteAssets(selected);
  };

  const onSaveAlt = async (asset: CmsMediaAssetDto, altDefault: string) => {
    const result = await adminUpdateCmsMediaMeta({
      data: { assetId: asset.id, altDefault },
    });
    if (!result.ok) setError(result.error);
    else await load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={ImageIcon}
        accent="#1e88e5"
        title="Mediabibliotheek"
        subtitle="Afbeeldingen in Supabase Storage — herbruikbaar in alle website-secties."
        actions={[]}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
        <Link to="/admin/website" className="hover:text-white">
          Website
        </Link>
        <span>/</span>
        <span className="text-white/80">Media</span>
      </div>

      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs text-amber-100/90">
        <div className="flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p>
            <strong>Archiveren</strong> verbergt selectie in de bibliotheek; bestaande pagina’s blijven werken en de
            publieke URL blijft bereikbaar. Gebruik <strong>definitief verwijderen</strong> alleen bij gevoelige of
            onjuiste content (na het opruimen van referenties).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-[#1e88e5]/50 focus:outline-none"
            placeholder="Zoek op bestandsnaam of alt…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border border-white/10 bg-[#161920] px-3 py-2 text-sm text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "active" | "archived")}
          >
            <option value="active">Actief</option>
            <option value="archived">Gearchiveerd</option>
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#1e88e5]/40 bg-[#1e88e5]/15 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-[#1e88e5]/25 disabled:opacity-50"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Uploaden
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/20 bg-black/40"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
            />
            Alles selecteren
          </label>
          {selectedIds.size > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-400/15 disabled:opacity-50"
              disabled={busy}
              onClick={() => void onBulkDelete()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Verwijder geselecteerd ({selectedIds.size})
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100" role="status">
          {status}
        </p>
      ) : null}

      {busy && items.length === 0 ? (
        <p className="text-sm text-white/45">Laden…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-white/45">
          Nog geen afbeeldingen. Upload JPEG, PNG, WebP of GIF (geen SVG).
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((asset) => (
            <li
              key={asset.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              <div className="relative aspect-[4/3] bg-black/40">
                <label className="absolute left-2 top-2 z-10 inline-flex items-center rounded-md bg-black/55 p-1.5">
                  <span className="sr-only">Selecteer {asset.originalFilename || asset.id.slice(0, 8)}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                    checked={selectedIds.has(asset.id)}
                    onChange={() => toggleSelected(asset.id)}
                  />
                </label>
                <img
                  src={asset.publicUrl}
                  alt={asset.altDefault || asset.originalFilename || ""}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  width={asset.width}
                  height={asset.height}
                />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-xs font-medium text-white/85">
                  {asset.originalFilename || asset.id.slice(0, 8)}
                </p>
                <p className="text-[10px] text-white/40">
                  {asset.width}×{asset.height} · {Math.round(asset.byteSize / 1024)} KB · {asset.profile}
                  {refsById[asset.id] != null ? ` · ${refsById[asset.id]} refs` : ""}
                </p>
                <label className="block text-[10px] text-white/45">
                  Alt (bibliotheek-default)
                  <input
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                    defaultValue={asset.altDefault}
                    onBlur={(e) => {
                      if (e.target.value !== asset.altDefault) {
                        void onSaveAlt(asset, e.target.value);
                      }
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {statusFilter === "active" ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
                      onClick={() => void onArchive(asset)}
                    >
                      <Archive className="h-3 w-3" /> Archiveer
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
                      onClick={() => void onRestore(asset)}
                    >
                      <RotateCcw className="h-3 w-3" /> Herstel
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 px-2 py-1 text-[11px] text-red-200 hover:bg-red-400/10"
                    onClick={() => void onDelete(asset)}
                  >
                    <Trash2 className="h-3 w-3" /> Verwijder
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
