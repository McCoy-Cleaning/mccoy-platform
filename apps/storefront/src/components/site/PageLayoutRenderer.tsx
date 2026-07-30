import * as React from "react";
import type { BuiltinPageKey, BuiltinCmsPage, CmsPage, FixedSectionKey, LayoutItem } from "@mccoy/cms-schema";
import { resolveLayoutItemContentAlign, suppressedProductsFixedKeys } from "@mccoy/cms-schema";
import { ContentAlignProvider } from "@mccoy/cms-renderer";
import { BlocksView } from "@/components/site/BlockView";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

export type SectionRenderMode = "public" | "preview" | "admin";

type FixedRenderer = React.ComponentType;

export type PageSectionRenderers = Partial<
  Record<BuiltinPageKey, Partial<Record<FixedSectionKey, FixedRenderer>>>
>;

type SafeSectionBoundaryProps = {
  sectionKey: string;
  mode: SectionRenderMode;
  children: React.ReactNode;
};

type BoundaryState = { error: Error | null };

/** Isolates a broken section so the rest of the page still renders. */
export class SafeSectionBoundary extends React.Component<SafeSectionBoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[cms-layout] section render failed", {
      sectionKey: this.props.sectionKey,
      message: error.message,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (this.props.mode === "public") {
      return null;
    }

    return (
      <div
        role="alert"
        className="mx-auto my-4 max-w-3xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      >
        Sectie kon niet worden getoond: <strong>{this.props.sectionKey}</strong>
      </div>
    );
  }
}

export type PageLayoutRendererProps = {
  page: CmsPage;
  pageKey: BuiltinPageKey;
  renderers: PageSectionRenderers;
  mode?: SectionRenderMode;
  /** When false, hidden fixed sections are still rendered (admin). Default: true for public. */
  respectHidden?: boolean;
};

function useSelectOnPointerDown(
  enabled: boolean,
  onSelect: () => void,
  opts?: { ignoreSelector?: string },
): {
  ref: React.RefObject<HTMLDivElement | null>;
  onPointerDown: ((e: React.PointerEvent<HTMLDivElement>) => void) | undefined;
} {
  const ref = React.useRef<HTMLDivElement>(null);

  // Use React's onPointerDown (not a post-mount useEffect listener) so the chrome
  // is interactive as soon as it appears in the DOM — E2E clicks must not race
  // an effect that attaches too late.
  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const t = e.target as HTMLElement | null;
      // Always select the section so the admin inspector opens — including when the
      // click lands on inline-editable copy (contentEditable). Skipping onSelect here
      // left canvas clicks silent for the parent bridge.
      if (!(opts?.ignoreSelector && t?.closest(opts.ignoreSelector))) {
        onSelect();
      }
      if (t?.closest("[data-cms-inline-edit]")) return;
      if (t?.closest("a, button, [data-cms-nav], [data-cms-navigate]")) {
        e.preventDefault();
      }
    },
    [enabled, onSelect, opts?.ignoreSelector],
  );

  return { ref, onPointerDown: enabled ? onPointerDown : undefined };
}

function FixedSelectChrome({
  sectionKey,
  mode,
  children,
}: {
  sectionKey: FixedSectionKey;
  mode: SectionRenderMode;
  children: React.ReactNode;
}) {
  const { isEdit, selection, setSelection } = useLiveEditApi();
  const enabled = isEdit && mode === "admin";
  // Whole-section highlight only when no composite part is selected.
  const selected =
    selection?.kind === "fixed" &&
    selection.sectionKey === sectionKey &&
    !selection.part;
  const onSelect = React.useCallback(() => {
    setSelection({ kind: "fixed", sectionKey });
  }, [setSelection, sectionKey]);
  const { ref, onPointerDown } = useSelectOnPointerDown(enabled, onSelect, {
    ignoreSelector: "[data-cms-select-part]",
  });

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-cms-select={sectionKey}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected &&
          "z-[1] ring-2 ring-sky-400 ring-offset-2 ring-offset-background shadow-[0_0_0_4px_rgba(56,189,248,0.18)]",
      )}
    >
      {children}
      {selected ? (
        <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          Geselecteerd
        </span>
      ) : null}
    </div>
  );
}

/** Selectable chrome for a visual part inside a composite fixed section. */
export function CompositePartSelectChrome({
  sectionKey,
  part,
  children,
  label,
}: {
  sectionKey: FixedSectionKey;
  part: string;
  children: React.ReactNode;
  label?: string;
}) {
  const { isEdit, selection, setSelection } = useLiveEditApi();
  const enabled = isEdit;
  const selected =
    selection?.kind === "fixed" &&
    selection.sectionKey === sectionKey &&
    selection.part === part;
  const onSelect = React.useCallback(() => {
    setSelection({ kind: "fixed", sectionKey, part });
  }, [setSelection, sectionKey, part]);
  const { ref, onPointerDown } = useSelectOnPointerDown(enabled, onSelect);

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-cms-select={`${sectionKey}:${part}`}
      data-cms-select-part={part}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected &&
          "z-[1] ring-2 ring-sky-400 ring-offset-2 ring-offset-background shadow-[0_0_0_4px_rgba(56,189,248,0.18)]",
      )}
    >
      {children}
      {selected ? (
        <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          {label ?? "Geselecteerd"}
        </span>
      ) : null}
    </div>
  );
}

function BlockSelectChrome({
  blockId,
  layoutItemId,
  mode,
  children,
}: {
  blockId: string;
  layoutItemId: string;
  mode: SectionRenderMode;
  children: React.ReactNode;
}) {
  const { isEdit, selection, setSelection } = useLiveEditApi();
  const enabled = isEdit && mode === "admin";
  const selected = selection?.kind === "block" && selection.blockId === blockId;
  const onSelect = React.useCallback(() => {
    setSelection({ kind: "block", blockId, layoutItemId });
  }, [setSelection, blockId, layoutItemId]);
  const { ref, onPointerDown } = useSelectOnPointerDown(enabled, onSelect);

  if (!enabled) return <>{children}</>;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-cms-select-block={blockId}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative outline-none transition",
        "focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected &&
          "z-[1] ring-2 ring-sky-400 ring-offset-2 ring-offset-background shadow-[0_0_0_4px_rgba(56,189,248,0.18)]",
      )}
    >
      {children}
      {selected ? (
        <span className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          Paginasectie
        </span>
      ) : null}
    </div>
  );
}

export function PageLayoutRenderer({
  page,
  pageKey,
  renderers,
  mode = "public",
  respectHidden = mode === "public",
}: PageLayoutRendererProps) {
  const registry = renderers[pageKey] ?? {};
  const blockById = React.useMemo(() => {
    const map = new Map(page.blocks.map((b) => [b.id, b]));
    return map;
  }, [page.blocks]);
  const suppressFixed =
    page.kind === "builtin"
      ? suppressedProductsFixedKeys(page as BuiltinCmsPage)
      : new Set<FixedSectionKey>();

  return (
    <>
      {page.layout.map((item) => (
        <LayoutItemView
          key={item.id}
          item={item}
          pageId={page.id}
          registry={registry}
          blockById={blockById}
          mode={mode}
          respectHidden={respectHidden}
          suppressFixed={suppressFixed}
        />
      ))}
    </>
  );
}

function LayoutItemView({
  item,
  pageId,
  registry,
  blockById,
  mode,
  respectHidden,
  suppressFixed,
}: {
  item: LayoutItem;
  pageId: string;
  registry: Partial<Record<FixedSectionKey, FixedRenderer>>;
  blockById: Map<string, CmsPage["blocks"][number]>;
  mode: SectionRenderMode;
  respectHidden: boolean;
  suppressFixed: Set<FixedSectionKey>;
}) {
  const contentAlign = resolveLayoutItemContentAlign(item);

  if (item.kind === "fixed") {
    // Producten dual-read: blocks win — never render fixed + migrated block together.
    if (suppressFixed.has(item.key)) return null;
    if (respectHidden && item.hidden) return null;
    const Comp = registry[item.key];
    if (!Comp) {
      console.error("[cms-layout] missing fixed section renderer", { key: item.key });
      if (mode === "public") return null;
      return (
        <div role="alert" className="mx-auto my-4 max-w-3xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Ontbrekende renderer: {item.key}
        </div>
      );
    }
    const body =
      item.hidden && !respectHidden ? (
        <div className="relative opacity-40 ring-1 ring-inset ring-amber-400/30" data-cms-hidden="true">
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
            Verborgen
          </div>
          <Comp />
        </div>
      ) : (
        <Comp />
      );

    return (
      <ContentAlignProvider align={contentAlign}>
        <SafeSectionBoundary sectionKey={item.key} mode={mode}>
          <FixedSelectChrome sectionKey={item.key} mode={mode}>
            {body}
          </FixedSelectChrome>
        </SafeSectionBoundary>
      </ContentAlignProvider>
    );
  }

  const block = blockById.get(item.blockId);
  if (!block) {
    console.error("[cms-layout] missing block payload", { blockId: item.blockId });
    if (mode === "public") return null;
    return (
      <div role="alert" className="mx-auto my-4 max-w-3xl rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Ontbrekende paginasectie: {item.blockId}
      </div>
    );
  }

  if (respectHidden && item.hidden) return null;

  const blockBody = <BlocksView blocks={[block]} pageId={pageId} />;

  return (
    <ContentAlignProvider align={contentAlign}>
      <SafeSectionBoundary sectionKey={`block:${item.blockId}`} mode={mode}>
        <BlockSelectChrome blockId={item.blockId} layoutItemId={item.id} mode={mode}>
          {item.hidden && !respectHidden ? (
            <div className="relative opacity-40 ring-1 ring-inset ring-amber-400/30" data-cms-hidden="true">
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                Verborgen
              </div>
              {blockBody}
            </div>
          ) : (
            blockBody
          )}
        </BlockSelectChrome>
      </SafeSectionBoundary>
    </ContentAlignProvider>
  );
}
