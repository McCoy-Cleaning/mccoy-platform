import * as React from "react";
import {
  collectLegacyEmbeddedImages,
  replaceCmsImagesInTree,
  type CmsImage,
  type CmsPage,
} from "@mccoy/cms-schema";
import { adminMigrateLegacyCmsImage } from "@/lib/cms/media-client";

/**
 * Explicit legacy data-URL migration (Phase A warning + Phase B migrate).
 * Does not run as a side effect of Opslaan/publish.
 */
export function LegacyCmsImagesPanel({
  page,
  onReplacePage,
}: {
  page: CmsPage;
  onReplacePage: (next: CmsPage) => void;
}) {
  const legacy = React.useMemo(() => collectLegacyEmbeddedImages(page), [page]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (legacy.length === 0) return null;

  const migrateAll = async () => {
    setBusy(true);
    setError(null);
    const replacements = new Map<string, CmsImage>();
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < legacy.length; i++) {
      const img = legacy[i]!;
      setProgress(`Migreren ${i + 1}/${legacy.length}…`);
      const result = await adminMigrateLegacyCmsImage({
        data: {
          image: {
            assetId: img.assetId,
            src: img.src,
            alt: img.alt,
            decorative: img.decorative,
            width: img.width,
            height: img.height,
          },
          profile: "photo",
          tags: ["legacy-migrated"],
        },
      });
      if (!result.ok) {
        fail += 1;
        setError(result.error);
        continue;
      }
      replacements.set(img.assetId, result.image);
      replacements.set(img.src, result.image);
      ok += 1;
    }
    if (replacements.size > 0) {
      const next = replaceCmsImagesInTree(page, (image) => {
        return replacements.get(image.assetId) ?? replacements.get(image.src) ?? null;
      }) as CmsPage;
      onReplacePage(next);
    }
    setProgress(
      fail === 0
        ? `${ok} afbeelding${ok === 1 ? "" : "en"} gemigreerd naar de mediabibliotheek.`
        : `${ok} geslaagd, ${fail} mislukt — originele data-URL's blijven staan tot retry.`,
    );
    setBusy(false);
  };

  return (
    <div
      id="cms-legacy-images-panel"
      className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-50/95 space-y-3"
      role="region"
      aria-label="Migreer ingesloten afbeeldingen"
    >
      <p>
        <strong>Ingesloten legacy-afbeeldingen:</strong> deze pagina bevat {legacy.length} data-URL
        upload{legacy.length === 1 ? "" : "s"}. Migreer ze expliciet naar Supabase Storage vóór{" "}
        <strong>Opslaan &amp; publiceren</strong> — publiceren is geblokkeerd tot dit klaar is.
      </p>
      <button
        type="button"
        disabled={busy}
        className="rounded-xl border border-amber-300/40 bg-amber-300/15 px-3 py-2 text-[12px] font-semibold text-amber-50 hover:bg-amber-300/25 disabled:opacity-50"
        onClick={() => void migrateAll()}
      >
        {busy ? "Bezig…" : "Migreer ingesloten afbeeldingen"}
      </button>
      {progress ? <p role="status">{progress}</p> : null}
      {error ? (
        <p className="text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Phase C helper — true when publish should be blocked. */
export function pageHasLegacyEmbeddedImages(page: CmsPage): boolean {
  return collectLegacyEmbeddedImages(page).length > 0;
}
