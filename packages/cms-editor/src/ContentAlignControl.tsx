import * as React from "react";
import {
  CONTENT_ALIGNS,
  DEFAULT_CONTENT_ALIGN,
  type ContentAlign,
} from "@mccoy/cms-schema";

const LABELS: Record<ContentAlign, string> = {
  left: "Links",
  center: "Midden",
  right: "Rechts",
};

/**
 * NL segment control for layout-level content alignment (constrained sections).
 */
export function ContentAlignControl({
  value,
  onChange,
  disabled = false,
  disabledReason,
}: {
  value?: ContentAlign | null;
  onChange: (next: ContentAlign) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const current = value ?? DEFAULT_CONTENT_ALIGN;
  const groupId = React.useId();

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
        Uitlijning
      </legend>
      <div
        role="radiogroup"
        aria-label="Sectie-uitlijning"
        className="inline-flex rounded-xl border border-white/10 bg-black/35 p-1"
      >
        {CONTENT_ALIGNS.map((align) => {
          const selected = current === align;
          return (
            <button
              key={align}
              type="button"
              role="radio"
              aria-checked={selected}
              id={`${groupId}-${align}`}
              disabled={disabled}
              onClick={() => onChange(align)}
              className={
                selected
                  ? "rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                  : "rounded-lg px-3 py-1.5 text-xs font-medium text-white/65 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              }
            >
              {LABELS[align]}
            </button>
          );
        })}
      </div>
      {disabled && disabledReason ? (
        <p className="text-[11px] leading-relaxed text-white/40">{disabledReason}</p>
      ) : (
        <p className="text-[11px] leading-relaxed text-white/35">
          Plaatst de inhoudskolom links, in het midden of rechts op brede schermen.
        </p>
      )}
    </fieldset>
  );
}
