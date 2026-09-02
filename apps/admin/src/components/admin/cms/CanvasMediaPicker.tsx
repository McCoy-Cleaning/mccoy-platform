import * as React from "react";
import {
  createItemId,
  localImage,
  type CmsImage,
  type CmsMutation,
  type CmsUiCommand,
  type FixedSectionKey,
} from "@mccoy/cms-schema";
import { PrototypeImageField } from "@mccoy/cms-editor";
import { cms } from "@/lib/cms/store";
import { useCmsImagePickerProps } from "@/lib/cms/use-cms-image-picker-props";
import { notifyToast } from "@/lib/notify-toast";

type MediaTarget = Extract<CmsUiCommand, { kind: "openMediaPicker" }>["target"];

const EMPTY_IMAGE = localImage("/images/hero-placeholder.jpg", "", true);

function asCmsImage(value: unknown): CmsImage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const src = (value as { src?: unknown }).src;
  return typeof src === "string" && src.length > 0 ? (value as CmsImage) : null;
}

function readTargetImage(pageId: string, target: MediaTarget): CmsImage | null {
  const page = cms.getEditablePage(pageId);
  if (!page) return null;
  // Add-image flow: no existing image yet — never treat the items[] array as CmsImage.
  if (target.listAppend) return null;

  if (target.kind === "section" && page.kind === "builtin") {
    const section = page.sectionContent?.[target.sectionKey] as Record<string, unknown> | undefined;
    if (!section) return null;
    if (target.listItemId) {
      const items = section[target.field];
      if (!Array.isArray(items)) return null;
      const item = items.find(
        (entry) => entry && typeof entry === "object" && (entry as { id?: string }).id === target.listItemId,
      ) as Record<string, unknown> | undefined;
      const key = target.listImageKey ?? "image";
      return asCmsImage(item?.[key]);
    }
    // Vacatures media is a discriminated union `{ kind, image | videoUrl }`.
    if (target.sectionKey === "vacatures.application" && target.field === "media") {
      const media = section.media;
      if (media && typeof media === "object" && !Array.isArray(media)) {
        const rec = media as Record<string, unknown>;
        if (rec.kind === "image") return asCmsImage(rec.image);
      }
      return null;
    }
    return asCmsImage(section[target.field]);
  }

  if (target.kind === "block") {
    const block = page.blocks.find((b) => b.id === target.blockId);
    if (!block) return null;
    if (target.listItemId) {
      const items = block.data?.[target.field];
      if (!Array.isArray(items)) return null;
      const item = items.find(
        (entry) => entry && typeof entry === "object" && (entry as { id?: string }).id === target.listItemId,
      ) as Record<string, unknown> | undefined;
      const key = target.listImageKey ?? "image";
      return asCmsImage(item?.[key]);
    }
    return asCmsImage(block.data?.[target.field]);
  }

  return null;
}

function appendBlockListItem(
  items: unknown[],
  image: CmsImage,
  imageKey: string,
  targetField?: string,
): unknown[] {
  if (targetField === "steps") {
    return [
      ...items,
      {
        id: createItemId("step"),
        title: "Nieuwe stap",
        body: "Beschrijving",
        [imageKey]: image,
      },
    ];
  }
  return [
    ...items,
    {
      id: createItemId(targetField === "slides" ? "slide" : "img"),
      title: targetField === "slides" ? "Nieuwe slide" : "Nieuwe foto",
      [imageKey]: image,
    },
  ];
}

function appendListItem(
  sectionKey: FixedSectionKey | undefined,
  items: unknown[],
  image: CmsImage,
  imageKey: string,
  targetField?: string,
): unknown[] {
  if (sectionKey === "home.workGallery") {
    return [
      ...items,
      {
        id: createItemId("gallery"),
        title: "Nieuwe foto",
        [imageKey]: image,
      },
    ];
  }
  if (sectionKey === "home.partners") {
    return [
      ...items,
      {
        id: createItemId("partner"),
        name: "Nieuwe partner",
        [imageKey]: image,
        logoBackdrop: "auto",
      },
    ];
  }
  return appendBlockListItem(items, image, imageKey, targetField);
}

function buildImageMutation(target: MediaTarget, pageId: string, image: CmsImage | null): CmsMutation | null {
  const page = cms.getEditablePage(pageId);
  if (!page) return null;

  if (target.listAppend) {
    if (!image) return null;
    const imageKey = target.listImageKey ?? "image";
    if (target.kind === "section" && page.kind === "builtin") {
      const section = page.sectionContent?.[target.sectionKey] as Record<string, unknown> | undefined;
      const items = Array.isArray(section?.[target.field]) ? [...(section![target.field] as unknown[])] : [];
      const nextItems = appendListItem(target.sectionKey as FixedSectionKey, items, image, imageKey, target.field);
      return {
        kind: "section",
        sectionKey: target.sectionKey as FixedSectionKey,
        patch: { [target.field]: nextItems },
      };
    }
    if (target.kind === "block") {
      const block = page.blocks.find((b) => b.id === target.blockId);
      const items = Array.isArray(block?.data?.[target.field])
        ? [...(block!.data![target.field] as unknown[])]
        : [];
      const nextItems = appendListItem(undefined, items, image, imageKey, target.field);
      return {
        kind: "block",
        blockId: target.blockId,
        patch: { [target.field]: nextItems },
      };
    }
  }

  if (target.listItemId) {
    const imageKey = target.listImageKey ?? "image";
    if (target.kind === "section" && page.kind === "builtin") {
      const section = page.sectionContent?.[target.sectionKey] as Record<string, unknown> | undefined;
      const items = Array.isArray(section?.[target.field]) ? [...(section![target.field] as unknown[])] : [];
      const nextItems = items.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const rec = entry as Record<string, unknown>;
        if (rec.id !== target.listItemId) return entry;
        if (image == null) {
          const { [imageKey]: _drop, ...rest } = rec;
          void _drop;
          return rest;
        }
        return { ...rec, [imageKey]: image };
      });
      return {
        kind: "section",
        sectionKey: target.sectionKey as FixedSectionKey,
        patch: { [target.field]: nextItems },
      };
    }
    if (target.kind === "block") {
      const block = page.blocks.find((b) => b.id === target.blockId);
      const items = Array.isArray(block?.data?.[target.field])
        ? [...(block!.data![target.field] as unknown[])]
        : [];
      const nextItems = items.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const rec = entry as Record<string, unknown>;
        if (rec.id !== target.listItemId) return entry;
        if (image == null) {
          const { [imageKey]: _drop, ...rest } = rec;
          void _drop;
          return rest;
        }
        return { ...rec, [imageKey]: image };
      });
      return {
        kind: "block",
        blockId: target.blockId,
        patch: { [target.field]: nextItems },
      };
    }
  }

  return target.kind === "section"
    ? target.sectionKey === "vacatures.application" && target.field === "media"
      ? {
          kind: "section",
          sectionKey: target.sectionKey as FixedSectionKey,
          patch: {
            media: image
              ? { kind: "image" as const, image }
              : {
                  kind: "video" as const,
                  videoUrl:
                    "https://www.facebook.com/McCoyCleaning/videos/",
                },
          },
        }
      : {
          kind: "section",
          sectionKey: target.sectionKey as FixedSectionKey,
          patch: { [target.field]: image },
        }
    : {
        kind: "block",
        blockId: target.blockId,
        patch: { [target.field]: image },
      };
}

/**
 * Modal media picker opened from canvas "Vervangen" — reuses the existing
 * PrototypeImageField / Storage upload pipeline (no second upload system).
 */
export function CanvasMediaPicker({
  pageId,
  target,
  onClose,
  onApplied,
  applyMutation,
}: {
  pageId: string;
  target: MediaTarget | null;
  onClose: () => void;
  onApplied: () => void;
  /** When provided, records MEDIA_REPLACED in editor history. */
  applyMutation?: (
    mutation: CmsMutation,
  ) => { ok: true } | { ok: false; reason: string };
}) {
  const imagePickerProps = useCmsImagePickerProps();
  const [draft, setDraft] = React.useState<CmsImage | null>(null);

  React.useEffect(() => {
    if (!target) {
      setDraft(null);
      return;
    }
    // listAppend: seed placeholder so PrototypeImageField mounts (picker ready).
    if (target.listAppend) {
      setDraft(EMPTY_IMAGE);
      return;
    }
    setDraft(readTargetImage(pageId, target));
  }, [pageId, target]);

  if (!target) return null;

  const apply = (image: CmsImage | null) => {
    const mutation = buildImageMutation(target, pageId, image);
    if (!mutation) {
      notifyToast({
        kind: "error",
        title: "Afbeelding bijwerken mislukt",
        description: "Doel niet gevonden.",
      });
      return;
    }

    if (applyMutation) {
      const result = applyMutation(mutation);
      if (!result.ok) {
        notifyToast({
          kind: "error",
          title: "Afbeelding bijwerken mislukt",
          description: result.reason,
        });
        return;
      }
    } else if (mutation.kind === "section") {
      const result = cms.patchSectionContent(pageId, mutation.sectionKey, mutation.patch);
      if (!result.ok) {
        notifyToast({
          kind: "error",
          title: "Afbeelding bijwerken mislukt",
          description: result.reason,
        });
        return;
      }
    } else if (mutation.kind === "block") {
      cms.updateLayoutBlock(pageId, mutation.blockId, mutation.patch);
    }

    onApplied();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={target.listAppend ? "Afbeelding toevoegen" : "Afbeelding vervangen"}
        className="relative w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0a0a0f] p-5 shadow-2xl sm:rounded-3xl"
      >
        <h3 className="text-lg font-bold text-white">
          {target.listAppend ? "Afbeelding toevoegen" : "Afbeelding vervangen"}
        </h3>
        <p className="mt-1 text-sm text-white/50">
          Kies of upload via de mediabibliotheek — dezelfde pipeline als Secties.
        </p>
        <div className="mt-4">
          {draft ? (
            <PrototypeImageField
              label="Afbeelding"
              value={draft}
              onChange={(image) => {
                setDraft(image);
                apply(image);
              }}
              onClear={target.listAppend ? undefined : () => apply(null)}
              {...imagePickerProps}
            />
          ) : (
            <button
              type="button"
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-8 text-sm font-medium text-white/70 hover:border-sky-400/50 hover:text-white"
              onClick={() => setDraft(EMPTY_IMAGE)}
            >
              Foto toevoegen
            </button>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-white/60 hover:text-white"
            onClick={onClose}
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
