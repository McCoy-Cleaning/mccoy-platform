import * as React from "react";
import { ArrowDown, ArrowUp, Columns2, Plus, Rows3, Trash2 } from "lucide-react";
import {
  BUILTIN_CONTACT_FORM_EMAIL_ID,
  BUILTIN_CONTACT_FORM_NAME_ID,
  CONTACT_FORM_CUSTOM_FIELD_TYPES,
  FORM_FIELD_TYPE_LABELS_NL,
  createFormFieldItem,
  createFormFieldOption,
  formFieldPayloadKey,
  normalizeContactFormColumnsDesktop,
  sanitizePayloadKey,
  withFrozenPayloadKey,
  type ContactFormColumnsDesktop,
  type FormFieldItem,
  type FormFieldOption,
  type FormFieldType,
  type FixedSectionKey,
} from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

const COLUMN_OPTIONS: Array<{
  id: ContactFormColumnsDesktop;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  {
    id: 1,
    label: "1 kolom",
    hint: "Velden onder elkaar",
    icon: <Rows3 className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: 2,
    label: "2 kolommen",
    hint: "Naast elkaar op desktop",
    icon: <Columns2 className="h-3.5 w-3.5" aria-hidden />,
  },
];

function createCustomFormField(type: FormFieldType): FormFieldItem {
  const label = FORM_FIELD_TYPE_LABELS_NL[type];
  if (type === "select") {
    return withFrozenPayloadKey(
      createFormFieldItem(label, type, {
        options: [createFormFieldOption("Optie 1"), createFormFieldOption("Optie 2")],
      }),
    );
  }
  return withFrozenPayloadKey(createFormFieldItem(label, type));
}

function isInjectedNameOrEmail(field: FormFieldItem): boolean {
  return (
    field.id === BUILTIN_CONTACT_FORM_NAME_ID ||
    field.id === BUILTIN_CONTACT_FORM_EMAIL_ID ||
    field.type === "name" ||
    field.type === "email"
  );
}

/** Persistable fields — name/email builtins are re-injected by resolveContactFormFields. */
function persistableFields(fields: FormFieldItem[]): FormFieldItem[] {
  return fields.filter((f) => !isInjectedNameOrEmail(f));
}

export type WysiwygFormFieldsTarget =
  | { kind: "section"; sectionKey: FixedSectionKey }
  | { kind: "block"; blockId: string };

/** Contextual editor for a single contact-form field rendered on the real form. */
export function WysiwygFormFieldChrome({
  field,
  fields,
  target,
  className,
  children,
}: {
  field: FormFieldItem;
  fields: FormFieldItem[];
  target: WysiwygFormFieldsTarget;
  className?: string;
  children: React.ReactNode;
}) {
  const { showEditorChrome, sendMutation } = useLiveEditApi();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(field.label);
  const [fieldName, setFieldName] = React.useState(
    field.payloadKey?.trim() || formFieldPayloadKey(field),
  );
  const [placeholder, setPlaceholder] = React.useState(field.placeholder ?? "");
  const [required, setRequired] = React.useState(!!field.required);
  const [options, setOptions] = React.useState<FormFieldOption[]>(field.options ?? []);
  const injected = isInjectedNameOrEmail(field);
  const payloadKey = formFieldPayloadKey(field);

  React.useEffect(() => {
    // Don't clobber in-progress edits while the panel is open (parent re-renders
    // often recreate `field` object identity).
    if (open) return;
    setLabel(field.label);
    setFieldName(field.payloadKey?.trim() || formFieldPayloadKey(field));
    setPlaceholder(field.placeholder ?? "");
    setRequired(!!field.required);
    setOptions(field.options ?? []);
  }, [field, open]);

  if (!showEditorChrome) {
    return (
      <div className={cn(className, "relative")} data-cms-form-field-chrome="">
        {children}
      </div>
    );
  }

  const patchFields = (next: FormFieldItem[], labelsPatch?: Record<string, string>) => {
    const custom = persistableFields(next);
    const patch: Record<string, unknown> = { fields: custom };
    if (labelsPatch && Object.keys(labelsPatch).length > 0) {
      patch.labels = labelsPatch;
    }
    if (target.kind === "section") {
      sendMutation({ kind: "section", sectionKey: target.sectionKey, patch });
      return;
    }
    sendMutation({ kind: "block", blockId: target.blockId, patch });
  };

  const index = fields.findIndex((f) => f.id === field.id);

  const commit = () => {
    const nextLabel = label.trim() || field.label;
    const nextPlaceholder = placeholder.trim() || undefined;
    const nextOptions =
      field.type === "select"
        ? options
            .map((o) => ({
              ...o,
              label: o.label.trim(),
              value: o.value?.trim() || undefined,
            }))
            .filter((o) => o.label.length > 0)
        : field.options;

    // Injected name/email rows are not persisted in `fields` — keep their
    // submission keys stable. All other fields (incl. phone) freeze the edited key.
    const nextPayloadKey = injected
      ? payloadKey
      : sanitizePayloadKey(fieldName.trim() || nextLabel);

    const labelsPatch: Record<string, string> = {};
    const labelKeys = ["name", "email", "company", "phone", "message"] as const;
    if ((labelKeys as readonly string[]).includes(payloadKey)) {
      labelsPatch[payloadKey] = nextLabel;
    }
    if (
      nextPayloadKey &&
      nextPayloadKey !== payloadKey &&
      (labelKeys as readonly string[]).includes(nextPayloadKey)
    ) {
      labelsPatch[nextPayloadKey] = nextLabel;
    }

    patchFields(
      fields.map((f) =>
        f.id === field.id
          ? {
              ...f,
              label: nextLabel,
              placeholder: nextPlaceholder,
              required,
              options: nextOptions,
              payloadKey: nextPayloadKey,
            }
          : f,
      ),
      labelsPatch,
    );
    setOpen(false);
  };

  return (
    <div className={cn(className, "relative")} data-cms-form-field-chrome="">
      {children}
      <button
        type="button"
        data-cms-inline-edit=""
        aria-expanded={open}
        aria-label={`Veld bewerken: ${field.label}`}
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
          aria-label="Veldinstellingen"
          className="absolute right-0 top-0 z-40 max-h-[min(28rem,70vh)] w-80 -translate-y-2 translate-x-2 overflow-y-auto rounded-xl border border-white/15 bg-[#0d1017] p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
            {FORM_FIELD_TYPE_LABELS_NL[field.type]}
          </p>
          <label className="mt-2 block text-[11px] font-semibold text-white/50">
            Label (zichtbaar)
            <input
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="mt-2 block text-[11px] font-semibold text-white/50">
            Veldnaam
            <input
              className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white disabled:opacity-50"
              value={fieldName}
              disabled={injected}
              onChange={(e) => setFieldName(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              data-testid="cms-form-field-payload-key"
            />
          </label>
          <p className="mt-1 text-[10px] text-white/40">
            {injected
              ? `Systeemsleutel "${payloadKey}" (naam/e-mail blijven vast voor inzendingen).`
              : "Technische naam in inzendingen; letters/cijfers/underscore."}
          </p>
          {field.type !== "select" ? (
            <label className="mt-2 block text-[11px] font-semibold text-white/50">
              Placeholder
              <input
                className="mt-1 w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            </label>
          ) : null}
          <label className="mt-2 flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={required}
              disabled={injected}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Verplicht
          </label>
          {field.type === "select" ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-white/50">Keuze-opties</p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/15"
                  onClick={() =>
                    setOptions((prev) => [...prev, createFormFieldOption(`Optie ${prev.length + 1}`)])
                  }
                >
                  <Plus className="h-3 w-3" aria-hidden />
                  Optie
                </button>
              </div>
              {options.length === 0 ? (
                <p className="text-[11px] text-white/40">Nog geen opties — voeg er minstens één toe.</p>
              ) : null}
              {options.map((opt, optIndex) => (
                <div
                  key={opt.id}
                  className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-2"
                >
                  <input
                    className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm text-white"
                    value={opt.label}
                    placeholder="Optielabel"
                    aria-label={`Optie ${optIndex + 1} label`}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOptions((prev) =>
                        prev.map((row) => (row.id === opt.id ? { ...row, label: value } : row)),
                      );
                    }}
                  />
                  <input
                    className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/80"
                    value={opt.value ?? ""}
                    placeholder="Waarde (optioneel)"
                    aria-label={`Optie ${optIndex + 1} waarde`}
                    onChange={(e) => {
                      const value = e.target.value;
                      setOptions((prev) =>
                        prev.map((row) =>
                          row.id === opt.id ? { ...row, value: value.trim() || undefined } : row,
                        ),
                      );
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[10px] text-white/50 hover:text-white disabled:opacity-35"
                      disabled={optIndex === 0}
                      onClick={() => {
                        if (optIndex <= 0) return;
                        setOptions((prev) => {
                          const next = [...prev];
                          const [row] = next.splice(optIndex, 1);
                          next.splice(optIndex - 1, 0, row!);
                          return next;
                        });
                      }}
                    >
                      Omhoog
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-white/50 hover:text-white disabled:opacity-35"
                      disabled={optIndex >= options.length - 1}
                      onClick={() => {
                        if (optIndex >= options.length - 1) return;
                        setOptions((prev) => {
                          const next = [...prev];
                          const [row] = next.splice(optIndex, 1);
                          next.splice(optIndex + 1, 0, row!);
                          return next;
                        });
                      }}
                    >
                      Omlaag
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-[10px] text-rose-300/80 hover:text-rose-200"
                      onClick={() => setOptions((prev) => prev.filter((row) => row.id !== opt.id))}
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <ChromeBtn
              label="Omhoog"
              disabled={index <= 0 || injected}
              onClick={() => {
                if (index <= 0) return;
                const next = [...fields];
                const [item] = next.splice(index, 1);
                next.splice(index - 1, 0, item!);
                patchFields(next);
              }}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </ChromeBtn>
            <ChromeBtn
              label="Omlaag"
              disabled={index < 0 || index >= fields.length - 1 || injected}
              onClick={() => {
                if (index < 0 || index >= fields.length - 1) return;
                const next = [...fields];
                const [item] = next.splice(index, 1);
                next.splice(index + 1, 0, item!);
                patchFields(next);
              }}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </ChromeBtn>
            {!injected ? (
              <ChromeBtn
                label="Verwijderen"
                onClick={() => patchFields(fields.filter((f) => f.id !== field.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ChromeBtn>
            ) : null}
            <button
              type="button"
              className="ml-auto rounded-md bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-600"
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
    </div>
  );
}

/** Canvas toolbar: field-grid columns + add field by type. */
export function WysiwygFormFieldsToolbar({
  fields,
  target,
  formColumnsDesktop,
  className,
}: {
  fields: FormFieldItem[];
  target: WysiwygFormFieldsTarget;
  formColumnsDesktop: ContactFormColumnsDesktop;
  className?: string;
}) {
  const { showEditorChrome, isEdit, sendMutation } = useLiveEditApi();
  const [typeMenuOpen, setTypeMenuOpen] = React.useState(false);
  const columns = normalizeContactFormColumnsDesktop(formColumnsDesktop);

  const patchForm = React.useCallback(
    (patch: Record<string, unknown>) => {
      if (target.kind === "section") {
        sendMutation({ kind: "section", sectionKey: target.sectionKey, patch });
        return;
      }
      sendMutation({ kind: "block", blockId: target.blockId, patch });
    },
    [sendMutation, target],
  );

  // Edit iframe but Preview mode: explain why controls are hidden.
  if (isEdit && !showEditorChrome) {
    return (
      <div
        data-cms-editor-chrome
        data-cms-form-toolbar="preview-blocked"
        className={cn(
          "rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100",
          className,
        )}
      >
        Formuliervelden bewerken staat uit in Preview. Schakel terug naar{" "}
        <strong className="font-semibold">Bewerken</strong> om layout en veldtypes te kiezen.
      </div>
    );
  }

  if (!showEditorChrome) return null;

  return (
    <div
      data-cms-editor-chrome
      data-cms-form-toolbar="visible"
      data-cms-form-target={target.kind}
      className={cn(
        "flex flex-col gap-3 rounded-xl border-2 border-dashed border-sky-400/70 bg-sky-500/15 p-3 shadow-lg shadow-sky-950/40 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div
        role="radiogroup"
        aria-label="Kolommen op desktop"
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
          Veldlayout
        </span>
        {COLUMN_OPTIONS.map((opt) => {
          const selected = columns === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={opt.hint}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                selected
                  ? "bg-sky-500 text-white shadow"
                  : "bg-black/30 text-white/80 hover:bg-black/40 hover:text-white",
              )}
              onClick={() => patchForm({ formColumnsDesktop: opt.id })}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-expanded={typeMenuOpen}
          aria-haspopup="listbox"
          aria-label="Veld toevoegen — kies type"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-sky-400 sm:w-auto"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setTypeMenuOpen((v) => !v);
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Veldtype toevoegen
        </button>
        {typeMenuOpen ? (
          <div
            role="listbox"
            aria-label="Kies veldtype"
            className="absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-white/15 bg-[#0d1017] shadow-2xl sm:left-auto sm:right-0"
          >
            <p className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300/80">
              Type kiezen
            </p>
            {CONTACT_FORM_CUSTOM_FIELD_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                role="option"
                className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-white/10"
                onClick={() => {
                  const next = [
                    ...persistableFields(fields),
                    createCustomFormField(type),
                  ];
                  patchForm({ fields: next });
                  setTypeMenuOpen(false);
                }}
              >
                <span className="text-sm font-semibold text-white/90">
                  {FORM_FIELD_TYPE_LABELS_NL[type]}
                </span>
                <span className="text-[11px] text-white/45">{type}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChromeBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md bg-white/10 text-white hover:bg-white/20",
        disabled && "opacity-35",
      )}
    >
      {children}
    </button>
  );
}
