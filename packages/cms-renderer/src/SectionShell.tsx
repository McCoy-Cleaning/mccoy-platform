import * as React from "react";
import type { BlockType } from "@mccoy/cms-schema";
import {
  SECTION_FULL_BLEED,
  SECTION_PAGE_RAIL,
  SECTION_SHELL_Y,
  SECTION_SHELL_Y_HERO,
  sectionInnerAlignRowClass,
  sectionInnerColumnClass,
  sectionWidthModeToInnerMax,
  type SectionInnerMaxWidth,
} from "./sectionLayout";
import { useContentAlign } from "./contentAlign";
import { getBlockChromeConfig, type SectionChromeConfig } from "./sectionChrome";
import { SectionAmbient, SectionSurface } from "./sectionChromeUi";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SectionShellTone = "default" | "muted" | "hero" | "cta";

export type SectionShellProps = {
  children: React.ReactNode;
  className?: string;
  tone?: SectionShellTone;
  blockType: BlockType;
  /** Narrow columns (richText / centered) must live on the inner, not the section. */
  innerMaxWidth?: SectionInnerMaxWidth;
  innerClassName?: string;
  /** Explicit override; defaults from BLOCK_CHROME_CONFIG. */
  chrome?: Partial<SectionChromeConfig>;
};

/**
 * Chrome-aware section wrapper. Width, ambient, and section surface follow
 * {@link getBlockChromeConfig} — never auto-renders titles.
 */
export function SectionShell({
  children,
  className,
  tone = "default",
  blockType,
  innerMaxWidth,
  innerClassName,
  chrome,
}: SectionShellProps) {
  const contentAlign = useContentAlign();
  const base = getBlockChromeConfig(blockType);
  const config: SectionChromeConfig = { ...base, ...chrome };
  const resolvedInner = innerMaxWidth ?? sectionWidthModeToInnerMax(config.widthMode);
  // Legacy tone=muted/cta only applies when the contract leaves surfaceMode as `none`.
  // Never stack a section surface on top of `items` mode (card soup).
  const framedTone =
    tone === "muted"
      ? ("outlined" as const)
      : tone === "cta"
        ? ("featured" as const)
        : null;
  const sectionVariant =
    config.surfaceMode === "section"
      ? (config.sectionVariant ?? "outlined")
      : config.surfaceMode === "none"
        ? framedTone
        : null;

  const rail =
    config.widthMode === "fullBleed" ? (
      <div className={SECTION_FULL_BLEED} data-cms-section-rail="full-bleed">
        {children}
      </div>
    ) : (
      <div className={SECTION_PAGE_RAIL} data-cms-section-rail="">
        <div className={sectionInnerAlignRowClass(contentAlign)} data-cms-section-align="">
          <div
            className={cn(sectionInnerColumnClass(resolvedInner), innerClassName)}
            data-cms-section-inner=""
          >
            {sectionVariant ? (
              <SectionSurface
                variant={sectionVariant}
                className={
                  sectionVariant === "featured"
                    ? "my-4 px-6 py-16 sm:px-12 sm:py-24"
                    : sectionVariant === "outlined" && tone === "muted"
                      ? "px-6 py-12 sm:px-10 sm:py-16"
                      : sectionVariant === "form"
                        ? undefined
                        : undefined
                }
              >
                {children}
              </SectionSurface>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    );

  return (
    <section
      data-cms-block-type={blockType}
      data-cms-content-align={contentAlign}
      data-cms-header-mode={config.headerMode}
      data-cms-surface-mode={config.surfaceMode}
      data-cms-width-mode={config.widthMode}
      className={cn(
        "isolate overflow-x-hidden",
        tone === "hero" ? SECTION_SHELL_Y_HERO : SECTION_SHELL_Y,
        className,
      )}
    >
      {config.ambient ? <SectionAmbient /> : null}
      <div className="relative">{rail}</div>
    </section>
  );
}
