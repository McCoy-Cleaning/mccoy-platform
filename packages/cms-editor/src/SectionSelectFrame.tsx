import * as React from "react";
import { FIXED_SECTION_DEFS, type FixedSectionKey } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";

export function SectionSelectFrame({
  sectionKey,
  selected,
  onSelect,
  children,
}: {
  sectionKey: FixedSectionKey;
  selected: boolean;
  onSelect: (key: FixedSectionKey) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Selecteer sectie ${FIXED_SECTION_DEFS[sectionKey]?.label ?? sectionKey}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect(sectionKey);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(sectionKey);
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
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          {FIXED_SECTION_DEFS[sectionKey]?.label ?? sectionKey}
        </span>
      ) : null}
    </div>
  );
}
