import { useState } from "react";
import { motion } from "motion/react";
import { Phone, Mail, MapPin, Clock, ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import type {
  ContactInfoContent,
  ContactInfoIcon,
  ContactFormContent,
  FixedSectionKey,
} from "@mccoy/cms-schema";
import { cmsTextOrFallback } from "@mccoy/cms-schema";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedContactInfoContent } from "@/lib/cms-i18n";
import { useI18n } from "@/lib/i18n";
import { submitSiteForm } from "@/lib/forms/submit-client";
import { useClientReady } from "@/lib/use-client-ready";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import {
  SECTION_PAGE_RAIL,
  SectionAmbient,
  SectionEyebrow,
  SectionSurface,
} from "@mccoy/cms-renderer";
import { cn } from "@/lib/utils";

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
  const { t } = useI18n();
  const raw = useTypedSectionContent(pageId, sectionKey) as ContactInfoContent;
  const content = localizedContactInfoContent(sectionKey, raw, t);

  return (
    <section
      className={cn(
        SECTION_PAGE_RAIL,
        "mt-10 mb-6 grid gap-4 sm:mt-14 sm:mb-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4",
      )}
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
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </div>
              <div className="mt-1 whitespace-pre-line text-sm text-foreground">{c.value}</div>
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
              <a href={c.href} className="block h-full transition hover:opacity-95">
                <SectionSurface
                  variant="outlined"
                  className="flex h-full items-start gap-4 p-5 hover:border-primary/40"
                >
                  {Inner}
                </SectionSurface>
              </a>
            ) : (
              <SectionSurface variant="outlined" className="flex h-full items-start gap-4 p-5">
                {Inner}
              </SectionSurface>
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
  const intro = cmsTextOrFallback(content.body, t.contact.sub);

  return (
    <section
      className="relative isolate overflow-hidden px-0 pb-24 pt-10 sm:pb-28 sm:pt-14"
      data-cms-section="contact.form"
    >
      <SectionAmbient />
      <div
        className={cn(
          "relative grid items-start gap-10",
          SECTION_PAGE_RAIL,
          "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-14",
        )}
      >
        <div className="max-w-xl">
          <SectionEyebrow>{t.contact.kicker}</SectionEyebrow>
          <h2 className="font-display mt-4 text-3xl leading-tight text-foreground md:text-4xl lg:text-[2.75rem]">
            {heading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{intro}</p>
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              </span>
              {t.contact.responseWithin}
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                <Mail className="h-3.5 w-3.5" aria-hidden />
              </span>
              {t.contact.requestsInPortal}
            </li>
          </ul>
        </div>

        <SectionSurface variant="form">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </div>
              <p className="font-display text-2xl text-foreground md:text-3xl">{t.contact.success}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t.contact.receivedMessage}
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
              <Field
                label={t.contact.name}
                name="name"
                required
                autoComplete="name"
                placeholder={t.contact.placeholderName}
              />
              <Field
                label={t.contact.company}
                name="company"
                autoComplete="organization"
                placeholder={t.contact.placeholderCompany}
              />
              <Field
                label={t.contact.phone}
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder={t.contact.placeholderPhone}
              />
              <Field
                label={t.contact.email}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t.contact.placeholderEmail}
              />
              <TextArea
                label={t.contact.message}
                name="message"
                placeholder={t.contact.placeholderMessage}
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
                  {t.contact.consent}
                </p>
                <button
                  type="submit"
                  disabled={!clientReady || submitting}
                  aria-disabled={!clientReady || submitting}
                  className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-[1.02] hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {submitting ? t.contact.submitting : t.contact.submit}
                  {!submitting ? (
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  ) : null}
                </button>
              </div>
            </form>
          )}
        </SectionSurface>
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
