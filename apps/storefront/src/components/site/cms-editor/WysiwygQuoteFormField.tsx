import * as React from "react";
import {
  FORM_FIELD_TYPE_LABELS_NL,
  formFieldPayloadKey,
  isQuoteProtectedField,
  withFrozenPayloadKey,
  type FormFieldItem,
  type QuoteRequestFormBlockData,
  type QuoteRequestFormTab,
} from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

type QuoteFieldMutationTarget =
  | { kind: "block"; blockId: string }
  | {
      kind: "section";
      sectionKey: "offerte.form";
      quote: QuoteRequestFormBlockData;
    };

/**
 * E12 — Offerte field chrome: label/placeholder only.
 * Parent owns the relative grid host (E10 parity). This component must not
 * introduce an extra layout wrapper — overlays only.
 */
export function WysiwygQuoteFormFieldChrome({
  field,
  tab,
  tabIndex,
  blockId,
  sectionKey,
  quote,
  children,
}: {
  field: FormFieldItem;
  tab: QuoteRequestFormTab;
  tabIndex: number;
  /** Block quoteRequestForm mutations. Prefer `sectionKey` + `quote` for fixed offerte.form. */
  blockId?: string;
  sectionKey?: "offerte.form";
  quote?: QuoteRequestFormBlockData;
  className?: string;
  children: React.ReactNode;
}) {
  const { showEditorChrome, sendMutation } = useLiveEditApi();
  const [open, setOpen] = React.useState(false);
  const frozen = withFrozenPayloadKey(field);
  const [label, setLabel] = React.useState(frozen.label);
  const [placeholder, setPlaceholder] = React.useState(frozen.placeholder ?? "");
  const protectedField = isQuoteProtectedField(frozen);

  React.useEffect(() => {
    setLabel(frozen.label);
    setPlaceholder(frozen.placeholder ?? "");
  }, [frozen.label, frozen.placeholder]);

  if (!showEditorChrome) {
    return <>{children}</>;
  }

  const resolveTarget = (): QuoteFieldMutationTarget | null => {
    if (sectionKey === "offerte.form" && quote) {
      return { kind: "section", sectionKey, quote };
    }
    if (blockId) return { kind: "block", blockId };
    return null;
  };

  const commit = () => {
    const nextLabel = label.trim() || frozen.label;
    const nextPlaceholder = placeholder.trim() || undefined;
    if (nextLabel === frozen.label && nextPlaceholder === frozen.placeholder) {
      setOpen(false);
      return;
    }
    const fields = tab.fields.map((f) =>
      f.id === frozen.id
        ? withFrozenPayloadKey({
            ...f,
            label: nextLabel,
            placeholder: nextPlaceholder,
            id: f.id,
            type: f.type,
            payloadKey: frozen.payloadKey ?? formFieldPayloadKey(f),
          })
        : f,
    );
    const target = resolveTarget();
    if (!target) {
      setOpen(false);
      return;
    }
    if (target.kind === "block") {
      sendMutation({
        kind: "block",
        blockId: target.blockId,
        patch: { [`tabs.${tabIndex}.fields`]: fields },
      });
    } else {
      const tabs = target.quote.tabs.map((t, i) =>
        i === tabIndex ? { ...t, fields } : t,
      );
      sendMutation({
        kind: "section",
        sectionKey: target.sectionKey,
        patch: { quote: { ...target.quote, tabs } },
      });
    }
    setOpen(false);
  };

  return (
    <>
      {children}
      <button
        type="button"
        data-cms-inline-edit=""
        aria-expanded={open}
        aria-label={`Offerteveld bewerken: ${frozen.label}`}
        className={cn(
          "absolute inset-0 z-[1] rounded-lg outline-none transition",
          open ? "ring-2 ring-sky-400" : "hover:ring-2 hover:ring-sky-400/40",
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      />
      {open ? (
        <div
          data-cms-editor-chrome
          role="dialog"
          aria-label="Offerte veldpresentatie"
          className="absolute right-0 top-0 z-40 w-72 -translate-y-2 translate-x-2 rounded-xl border border-white/15 bg-[#0d1017] p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
            {FORM_FIELD_TYPE_LABELS_NL[frozen.type]} · key {formFieldPayloadKey(frozen)}
          </p>
          <p className="mt-1 text-[11px] text-white/45">
            Type en submission key zijn vast (systeemcontract).
          </p>
          <label className="mt-2 block text-[11px] font-semibold text-white/50">
            Label
            <input
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          {frozen.type !== "select" ? (
            <label className="mt-2 block text-[11px] font-semibold text-white/50">
              Placeholder
              <input
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            </label>
          ) : null}
          <p className="mt-2 text-[11px] text-white/40">
            Verplicht: {frozen.required ? "ja" : "nee"}
            {protectedField ? " · vergrendeld" : ""}
          </p>
          <div className="mt-3 flex justify-end gap-1">
            <button
              type="button"
              className="rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
              onClick={commit}
            >
              Toepassen
            </button>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-white/50 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Sluiten
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
