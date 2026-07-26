import { useState } from "react";
import { motion } from "motion/react";
import { Phone, Mail, MapPin, Clock, ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import type {
  ContactInfoContent,
  ContactInfoIcon,
  ContactFormContent,
  FixedSectionKey,
} from "@mccoy/cms-schema";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { useI18n } from "@/lib/i18n";
import { submitSiteForm } from "@/lib/forms/submit-client";
import { useClientReady } from "@/lib/use-client-ready";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";

const INFO_ICONS: Record<ContactInfoIcon, LucideIcon> = {
  mail: Mail,
  phone: Phone,
  map: MapPin,
  clock: Clock,
};

function InfoCardsSection({
  pageId,
  sectionKey,
}: {
  pageId: string;
  sectionKey: Extract<FixedSectionKey, "contact.info" | "offerte.info">;
}) {
  const content = useTypedSectionContent(pageId, sectionKey) as ContactInfoContent;

  return (
    <section
      className="mx-auto mt-16 grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8"
      data-cms-section={sectionKey}
    >
      {content.items.map((c, i) => {
        const Icon = INFO_ICONS[c.icon] ?? Mail;
        const Inner = (
          <>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/50">{c.label}</div>
              <div className="mt-1 whitespace-pre-line text-sm text-white">{c.value}</div>
            </div>
          </>
        );
        return (
          <motion.div
            key={c.id}
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
  );
}

export function ContactInfoSection() {
  return <InfoCardsSection pageId="page_contact" sectionKey="contact.info" />;
}

export function OfferteInfoSection() {
  return <InfoCardsSection pageId="page_offerte" sectionKey="offerte.info" />;
}

export function ContactFormSection() {
  const content = useTypedSectionContent("page_contact", "contact.form") as ContactFormContent;
  const { t } = useI18n();
  const clientReady = useClientReady();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = content.heading?.trim() || t.contact.title;

  return (
    <section
      className="relative mx-auto max-w-7xl px-4 pb-28 pt-16 sm:px-6 lg:px-8"
      data-cms-section="contact.form"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-8 h-64 bg-gradient-to-b from-primary/10 via-primary/[0.04] to-transparent blur-2xl"
        aria-hidden
      />

      <div className="relative grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-14">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {t.contact.kicker}
          </p>
          <h2 className="font-display mt-4 text-3xl leading-tight text-white md:text-4xl lg:text-[2.75rem]">
            {heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/65 md:text-lg">{t.contact.sub}</p>
          <ul className="mt-8 space-y-3 text-sm text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              </span>
              Persoonlijk antwoord binnen één werkdag
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Mail className="h-3.5 w-3.5" aria-hidden />
              </span>
              Aanvragen verschijnen in het admin-portaal
            </li>
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-card/90 via-card/70 to-card/40 p-6 shadow-[0_40px_120px_-48px_rgba(63,182,242,0.35)] backdrop-blur-xl sm:p-8 md:p-10">
          <div
            className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />

          {sent ? (
            <div className="relative flex flex-col items-center gap-4 py-14 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </div>
              <p className="font-display text-2xl text-white md:text-3xl">{t.contact.success}</p>
              <p className="max-w-sm text-sm text-white/55">
                We hebben uw bericht ontvangen en nemen zo snel mogelijk contact op.
              </p>
            </div>
          ) : (
            <form
              data-testid={clientReady ? "site-form-ready" : "site-form-pending"}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!clientReady || submitting) return;
                setSubmitting(true);
                setError(null);
                const result = await submitSiteForm({
                  kind: "inquiry",
                  pageId: "page_contact",
                  sourceId: FIXED_FORM_SOURCE_IDS.contactForm,
                  form: e.currentTarget,
                });
                setSubmitting(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSent(true);
              }}
              className="relative grid gap-5 sm:grid-cols-2"
              noValidate
            >
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <Field label={t.contact.name} name="name" required autoComplete="name" placeholder="Uw naam" />
              <Field
                label={t.contact.company}
                name="company"
                autoComplete="organization"
                placeholder="Optioneel"
              />
              <Field
                label={t.contact.phone}
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="06 …"
              />
              <Field
                label={t.contact.email}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="naam@bedrijf.nl"
              />
              <TextArea
                label={t.contact.message}
                name="message"
                placeholder="Waar kunnen we u mee helpen?"
              />
              {error ? (
                <p
                  className="sm:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <div className="sm:col-span-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-white/45">
                  Door te versturen stemt u in met verwerking van uw gegevens voor deze aanvraag.
                </p>
                <button
                  type="submit"
                  disabled={!clientReady || submitting}
                  aria-disabled={!clientReady || submitting}
                  className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-[1.02] hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {submitting ? "Bezig…" : t.contact.submit}
                  {!submitting ? (
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  ) : null}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = `contact-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55"
      >
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={255}
        className="w-full rounded-2xl border border-white/12 bg-background/50 px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none transition hover:border-white/20 focus:border-primary/70 focus:bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  const id = `contact-${name}`;
  return (
    <div className="sm:col-span-2">
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55"
      >
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={5}
        maxLength={1500}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-white/12 bg-background/50 px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none transition hover:border-white/20 focus:border-primary/70 focus:bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </div>
  );
}
