import * as React from "react";
import { SECTION_FULL_BLEED } from "./sectionLayout";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Breaks out of a centered page rail to viewport width.
 * Parent pages/sections should clip overflow-x when needed.
 */
export function FullBleed({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "aside";
}) {
  return <Tag className={cn(SECTION_FULL_BLEED, className)}>{children}</Tag>;
}
