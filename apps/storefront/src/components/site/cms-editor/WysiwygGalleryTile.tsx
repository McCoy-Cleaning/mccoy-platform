import * as React from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  type CmsImage,
  type FixedSectionKey,
  type GalleryImageShape,
  type GalleryItem,
  type WorkGalleryContent,
} from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

const SHAPE_OPTIONS: Array<{ id: GalleryImageShape | "classic"; label: string; hint: string }> = [
  { id: "wide", label: "Breed", hint: "2×2" },
  { id: "square", label: "Vierkant", hint: "1×1" },
  { id: "tall", label: "Hoog", hint: "2 rijen" },
  { id: "classic", label: "Klassiek", hint: "auto" },
];

/** Section Werkgalerij or Media Galerij block — same mosaic chrome. */
export type WysiwygGalleryListTarget =
  | {
      kind: "section";
      sectionKey: FixedSectionKey;
      field: "items";
    }
  | {
      kind: "block";
      blockId: string;
      field: "images";
    };

export type WysiwygGalleryTileItem = {
  id: string;
  title: string;
  caption?: string;
  image: CmsImage;
  shape?: GalleryImageShape;
  body?: string;
};

/**
 * On-canvas chrome for Werkgalerij / Media Galerij mosaic tiles:
 * replace photo + choose tile size/orientation.
 * Does not cover the figcaption so title/caption stay click-to-edit.
 * Parent owns grid span classes (E10).
 */
export function WysiwygGalleryTileChrome({
  item,
  items,
  spanClass,
  listTarget = {
    kind: "section",
    sectionKey: "home.workGallery",
    field: "items",
  },
  children,
}: {
  item: WysiwygGalleryTileItem;
  items: WysiwygGalleryTileItem[];
  spanClass?: string;
  listTarget?: WysiwygGalleryListTarget;
  children: React.ReactNode;
}) {
  const { showEditorChrome, sendMutation, sendUiCommand } = useLiveEditApi();
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  if (!showEditorChrome) {
    return <div className={cn("relative h-full min-h-0 w-full", spanClass)}>{children}</div>;
  }

  const patchItems = (next: WysiwygGalleryTileItem[]) => {
    if (listTarget.kind === "section") {
      sendMutation({
        kind: "section",
        sectionKey: listTarget.sectionKey,
        patch: { [listTarget.field]: next } satisfies Partial<WorkGalleryContent>,
      });
      return;
    }
    sendMutation({
      kind: "block",
      blockId: listTarget.blockId,
      patch: { [listTarget.field]: next },
    });
  };

  const setShape = (shape: GalleryImageShape | "classic") => {
    patchItems(
      items.map((g) => {
        if (g.id !== item.id) return g;
        if (shape === "classic") {
          const { shape: _drop, ...rest } = g;
          void _drop;
          return rest;
        }
        return { ...g, shape };
      }),
    );
    setOpen(false);
  };

  const remove = () => {
    patchItems(items.filter((g) => g.id !== item.id));
    setOpen(false);
  };

  return (
    <div
      className={cn("relative h-full min-h-0 w-full", spanClass)}
      data-cms-gallery-tile=""
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        if (!open) setHovered(false);
      }}
    >
      {children}
      {(hovered || open) && (
        <div
          data-cms-editor-chrome
          className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-2"
        >
          <button
            type="button"
            data-cms-inline-edit=""
            aria-expanded={open}
            aria-label={`Foto bewerken: ${item.title || "galerij"}`}
            className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Foto & formaat
          </button>
          {open ? (
            <div
              role="dialog"
              aria-label="Galerijtegel"
              className="w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-[#0d1017] p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
                onClick={() => {
                  sendUiCommand({
                    kind: "openMediaPicker",
                    target:
                      listTarget.kind === "section"
                        ? {
                            kind: "section",
                            sectionKey: listTarget.sectionKey,
                            field: listTarget.field,
                            listItemId: item.id,
                            listImageKey: "image",
                          }
                        : {
                            kind: "block",
                            blockId: listTarget.blockId,
                            field: listTarget.field,
                            listItemId: item.id,
                            listImageKey: "image",
                          },
                  });
                  setOpen(false);
                }}
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                Foto vervangen
              </button>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Oriëntatie / grootte
              </p>
              <div
                className="mt-1.5 grid grid-cols-2 gap-1.5"
                role="radiogroup"
                aria-label="Tegelvorm"
              >
                {SHAPE_OPTIONS.map((opt) => {
                  const selected =
                    opt.id === "classic" ? !item.shape : item.shape === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-left",
                        selected
                          ? "border-sky-400/50 bg-sky-400/15"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25",
                      )}
                      onClick={() => setShape(opt.id)}
                    >
                      <span className="block text-xs font-semibold text-white">{opt.label}</span>
                      <span className="block text-[10px] text-white/45">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-300/90 hover:bg-red-500/15 hover:text-red-200"
                  onClick={remove}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  Verwijderen
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-white/50 hover:text-white"
                  onClick={() => {
                    setOpen(false);
                    setHovered(false);
                  }}
                >
                  Sluiten
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function WysiwygGalleryAddTileButton({
  items,
  listTarget = {
    kind: "section",
    sectionKey: "home.workGallery",
    field: "items",
  },
}: {
  items?: GalleryItem[] | WysiwygGalleryTileItem[];
  listTarget?: WysiwygGalleryListTarget;
}) {
  const { showEditorChrome, sendUiCommand } = useLiveEditApi();
  if (!showEditorChrome) return null;
  void items;

  return (
    <button
      type="button"
      data-cms-editor-chrome
      className="col-span-2 flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-sky-400/40 bg-sky-500/5 text-sm font-semibold text-sky-200 hover:border-sky-400/70 hover:bg-sky-500/10 md:col-span-1"
      onClick={() => {
        // Append on select — avoids invalid placeholder mutation (missing assetId) + race.
        sendUiCommand({
          kind: "openMediaPicker",
          target:
            listTarget.kind === "section"
              ? {
                  kind: "section",
                  sectionKey: listTarget.sectionKey,
                  field: listTarget.field,
                  listAppend: true,
                  listImageKey: "image",
                }
              : {
                  kind: "block",
                  blockId: listTarget.blockId,
                  field: listTarget.field,
                  listAppend: true,
                  listImageKey: "image",
                },
        });
      }}
    >
      <ImagePlus className="h-5 w-5" aria-hidden />
      Foto toevoegen
    </button>
  );
}
