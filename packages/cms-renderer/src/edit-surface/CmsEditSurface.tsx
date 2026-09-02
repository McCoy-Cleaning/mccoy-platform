import * as React from "react";
import type { BlockType, CmsButton, CmsImage } from "@mccoy/cms-schema";
import { getBlockWysiwygCapabilities } from "@mccoy/cms-schema";

/** Injected by storefront live-edit — never by RegisteredBlockView props. */
export type CmsEditSurfaceApi = {
  /** When false, all Editable* helpers are no-ops. */
  enabled: boolean;
  renderText: (args: {
    path: string;
    value: string;
    blockId: string;
    blockType: BlockType;
    multiline?: boolean;
    as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
    className?: string;
    children?: React.ReactNode;
  }) => React.ReactNode;
  renderMedia: (args: {
    path: string;
    blockId: string;
    blockType: BlockType;
    image?: CmsImage | null;
    /** When set, `path` is a repeater array field; update this item's image key. */
    listItemId?: string;
    listImageKey?: string;
    /** When false, missing image still renders children (no dashed upload tile). */
    emptyPlaceholder?: boolean;
    /** Optional layout class (e.g. mosaic tiles need h-full so absolute images paint). */
    className?: string;
    children: React.ReactNode;
  }) => React.ReactNode;
  /** Optional — storefront live-edit patch for block chrome (e.g. video kind). */
  sendBlockPatch?: (blockId: string, patch: Record<string, unknown>) => void;
  /** Optional — open admin media picker from renderer chrome. */
  openMediaPicker?: (target: {
    kind: "block";
    blockId: string;
    field: string;
    listItemId?: string;
    listImageKey?: string;
    listAppend?: boolean;
  }) => void;
  /**
   * Optional — Werkgalerij-parity mosaic tile chrome (replace + orientation).
   * When omitted, gallery featured tiles fall back to EditableMedia.
   */
  renderGalleryMosaicTile?: (args: {
    blockId: string;
    item: {
      id: string;
      title: string;
      caption?: string;
      image: CmsImage;
      shape?: "wide" | "square" | "tall";
      body?: string;
    };
    items: Array<{
      id: string;
      title: string;
      caption?: string;
      image: CmsImage;
      shape?: "wide" | "square" | "tall";
      body?: string;
    }>;
    spanClass: string;
    figure: React.ReactElement;
  }) => React.ReactNode;
  /** Optional — editable figcaption for mosaic tiles (title + caption). */
  renderGalleryMosaicFigcaption?: (args: {
    blockId: string;
    item: {
      id: string;
      title: string;
      caption?: string;
      image: CmsImage;
      shape?: "wide" | "square" | "tall";
      body?: string;
    };
    items: Array<{
      id: string;
      title: string;
      caption?: string;
      image: CmsImage;
      shape?: "wide" | "square" | "tall";
      body?: string;
    }>;
  }) => React.ReactNode;
  renderCta: (args: {
    path: string;
    blockId: string;
    blockType: BlockType;
    button: CmsButton;
    children: React.ReactNode;
  }) => React.ReactNode;
};

const CmsEditSurfaceContext = React.createContext<CmsEditSurfaceApi | null>(null);

export function CmsEditSurfaceProvider({
  value,
  children,
}: {
  value: CmsEditSurfaceApi;
  children: React.ReactNode;
}) {
  return (
    <CmsEditSurfaceContext.Provider value={value}>{children}</CmsEditSurfaceContext.Provider>
  );
}

export function useCmsEditSurface(): CmsEditSurfaceApi | null {
  return React.useContext(CmsEditSurfaceContext);
}

export type CmsBlockEditScopeValue = {
  blockId: string;
  blockType: BlockType;
};

const CmsBlockEditScopeContext = React.createContext<CmsBlockEditScopeValue | null>(null);

/**
 * Internal scope from RegisteredBlockView — not part of the public view props API.
 */
export function CmsBlockEditScope({
  blockId,
  blockType,
  children,
}: CmsBlockEditScopeValue & { children: React.ReactNode }) {
  const value = React.useMemo(() => ({ blockId, blockType }), [blockId, blockType]);
  return (
    <CmsBlockEditScopeContext.Provider value={value}>{children}</CmsBlockEditScopeContext.Provider>
  );
}

export function useCmsBlockEditScope(): CmsBlockEditScopeValue | null {
  return React.useContext(CmsBlockEditScopeContext);
}

function isCanvasPath(
  blockType: BlockType,
  path: string,
  kind: "text" | "media" | "cta",
  opts?: { listItemId?: string },
): boolean {
  const caps = getBlockWysiwygCapabilities(blockType);
  if (caps.advancedOnly.includes(path)) return false;
  if (caps.canvas.some((f) => f.path === path && f.kind === kind)) return true;
  // Repeater list media (gallery images, carousel slides): path is the array field.
  if (
    kind === "media" &&
    opts?.listItemId &&
    caps.canvas.some((f) => f.path === path && f.kind === "repeater")
  ) {
    return true;
  }
  // Indexed repeater item text: `columns.0.title`, `items.1.quote`, `articles.0.content`, …
  // Parent array path must be declared as a canvas repeater for this block type.
  if (kind === "text") {
    const indexed = /^([A-Za-z_][\w]*)\.(\d+)\.([A-Za-z_][\w.]*)$/.exec(path);
    if (
      indexed &&
      caps.canvas.some((f) => f.path === indexed[1] && f.kind === "repeater")
    ) {
      return true;
    }
    // String-array columns (comparisonTable): `columns.0`
    const indexedLeaf = /^([A-Za-z_][\w]*)\.(\d+)$/.exec(path);
    if (
      indexedLeaf &&
      caps.canvas.some((f) => f.path === indexedLeaf[1] && f.kind === "repeater")
    ) {
      return true;
    }
  }
  // Indexed repeater CTA (e.g. features.0.cta, plans.0.cta).
  if (kind === "cta") {
    const indexed = /^([A-Za-z_][\w]*)\.(\d+)\.([\w.]+)$/.exec(path);
    if (
      indexed &&
      caps.canvas.some((f) => f.path === indexed[1] && f.kind === "repeater")
    ) {
      return true;
    }
  }
  // E12: quote tab chrome copy (tag/title/description) — stable dotted paths.
  if (
    kind === "text" &&
    blockType === "quoteRequestForm" &&
    /^tabs\.\d+\.(tag|title|description)$/.test(path)
  ) {
    return true;
  }
  return false;
}

/**
 * On-canvas text when edit surface is active and path is canvas-capable.
 * Without a surface (published / SSR / tests): renders `children` unchanged,
 * or a plain tag with `value` when children are omitted.
 */
export function EditableText({
  path,
  value,
  as = "span",
  className,
  multiline,
  children,
}: {
  path: string;
  value: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  multiline?: boolean;
  children?: React.ReactNode;
}) {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();

  const fallback = () => {
    if (children != null) return <>{children}</>;
    const Tag = as;
    return <Tag className={className}>{value}</Tag>;
  };

  if (!surface?.enabled || !scope) return fallback();
  if (!isCanvasPath(scope.blockType, path, "text")) return fallback();

  return (
    <>
      {surface.renderText({
        path,
        value,
        blockId: scope.blockId,
        blockType: scope.blockType,
        multiline,
        as,
        className,
        children,
      })}
    </>
  );
}

/**
 * Wraps real media markup. Without edit surface → children only (zero layout change).
 * When `image` is missing and edit is on, the storefront frame shows an upload placeholder
 * unless `emptyPlaceholder` is false (e.g. video iframe with optional poster).
 */
export function EditableMedia({
  path,
  image,
  listItemId,
  listImageKey,
  emptyPlaceholder = true,
  className,
  children,
}: {
  path: string;
  image?: CmsImage | null;
  listItemId?: string;
  listImageKey?: string;
  /** When false, missing image still renders children (no dashed upload tile). */
  emptyPlaceholder?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();

  if (!surface?.enabled || !scope) {
    return <>{children}</>;
  }
  if (!isCanvasPath(scope.blockType, path, "media", { listItemId })) {
    return <>{children}</>;
  }

  return (
    <>
      {surface.renderMedia({
        path,
        blockId: scope.blockId,
        blockType: scope.blockType,
        image,
        listItemId,
        listImageKey,
        emptyPlaceholder,
        className,
        children,
      })}
    </>
  );
}

/** Dashed upload target — only meaningful when edit surface is active (caller gates). */
export function CmsMediaPlaceholder({
  label = "Afbeelding toevoegen",
  aspectClass = "aspect-[4/3]",
  className,
  onClick,
}: {
  label?: string;
  aspectClass?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      data-cms-editor-chrome
      data-cms-media-placeholder=""
      className={[
        "flex w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-sky-400/40 bg-sky-500/5 px-4 py-8 text-sm font-semibold text-sky-200",
        "hover:border-sky-400/70 hover:bg-sky-500/10",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300",
        aspectClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
    >
      {label}
    </button>
  );
}

/**
 * Wraps real CTA markup. Without edit surface → children only.
 */
export function EditableCta({
  path,
  button,
  children,
}: {
  path: string;
  button: CmsButton;
  children: React.ReactNode;
}) {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();

  if (!surface?.enabled || !scope) return <>{children}</>;
  if (!isCanvasPath(scope.blockType, path, "cta")) return <>{children}</>;

  return (
    <>
      {surface.renderCta({
        path,
        blockId: scope.blockId,
        blockType: scope.blockType,
        button,
        children,
      })}
    </>
  );
}
