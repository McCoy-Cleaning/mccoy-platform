import * as React from "react";
import {
  filterPopupContentTypeOptions,
  getPopupContentTypeOption,
  listPopupContentTypeOptions,
  type PopupContentBlockType,
  type PopupContentTypeOption,
} from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import { SectionTypeThumbnail } from "./SectionTypeThumbnail";

export { SectionTypeThumbnail } from "./SectionTypeThumbnail";

export function PopupContentTypePicker({
  open,
  selectedType,
  onClose,
  onPick,
}: {
  open: boolean;
  selectedType?: PopupContentBlockType;
  onClose: () => void;
  onPick: (type: PopupContentBlockType) => void;
}) {
  const [q, setQ] = React.useState("");
  const searchId = React.useId();
  const titleId = React.useId();
  const options = React.useMemo(() => listPopupContentTypeOptions(), []);
  const filtered = React.useMemo(
    () => filterPopupContentTypeOptions(options, q),
    [options, q],
  );

  React.useEffect(() => {
    if (!open) {
      setQ("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0a0a0f] shadow-2xl sm:max-h-[80vh] sm:max-w-4xl sm:rounded-3xl"
      >
        <header className="flex items-start gap-3 border-b border-white/10 p-5">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-2xl font-bold tracking-tight text-white">
              Kies wat er in de popup komt
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/50">
              Tik op een voorbeeld. Daarna vult u de tekst en afbeeldingen zelf in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="border-b border-white/10 p-5">
          <label htmlFor={searchId} className="sr-only">
            Zoek sectietype
          </label>
          <input
            id={searchId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek… (bijvoorbeeld galerij of tekst)"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-sky-400/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/45">Geen resultaten.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((opt) => (
                <PopupTypeCard
                  key={opt.type}
                  option={opt}
                  selected={opt.type === selectedType}
                  onPick={() => {
                    onPick(opt.type);
                    onClose();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PopupTypeCard({
  option,
  selected,
  onPick,
}: {
  option: PopupContentTypeOption;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${option.label}. ${option.description}`}
      aria-pressed={selected}
      className={cn(
        "group text-left rounded-2xl border bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-sky-400/50 hover:bg-white/[0.07]",
        selected ? "border-sky-400/60 ring-1 ring-sky-400/30" : "border-white/10",
      )}
    >
      <SectionTypeThumbnail type={option.type} className="mb-3" />
      <div className="text-[11px] font-medium uppercase tracking-wider text-white/40">
        {option.category}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-white">{option.label}</span>
        {selected ? (
          <span className="rounded-md border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
            Gekozen
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/55">
        {option.description}
      </p>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Trigger + summary for the button-popup content type. */
export function PopupContentTypeChooser({
  value,
  onChange,
}: {
  value: PopupContentBlockType;
  onChange: (type: PopupContentBlockType) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = getPopupContentTypeOption(value);

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-white/70">Wat zie je in de popup?</p>
      <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
        <SectionTypeThumbnail type={value} className="w-[7.5rem] shrink-0" />
        <div className="min-w-0 flex-1 self-center">
          <p className="text-[15px] font-semibold text-white">{selected.label}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-white/50">
            {selected.description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-3.5 text-[15px] font-semibold text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
      >
        Kies wat er in de popup komt
      </button>
      <PopupContentTypePicker
        open={open}
        selectedType={value}
        onClose={() => setOpen(false)}
        onPick={onChange}
      />
    </div>
  );
}
