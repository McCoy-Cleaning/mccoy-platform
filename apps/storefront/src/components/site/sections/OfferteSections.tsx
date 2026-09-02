import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  GlassWater,
  Sofa,
  Camera,
  X,
} from "lucide-react";
import {
  formFieldPayloadKey,
  normalizeQuoteRequestForm,
  resolveContactFormFields,
  createDefaultQuoteRequestForm,
  type ContactFormContent,
  type FormFieldItem,
  type QuoteRequestFormBlockData,
  type QuoteRequestFormTab,
} from "@mccoy/cms-schema";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { submitSiteForm } from "@/lib/forms/submit-client";
import { useClientReady } from "@/lib/use-client-ready";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import {
  SECTION_PAGE_RAIL,
  SectionEyebrow,
  SectionSurface,
  WEBSITE_FORM_MEDIA_FILE_ACCEPT,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";
import { WysiwygInlineText } from "../cms-editor/WysiwygInlineText";
import { WysiwygQuoteFormFieldChrome } from "../cms-editor/WysiwygQuoteFormField";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";

function iconForTab(tab: QuoteRequestFormTab) {
  if (tab.icon === "sofa" || tab.kind === "furniture_cleaning") return Sofa;
  return GlassWater;
}

function quoteFieldSpansFull(field: FormFieldItem): boolean {
  return field.type === "textarea" || field.type === "file";
}

export function OfferteFormSection() {
  const content = useTypedSectionContent("page_offerte", "offerte.form") as ContactFormContent;
  const { sendMutation } = useLiveEditApi();
  const quote = useMemo(
    () =>
      normalizeQuoteRequestForm(content.quote ?? createDefaultQuoteRequestForm()),
    [content.quote],
  );

  const initialTabId =
    quote.defaultTabId && quote.tabs.some((t) => t.id === quote.defaultTabId)
      ? quote.defaultTabId
      : quote.tabs[0]?.id ?? "";
  const [tabId, setTabId] = useState(initialTabId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const h = window.location.hash.replace("#", "").toLowerCase();
      if (h === "furniture" || h === "tab_furniture") {
        const furniture = quote.tabs.find((t) => t.kind === "furniture_cleaning");
        if (furniture) setTabId(furniture.id);
        return;
      }
      if (h === "window" || h === "glass" || h === "tab_glass") {
        const glass = quote.tabs.find((t) => t.kind === "glass_washing");
        if (glass) setTabId(glass.id);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [quote.tabs]);

  const active = quote.tabs.find((t) => t.id === tabId) ?? quote.tabs[0];
  const heading = content.heading?.trim() || quote.heading?.trim() || "";

  const patchQuote = (next: QuoteRequestFormBlockData, extra?: Partial<ContactFormContent>) => {
    sendMutation({
      kind: "section",
      sectionKey: "offerte.form",
      patch: { quote: next, heading: next.heading, ...extra },
    });
  };

  const updateTab = (index: number, patch: Partial<QuoteRequestFormTab>) => {
    const tabs = quote.tabs.map((t, i) => (i === index ? { ...t, ...patch } : t));
    patchQuote({ ...quote, tabs });
  };

  if (!active) {
    return (
      <div data-cms-section="offerte.form">
        <p className={cn(SECTION_PAGE_RAIL, "text-sm text-muted-foreground")}>
          Geen tabs geconfigureerd.
        </p>
      </div>
    );
  }

  return (
    <div data-cms-section="offerte.form">
      <h2 className={cn(SECTION_PAGE_RAIL, "mt-16 font-display text-3xl text-foreground md:text-4xl")}>
        <WysiwygInlineText
          as="span"
          label="Kop"
          value={heading}
          enFieldPath="section:offerte.form:heading"
          target={{
            kind: "custom",
            onCommit: (next) =>
              patchQuote({ ...quote, heading: next || undefined }, { heading: next || undefined }),
          }}
        />
      </h2>

      <section className={cn(SECTION_PAGE_RAIL, "mt-20")}>
        <div className="grid gap-4 md:grid-cols-2">
          {quote.tabs.map((tb, i) => {
            const Icon = iconForTab(tb);
            const selected = tb.id === active.id;
            return (
              <motion.button
                key={tb.id}
                type="button"
                onClick={() => setTabId(tb.id)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
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
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className={cn(SECTION_PAGE_RAIL, "pb-28 pt-10")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <TabForm
              tab={active}
              tabIndex={Math.max(
                0,
                quote.tabs.findIndex((t) => t.id === active.id),
              )}
              quote={quote}
              submitLabel={active.submitLabel?.trim() || quote.submitLabel}
              successMessage={active.successMessage?.trim() || quote.successMessage}
              onUpdateTab={updateTab}
              onPatchQuote={patchQuote}
            />
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function TabForm({
  tab,
  tabIndex,
  quote,
  submitLabel,
  successMessage,
  onUpdateTab,
  onPatchQuote,
}: {
  tab: QuoteRequestFormTab;
  tabIndex: number;
  quote: QuoteRequestFormBlockData;
  submitLabel: string;
  successMessage: string;
  onUpdateTab: (index: number, patch: Partial<QuoteRequestFormTab>) => void;
  onPatchQuote: (next: QuoteRequestFormBlockData, extra?: Partial<ContactFormContent>) => void;
}) {
  const Icon = iconForTab(tab);
  const fields = useMemo(() => resolveContactFormFields(tab.fields), [tab.fields]);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileValues, setFileValues] = useState<Record<string, File[]>>({});

  const extraFiles = useMemo(
    () => Object.values(fileValues).flat(),
    [fileValues],
  );

  return (
    <div id={tab.id} className="grid items-start gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Icon className="h-5 w-5" />
        </div>
        <SectionEyebrow className="mt-6 tracking-[0.25em]">
          <WysiwygInlineText
            as="span"
            label="Tab-tag"
            value={tab.tag}
            enFieldPath={`section:offerte.form:quote.tabs.${tabIndex}.tag`}
            target={{
              kind: "custom",
              onCommit: (next) => onUpdateTab(tabIndex, { tag: next || tab.tag }),
            }}
          />
        </SectionEyebrow>
        <h2 className="font-display mt-3 text-4xl text-foreground md:text-5xl">
          <WysiwygInlineText
            as="span"
            label="Tab-titel"
            value={tab.title}
            enFieldPath={`section:offerte.form:quote.tabs.${tabIndex}.title`}
            target={{
              kind: "custom",
              onCommit: (next) => onUpdateTab(tabIndex, { title: next || tab.title }),
            }}
          />
        </h2>
        <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
          <WysiwygInlineText
            as="span"
            multiline
            label="Tab-beschrijving"
            value={tab.description}
            enFieldPath={`section:offerte.form:quote.tabs.${tabIndex}.description`}
            target={{
              kind: "custom",
              onCommit: (next) => onUpdateTab(tabIndex, { description: next }),
            }}
          />
        </p>
      </aside>

      <SectionSurface variant="form" className="lg:col-span-7">
        {sent ? (
          <Success
            label={successMessage}
            onCommit={(next) =>
              onPatchQuote(
                { ...quote, successMessage: next || quote.successMessage },
                { successMessage: next || undefined },
              )
            }
          />
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              setSubmitting(true);
              setError(null);
              const result = await submitSiteForm({
                kind: tab.kind,
                pageId: "page_offerte",
                sourceId: FIXED_FORM_SOURCE_IDS.offerteForm,
                form: e.currentTarget,
                extraFiles,
              });
              setSubmitting(false);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setSent(true);
            }}
            className="relative grid gap-4 sm:grid-cols-2"
          >
            <Honeypot />
            {fields.map((field) => {
              const key = formFieldPayloadKey(field);
              const isTabField = tab.fields.some((f) => f.id === field.id);
              const spanClass = quoteFieldSpansFull(field) ? "sm:col-span-2" : undefined;
              const control = (
                <FieldControl
                  field={field}
                  idPrefix={`offerte-${tab.id}`}
                  files={fileValues[key] ?? []}
                  onFilesChange={(next) =>
                    setFileValues((prev) => ({ ...prev, [key]: next }))
                  }
                />
              );
              return (
                <div
                  key={field.id}
                  className={cn("relative", spanClass)}
                  data-cms-form-field-chrome=""
                >
                  {isTabField ? (
                    <WysiwygQuoteFormFieldChrome
                      field={field}
                      tab={tab}
                      tabIndex={tabIndex}
                      sectionKey="offerte.form"
                      quote={quote}
                    >
                      {control}
                    </WysiwygQuoteFormFieldChrome>
                  ) : (
                    control
                  )}
                </div>
              );
            })}
            {error ? <FormError message={error} /> : null}
            <Submit
              label={submitLabel}
              submitting={submitting}
              onCommit={(next) =>
                onPatchQuote(
                  { ...quote, submitLabel: next || quote.submitLabel },
                  { submitLabel: next || undefined },
                )
              }
            />
          </form>
        )}
      </SectionSurface>
    </div>
  );
}

function FieldControl({
  field,
  idPrefix,
  files,
  onFilesChange,
}: {
  field: FormFieldItem;
  idPrefix: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
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
      <div>
        {label}
        <textarea
          id={id}
          name={key}
          rows={4}
          maxLength={1000}
          required={field.required}
          placeholder={field.placeholder}
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
      <PhotoUpload
        id={id}
        label={field.label}
        help={field.placeholder}
        required={field.required}
        files={files}
        onFilesChange={onFilesChange}
      />
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
        required={field.required ?? (field.type === "name" || field.type === "email")}
        maxLength={255}
        placeholder={field.placeholder}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

function Submit({
  label,
  submitting,
  onCommit,
}: {
  label: string;
  submitting?: boolean;
  onCommit: (next: string) => void;
}) {
  const clientReady = useClientReady();
  return (
    <button
      type="submit"
      disabled={!clientReady || submitting}
      aria-disabled={!clientReady || submitting}
      data-testid={clientReady ? "site-form-ready" : "site-form-pending"}
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
    >
      {submitting ? (
        "..."
      ) : (
        <>
          <WysiwygInlineText
            as="span"
            label="Knoptekst"
            value={label}
            enFieldPath="section:offerte.form:submitLabel"
            target={{
              kind: "custom",
              onCommit,
            }}
          />
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p
      className="sm:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      role="alert"
    >
      {message}
    </p>
  );
}

function Honeypot() {
  return (
    <input
      type="text"
      name="website"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute -left-[9999px] h-0 w-0 opacity-0"
    />
  );
}

function Success({
  label,
  onCommit,
}: {
  label: string;
  onCommit: (next: string) => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-12 text-center"
      role="status"
      data-testid="site-form-success"
    >
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <p className="font-display text-2xl text-white">
        <WysiwygInlineText
          as="span"
          label="Succesbericht"
          value={label}
          enFieldPath="section:offerte.form:successMessage"
          target={{
            kind: "custom",
            onCommit,
          }}
        />
      </p>
    </div>
  );
}

function PhotoUpload({
  id,
  label,
  help,
  required,
  files,
  onFilesChange,
}: {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).slice(0, 8 - files.length);
    onFilesChange([...files, ...incoming].slice(0, 8));
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
      >
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </label>
      <label className="group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-background/40 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-primary/5">
        <Camera className="h-6 w-6 text-primary" />
        <span className="text-sm text-white/75">
          {files.length > 0 ? `${files.length} bestand(en) geselecteerd` : "Klik om foto's toe te voegen"}
        </span>
        {help ? <span className="text-[11px] text-white/45">{help}</span> : null}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={WEBSITE_FORM_MEDIA_FILE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="relative overflow-hidden rounded-xl border border-white/10 bg-background/40"
            >
              {previews[i] ? (
                <img src={previews[i]} alt={f.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 items-center justify-center text-[11px] text-white/60">
                  {f.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => onFilesChange(files.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-white/80 hover:bg-background"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
