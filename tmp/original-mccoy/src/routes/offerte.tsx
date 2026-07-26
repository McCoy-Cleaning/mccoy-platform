import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  GlassWater,
  Sofa,
  Camera,
  X,
} from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/offerte")({
  head: () => ({
    meta: [
      { title: "Contact & Offerte — Schoonmaak Twente | McCoy Cleaning" },
      {
        name: "description",
        content:
          "Offerte aanvragen voor kantoorschoonmaak, glasbewassing, vloer- en meubelonderhoud in Twente. Persoonlijk antwoord binnen één werkdag — McCoy Cleaning Oldenzaal.",
      },
      { property: "og:title", content: "Contact & Offerte — McCoy Cleaning Twente" },
      {
        property: "og:description",
        content: "Vraag direct een offerte aan voor professionele schoonmaak in Twente.",
      },
      { property: "og:url", content: "/offerte" },
    ],
    links: [{ rel: "canonical", href: "/offerte" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"window" | "furniture">("window");

  // Sync the active tab to the URL hash so /offerte#furniture and /offerte#window preselect.
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
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      <main className="pt-32">
        {/* hero */}
        <section className="relative px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-primary"
            >
              {t.contact.kicker}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.7 }}
              className="font-display mt-4 max-w-3xl text-5xl text-white md:text-7xl"
            >
              {t.contact.title}
            </motion.h1>
            <p className="mt-5 max-w-2xl font-bold text-white/65">{t.contact.sub}</p>
          </div>
        </section>

        {/* contact strip */}
        <section className="mx-auto mt-16 grid max-w-7xl gap-4 px-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {[
            { icon: Mail, label: "E-mail", value: "info@mccoy.nl", href: "mailto:info@mccoy.nl" },
            {
              icon: Phone,
              label: t.contact.phone,
              value: "0541 534 982",
              href: "tel:+31541534982",
            },
            { icon: MapPin, label: t.contact.address, value: t.contact.addressValue },
            { icon: Clock, label: t.contact.hours, value: t.contact.hoursValue },
          ].map((c, i) => {
            const Icon = c.icon;
            const Inner = (
              <>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/50">
                    {c.label}
                  </div>
                  <div className="mt-1 whitespace-pre-line text-sm text-white">{c.value}</div>
                </div>
              </>
            );
            return (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                {c.href ? (
                  <a
                    href={c.href}
                    className="flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-card/60 p-5 transition hover:border-primary/40"
                  >
                    {Inner}
                  </a>
                ) : (
                  <div className="flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-card/60 p-5">
                    {Inner}
                  </div>
                )}
              </motion.div>
            );
          })}
        </section>

        {/* tabs */}
        <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            {tabs.map((tb, i) => {
              const Icon = tb.icon;
              const active = tab === tb.id;
              return (
                <motion.button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  whileHover={{ y: -3 }}
                  className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition ${
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/10 bg-card/60 hover:border-primary/40"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="contact-tab-glow"
                      className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl"
                      transition={{ type: "spring", stiffness: 220, damping: 30 }}
                    />
                  )}
                  <div className="relative flex items-start gap-4">
                    <div
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                        active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                        {tb.tag}
                      </p>
                      <p className="mt-1 truncate font-display text-lg text-white">{tb.title}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* active form */}
        <section className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "window" && <WindowForm />}
              {tab === "furniture" && <FurnitureForm />}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ============ Shared shell ============ */
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
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-primary">{tag}</p>
        <h2 className="font-display mt-3 text-4xl text-white md:text-5xl">{title}</h2>
        <p className="mt-5 max-w-md leading-relaxed text-white/65">{desc}</p>
      </aside>

      <div className="rounded-[2rem] border border-white/10 bg-card/60 p-7 lg:col-span-7 md:p-9">
        {children}
      </div>
    </div>
  );
}

/* ============ Section: Window cleaning ============ */
function WindowForm() {
  const { t } = useI18n();
  const s = t.contact.sections.window;
  const [sent, setSent] = useState(false);
  return (
    <FormShell id="window" tag={s.tag} title={s.title} desc={s.desc} icon={GlassWater}>
      {sent ? (
        <Success label={t.contact.success} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
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
            name="photos"
          />
          <TextArea label={t.contact.message} name="message" />
          <Submit label={t.contact.submit} />
        </form>
      )}
    </FormShell>
  );
}

/* ============ Section 3: Furniture & floor ============ */
function FurnitureForm() {
  const { t } = useI18n();
  const s = t.contact.sections.furniture;
  const [sent, setSent] = useState(false);
  return (
    <FormShell id="furniture" tag={s.tag} title={s.title} desc={s.desc} icon={Sofa}>
      {sent ? (
        <Success label={t.contact.success} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
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
            name="photos"
          />
          <TextArea label={s.stains} name="stains" />
          <Submit label={t.contact.submit} />
        </form>
      )}
    </FormShell>
  );
}

/* ============ primitives ============ */
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
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <input
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
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <select
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
  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <textarea
        name={name}
        rows={4}
        maxLength={1000}
        className="w-full rounded-2xl border border-white/10 bg-background/40 px-4 py-3 text-white placeholder-white/30 outline-none transition focus:border-primary"
      />
    </div>
  );
}

function Submit({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.02] sm:col-span-2"
    >
      {label}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </button>
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

function PhotoUpload({ label, help, name }: { label: string; help: string; name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) =>
      f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
    );
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).slice(0, 8 - files.length);
    setFiles((prev) => [...prev, ...incoming].slice(0, 8));
  }

  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60">
        {label}
      </label>
      <label
        className="group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-background/40 px-4 py-6 text-center transition hover:border-primary/60 hover:bg-primary/5"
      >
        <Camera className="h-6 w-6 text-primary" />
        <span className="text-sm text-white/75">
          {files.length > 0 ? `${files.length} bestand(en) geselecteerd` : "Klik om foto's toe te voegen"}
        </span>
        <span className="text-[11px] text-white/45">{help}</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>
      {files.length > 0 && (
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
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-white/80 hover:bg-background"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
