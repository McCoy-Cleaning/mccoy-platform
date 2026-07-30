import * as React from "react";
import {
  DEFAULT_CONTENT_ALIGN,
  type ContentAlign,
} from "@mccoy/cms-schema";
import {
  SECTION_PAGE_RAIL,
  sectionInnerAlignRowClass,
  sectionInnerColumnClass,
  type SectionInnerMaxWidth,
} from "./sectionLayout";
import { useContentAlign } from "./contentAlign";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Constrained content column that honors layout `contentAlign` from context.
 *
 * Structure: page rail (gutters + max-w-[96rem]) → align row → column.
 * Align shifts the column within the page content width, not the viewport.
 */
export function SectionInner({
  children,
  className,
  align: alignOverride,
  maxWidth = "7xl",
}: {
  children: React.ReactNode;
  className?: string;
  align?: ContentAlign;
  maxWidth?: SectionInnerMaxWidth;
}) {
  const ctxAlign = useContentAlign();
  const align = alignOverride ?? ctxAlign ?? DEFAULT_CONTENT_ALIGN;
  return (
    <div className={SECTION_PAGE_RAIL} data-cms-section-rail="">
      <div
        className={sectionInnerAlignRowClass(align)}
        data-cms-content-align={align}
        data-cms-section-align=""
      >
        <div
          className={cn(sectionInnerColumnClass(maxWidth), className)}
          data-cms-section-inner=""
        >
          {children}
        </div>
      </div>
    </div>
  );
}
