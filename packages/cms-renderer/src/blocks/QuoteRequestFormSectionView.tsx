/**
 * Multi-tab offerte form — exact parity with former OfferteFormSection fixed renderer.
 */
import * as React from "react";
import {
  formFieldPayloadKey,
  normalizeQuoteRequestForm,
  resolveContactFormFields,
  type BlockType,
  type FormFieldItem,
  type QuoteFormKind,
  type QuoteRequestFormBlockData,
  type QuoteRequestFormTab,
} from "@mccoy/cms-schema";
import { SectionEyebrow, SectionSurface } from "../sectionChromeUi";
import { SECTION_PAGE_RAIL } from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { cn } from "./blockViewShared";
import { FormFileUploadField } from "./FormFileUploadField";
import { WEBSITE_FORM_MEDIA_FILE_ACCEPT } from "../form-file-attachments";
import { useCmsFormAdapters, useCmsPageId } from "./form-adapters";

type ConversionRenderMode = "storefront" | "preview";

/** Mirrors storefront `useClientReady` so E2E can wait for hydrated submit controls. */
function useClientReady(): boolean {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}

function GlassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h16v2H4V4zm1 4h14l-1.5 12h-11L5 8zm3 3v6m4-6v6m4-6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SofaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11V8a3 3 0 013-3h10a3 3 0 013 3v3M3 13v4h2v-2h14v2h2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function iconForTab(tab: QuoteRequestFormTab): React.ComponentType<{ className?: string }> {
  if (tab.icon === "sofa" || tab.kind === "furniture_cleaning") return SofaIcon;
  return GlassIcon;
}

const QUOTE_FILE_INPUT_CLASS =
  "w-full rounded-2xl border border-dashed border-white/15 bg-background/40 px-4 py-3 text-sm text-white/75 file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground";

function FieldControl({
  field,
  value,
  onChange,
  idPrefix,
  files,
  onFilesChange,
  disabled = false,
}: {
  field: FormFieldItem;
  value: string;
  onChange: (v: string) => void;
  idPrefix: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const id = `${idPrefix}-${formFieldPayloadKey(field)}`;
  const key = formFieldPayloadKey(field);
  const label = (
    <label
      htmlFor={id}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
    >
      {field.label}
      {field.required ? <span className="ml-1 text-primary">*</span> : null}
    </label>
  );

  if (field.type === "textarea") {
    return (
      <div className="sm:col-span-2">
        {label}
        <textarea
          id={id}
          name={key}
          rows={4}
          maxLength={1000}
          required={field.required}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
        />
      </div>
    );
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    return (
      <div>
        {label}
        <select
          id={id}
          name={key}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white outline-none transition focus:border-primary"
        >
          {options.map((o) => (
            <option key={o.id} value={o.value ?? o.label} className="bg-background">
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "file") {
    return (
      <div className="sm:col-span-2">
        {label}
        <FormFileUploadField
          id={id}
          name={key}
          files={files}
          onFilesChange={onFilesChange}
          disabled={disabled}
          required={field.required}
          accept={WEBSITE_FORM_MEDIA_FILE_ACCEPT}
          inputClassName={QUOTE_FILE_INPUT_CLASS}
        />
        {field.placeholder ? (
          <p className="mt-1 text-[11px] text-white/45">{field.placeholder}</p>
        ) : null}
      </div>
    );
  }

  const inputType =
    field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";

  return (
    <div>
      {label}
      <input
        id={id}
        type={inputType}
        name={key}
        required={field.required}
        maxLength={255}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

function TabForm({
  tab,
  blockId,
  submitLabel,
  successMessage,
  mode,
}: {
  tab: QuoteRequestFormTab;
  blockId: string;
  submitLabel: string;
  successMessage: string;
  mode: ConversionRenderMode;
}) {
  const adapters = useCmsFormAdapters();
  const pageId = useCmsPageId();
  const fields = React.useMemo(
    () => resolveContactFormFields(tab.fields),
    [tab.fields],
  );
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [fileValues, setFileValues] = React.useState<Record<string, File[]>>({});
  const [honeypot, setHoneypot] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const clientReady = useClientReady();
  const Icon = iconForTab(tab);
  const preview = mode === "preview";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || !clientReady) return;
    setError(null);
    const payload: Record<string, string> = {};
    const files: File[] = [];
    for (const field of fields) {
      const key = formFieldPayloadKey(field);
      if (field.type === "file") {
        const selected = fileValues[key] ?? [];
        files.push(...selected);
        if (selected.length > 0) {
          payload[key] = selected.map((file) => file.name).join(", ");
        }
        continue;
      }
      payload[key] = (values[key] ?? "").trim();
    }
    if (!payload.name || !payload.email) {
      setError("Naam en e-mail zijn verplicht.");
      setStatus("error");
      return;
    }
    if (!adapters.submitQuoteForm || !pageId) {
      setError("Verzenden is tijdelijk niet beschikbaar.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    try {
      const result = await adapters.submitQuoteForm({
        blockId,
        pageId,
        kind: tab.kind,
        fields: payload,
        files,
        website: honeypot,
      });
      if (!result.ok) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setStatus("success");
      setValues({});
      setFileValues({});
    } catch (submitError) {
      setStatus("error");
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Verzenden is mislukt. Probeer het opnieuw.",
      );
    }
  };

  return (
    <div id={tab.id} className="grid items-start gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Icon className="h-5 w-5" />
        </div>
        <SectionEyebrow className="mt-6 tracking-[0.25em]">{tab.tag}</SectionEyebrow>
        <h2 className="font-display mt-3 text-4xl text-foreground md:text-5xl">{tab.title}</h2>
        <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">{tab.description}</p>
      </aside>

      <SectionSurface variant="form" className="lg:col-span-7">
        {status === "success" ? (
          <div
            className="flex flex-col items-center gap-3 py-12 text-center"
            role="status"
            data-testid="site-form-success"
          >
            <p className="font-display text-2xl text-white">
              {tab.successMessage?.trim() || successMessage}
            </p>
          </div>
        ) : (
          <form
            className="relative grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => void onSubmit(e)}
            noValidate
          >
            <div className="sr-only" aria-hidden="true">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>
            {fields.map((field) => {
              const key = formFieldPayloadKey(field);
              return (
                <FieldControl
                  key={field.id}
                  field={field}
                  idPrefix={`quote-${tab.id}`}
                  value={values[key] ?? ""}
                  onChange={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                  files={fileValues[key] ?? []}
                  onFilesChange={(next) =>
                    setFileValues((prev) => ({ ...prev, [key]: next }))
                  }
                  disabled={!clientReady || status === "loading" || preview}
                />
              );
            })}
            {error ? (
              <p
                className="sm:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!clientReady || status === "loading" || preview}
              aria-disabled={!clientReady || status === "loading" || preview}
              data-testid={clientReady ? "site-form-ready" : "site-form-pending"}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            >
              {status === "loading" ? "..." : tab.submitLabel?.trim() || submitLabel}
            </button>
          </form>
        )}
      </SectionSurface>
    </div>
  );
}

export function QuoteRequestFormSectionView({
  data,
  blockId,
  mode = "storefront",
}: {
  data: unknown;
  blockId: string;
  mode?: ConversionRenderMode;
}) {
  const type = "quoteRequestForm" as BlockType;
  const d = normalizeQuoteRequestForm(data) as QuoteRequestFormBlockData;
  const initial =
    d.defaultTabId && d.tabs.some((t) => t.id === d.defaultTabId)
      ? d.defaultTabId
      : d.tabs[0]?.id ?? "";
  const [tabId, setTabId] = React.useState(initial);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const h = window.location.hash.replace("#", "").toLowerCase();
      if (h === "furniture" || h === "tab_furniture") {
        const furniture = d.tabs.find((t) => t.kind === "furniture_cleaning");
        if (furniture) setTabId(furniture.id);
        return;
      }
      if (h === "window" || h === "glass" || h === "tab_glass") {
        const glass = d.tabs.find((t) => t.kind === "glass_washing");
        if (glass) setTabId(glass.id);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [d.tabs]);

  const active = d.tabs.find((t) => t.id === tabId) ?? d.tabs[0];
  if (!active) {
    return (
      <SectionShell blockType={type}>
        <p className="text-sm text-muted-foreground">Geen tabs geconfigureerd.</p>
      </SectionShell>
    );
  }

  return (
    <div data-cms-block-type={type}>
      {d.heading ? (
        <h2 className={cn(SECTION_PAGE_RAIL, "mt-16 font-display text-3xl text-foreground md:text-4xl")}>
          {d.heading}
        </h2>
      ) : null}
      {d.description ? (
        <p className={cn(SECTION_PAGE_RAIL, "mt-3 max-w-2xl text-muted-foreground")}>{d.description}</p>
      ) : null}

      <section className={cn(SECTION_PAGE_RAIL, "mt-20")}>
        <div className="grid gap-4 md:grid-cols-2">
          {d.tabs.map((tb) => {
            const Icon = iconForTab(tb);
            const selected = tb.id === active.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTabId(tb.id)}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border p-5 text-left transition",
                  selected
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-card/60 hover:border-primary/40",
                )}
              >
                <div className="relative flex items-start gap-4">
                  <div
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                      selected ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <SectionEyebrow className="text-[10px] tracking-[0.2em]">{tb.tag}</SectionEyebrow>
                    <p className="mt-1 truncate font-display text-lg text-foreground">{tb.title}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={cn(SECTION_PAGE_RAIL, "pb-28 pt-10")}>
        <TabForm
          key={active.id}
          tab={active}
          blockId={blockId}
          submitLabel={d.submitLabel}
          successMessage={d.successMessage}
          mode={mode}
        />
      </section>
    </div>
  );
}

export type { QuoteFormKind };
