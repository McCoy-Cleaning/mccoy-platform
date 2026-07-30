import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  GlassWater,
  Sofa,
  Camera,
  X,
} from "lucide-react";
import type { ContactFormContent } from "@mccoy/cms-schema";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { useI18n } from "@/lib/i18n";
import { submitSiteForm } from "@/lib/forms/submit-client";
import { useClientReady } from "@/lib/use-client-ready";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import {
  SECTION_PAGE_RAIL,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

export function OfferteFormSection() {
  const content = useTypedSectionContent("page_offerte", "offerte.form") as ContactFormContent;
  const { t } = useI18n();
  const [tab, setTab] = useState<"window" | "furniture">("window");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const h = window.location.hash.replace("#", "").toLowerCase();
      if (h === "furniture") setTab("furniture");
      else setTab("window");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const tabs = [
    {
      id: "window" as const,
      icon: GlassWater,
      tag: t.contact.sections.window.tag,
      title: t.contact.sections.window.title,
    },
    {
      id: "furniture" as const,
      icon: Sofa,
      tag: t.contact.sections.furniture.tag,
      title: t.contact.sections.furniture.title,
    },
  ];

  return (
    <div data-cms-section="offerte.form">
      {content.heading ? (
        <h2 className={cn(SECTION_PAGE_RAIL, "mt-16 font-display text-3xl text-foreground md:text-4xl")}>
          {content.heading}
        </h2>
      ) : null}

      <section className={cn(SECTION_PAGE_RAIL, "mt-20")}>
        <div className="grid gap-4 md:grid-cols-2">
          {tabs.map((tb, i) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <motion.button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border p-5 text-left transition",
                  active
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-card/60 hover:border-primary/40",
                )}
              >
                <div className="relative flex items-start gap-4">
                  <div
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                      active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
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
            key={tab}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "window" ? <WindowForm /> : <FurnitureForm />}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function FormShell({
  id,
  tag,
  title,
  desc,
  icon: Icon,
  children,
}: {
  id: string;
  tag: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="grid items-start gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Icon className="h-5 w-5" />
        </div>
        <SectionEyebrow className="mt-6 tracking-[0.25em]">{tag}</SectionEyebrow>
        <h2 className="font-display mt-3 text-4xl text-foreground md:text-5xl">{title}</h2>
        <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">{desc}</p>
      </aside>

      <SectionSurface variant="form" className="lg:col-span-7">
        {children}
      </SectionSurface>
    </div>
  );
}

function WindowForm() {
  const { t } = useI18n();
  const s = t.contact.sections.window;
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  return (
    <FormShell id="window" tag={s.tag} title={s.title} desc={s.desc} icon={GlassWater}>
      {sent ? (
        <Success label={t.contact.success} />
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            setError(null);
            const result = await submitSiteForm({
              kind: "glass_washing",
              pageId: "page_offerte",
              sourceId: FIXED_FORM_SOURCE_IDS.offerteForm,
              form: e.currentTarget,
              extraFiles: photoFiles,
            });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSent(true);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Honeypot />
          <Field label={t.contact.name} name="name" required />
          <Field label={t.contact.email} name="email" type="email" required />
          <Field label={t.contact.phone} name="phone" type="tel" />
          <Field label={t.contact.company} name="company" />
          <Field label={s.floors} name="floors" type="number" />
          <Field label={s.windows} name="windows" type="number" />
          <Field label={s.height} name="height" type="number" />
          <Select label={s.access} name="access" options={s.accessOptions} />
          <Select label={s.sides} name="sides" options={s.sidesOptions} />
          <Select label={s.frequency} name="frequency" options={s.frequencyOptions} />
          <PhotoUpload
            label={t.contact.photosLabel}
            help={t.contact.photosHelp}
            files={photoFiles}
            onFilesChange={setPhotoFiles}
          />
          <TextArea label={t.contact.message} name="message" />
          {error ? <FormError message={error} /> : null}
          <Submit label={t.contact.submit} submitting={submitting} />
        </form>
      )}
    </FormShell>
  );
}

function FurnitureForm() {
  const { t } = useI18n();
  const s = t.contact.sections.furniture;
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);

  return (
    <FormShell id="furniture" tag={s.tag} title={s.title} desc={s.desc} icon={Sofa}>
      {sent ? (
        <Success label={t.contact.success} />
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            setError(null);
            const result = await submitSiteForm({
              kind: "furniture_cleaning",
              pageId: "page_offerte",
              sourceId: FIXED_FORM_SOURCE_IDS.offerteForm,
              form: e.currentTarget,
              extraFiles: photoFiles,
            });
            setSubmitting(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setSent(true);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Honeypot />
          <Field label={t.contact.name} name="name" required />
          <Field label={t.contact.email} name="email" type="email" required />
          <Field label={t.contact.phone} name="phone" type="tel" />
          <Field label={t.contact.company} name="company" />
          <Select label={s.itemType} name="item" options={s.itemOptions} />
          <Field label={s.pieces} name="pieces" type="number" />
          <Field label={s.material} name="material" />
          <Field label={s.area} name="area" type="number" />
          <PhotoUpload
            label={t.contact.photosLabel}
            help={t.contact.photosHelp}
            files={photoFiles}
            onFilesChange={setPhotoFiles}
          />
          <TextArea label={s.stains} name="stains" />
          {error ? <FormError message={error} /> : null}
          <Submit label={t.contact.submit} submitting={submitting} />
        </form>
      )}
    </FormShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  const id = `offerte-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
      >
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        maxLength={255}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: readonly string[];
}) {
  const id = `offerte-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
      >
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white outline-none transition focus:border-primary"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-background">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  const id = `offerte-${name}`;
  return (
    <div className="sm:col-span-2">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={4}
        maxLength={1000}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

function Submit({ label, submitting }: { label: string; submitting?: boolean }) {
  const clientReady = useClientReady();
  return (
    <button
      type="submit"
      disabled={!clientReady || submitting}
      aria-disabled={!clientReady || submitting}
      data-testid={clientReady ? "site-form-ready" : "site-form-pending"}
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
    >
      {submitting ? "..." : label}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
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

function Success({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <p className="font-display text-2xl text-white">{label}</p>
    </div>
  );
}

function PhotoUpload({
  label,
  help,
  files,
  onFilesChange,
}: {
  label: string;
  help: string;
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
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <label className="group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-background/40 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-primary/5">
        <Camera className="h-6 w-6 text-primary" />
        <span className="text-sm text-white/75">
          {files.length > 0 ? `${files.length} bestand(en) geselecteerd` : "Klik om foto's toe te voegen"}
        </span>
        <span className="text-[11px] text-white/45">{help}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
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
