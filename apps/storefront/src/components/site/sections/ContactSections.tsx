import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Phone, Mail, MapPin, Clock, ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import type {
  ContactInfoContent,
  ContactInfoIcon,
  ContactFormContent,
  FixedSectionKey,
  FormFieldItem,
} from "@mccoy/cms-schema";
import {
  cmsTextOrFallback,
  DEFAULT_CONTACT_FORM_INTRO_NL,
  formFieldPayloadKey,
  normalizeContactFormColumnsDesktop,
  normalizeContactFormTextPlacement,
  optionPayloadValue,
  orderContactFormFieldsForDisplay,
  resolveContactFormFields,
  resolveContactFormHighlights,
  seedDefaultContactFormFields,
} from "@mccoy/cms-schema";
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

function isFieldRequired(field: FormFieldItem): boolean {
  return field.required ?? (field.type === "name" || field.type === "email");
}

export function ContactFormSection() {
  const content = useTypedSectionContent("page_contact", "contact.form") as ContactFormContent;
  const { t } = useI18n();
  const clientReady = useClientReady();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eyebrow = cmsTextOrFallback(content.eyebrow, t.contact.kicker, "Contact");
  const heading = cmsTextOrFallback(content.heading, t.contact.title, "Laten we praten over uw pand.");
  const intro = cmsTextOrFallback(content.body, t.contact.sub, DEFAULT_CONTACT_FORM_INTRO_NL);
  // Only CMS-authored bullets — never inject hard-coded i18n trust lines.
  const highlights = resolveContactFormHighlights(content, []);
  const submitLabel = cmsTextOrFallback(content.submitLabel, t.contact.submit, "Verstuur aanvraag");
  const successMessage = cmsTextOrFallback(
    content.successMessage,
    t.contact.success,
    "Bedankt! We nemen zo snel mogelijk contact op.",
  );
  const successDetail = cmsTextOrFallback(
    content.successDetail,
    t.contact.receivedMessage,
    "We hebben uw bericht ontvangen en nemen zo snel mogelijk contact op.",
  );
  const consent = cmsTextOrFallback(
    content.consent,
    t.contact.consent,
    "Door te versturen stemt u in met verwerking van uw gegevens voor deze aanvraag.",
  );
  const fields = useMemo(() => {
    const custom =
      content.fields && content.fields.length > 0
        ? content.fields
        : seedDefaultContactFormFields({
            labels: content.labels,
            placeholders: content.placeholders,
          });
    return orderContactFormFieldsForDisplay(resolveContactFormFields(custom));
  }, [content.fields, content.labels, content.placeholders]);

  const textPlacement = normalizeContactFormTextPlacement(content.textPlacement);
  const formColumnsDesktop = normalizeContactFormColumnsDesktop(content.formColumnsDesktop);
  const twoCol = formColumnsDesktop === 2;
  const sideBySide = textPlacement === "left" || textPlacement === "right";
  const copyFirst = textPlacement === "top" || textPlacement === "left";

  const fieldLabel = (field: FormFieldItem) => {
    const key = formFieldPayloadKey(field);
    if (key === "name") return cmsTextOrFallback(content.labels?.name, t.contact.name, field.label);
    if (key === "company") {
      return cmsTextOrFallback(content.labels?.company, t.contact.company, field.label);
    }
    if (key === "phone") {
      return cmsTextOrFallback(content.labels?.phone, t.contact.phone, field.label);
    }
    if (key === "email") {
      return cmsTextOrFallback(content.labels?.email, t.contact.email, field.label);
    }
    if (key === "message") {
      return cmsTextOrFallback(content.labels?.message, t.contact.message, field.label);
    }
    return field.label;
  };

  const fieldPlaceholder = (field: FormFieldItem) => {
    if (field.placeholder?.trim()) return field.placeholder;
    const key = formFieldPayloadKey(field);
    if (key === "name") {
      return cmsTextOrFallback(content.placeholders?.name, t.contact.placeholderName, "Uw naam");
    }
    if (key === "company") {
      return cmsTextOrFallback(
        content.placeholders?.company,
        t.contact.placeholderCompany,
        "Optioneel",
      );
    }
    if (key === "phone") {
      return cmsTextOrFallback(content.placeholders?.phone, t.contact.placeholderPhone, "06 …");
    }
    if (key === "email") {
      return cmsTextOrFallback(
        content.placeholders?.email,
        t.contact.placeholderEmail,
        "naam@bedrijf.nl",
      );
    }
    if (key === "message") {
      return cmsTextOrFallback(
        content.placeholders?.message,
        t.contact.placeholderMessage,
        "Waar kunnen we u mee helpen?",
      );
    }
    return undefined;
  };

  const copyColumn = (
    <aside className={cn(sideBySide && "lg:col-span-5", textPlacement === "top" && "max-w-3xl")}>
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <h2 className="font-display mt-4 text-3xl leading-tight text-foreground md:text-4xl lg:text-[2.75rem]">
        {heading}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{intro}</p>
      {highlights.length > 0 ? (
        <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
          {highlights.map((text, index) => (
            <li key={`${index}-${text}`} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                {index === 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                )}
              </span>
              {text}
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );

  const formColumn = (
    <SectionSurface variant="form" className={cn(sideBySide && "lg:col-span-7")}>
      {sent ? (
        <div
          className="flex flex-col items-center gap-4 py-14 text-center"
          role="status"
          data-testid="site-form-success"
        >
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </div>
          <p className="font-display text-2xl text-foreground md:text-3xl">{successMessage}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{successDetail}</p>
        </div>
      ) : (
        <form
          data-testid={clientReady ? "site-form-ready" : "site-form-pending"}
          data-form-columns={formColumnsDesktop}
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
          className={cn("relative grid gap-5", twoCol && "sm:grid-cols-2")}
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
          {fields.map((field) => {
            const key = formFieldPayloadKey(field);
            const required = isFieldRequired(field);
            const spanFull = twoCol && (field.type === "textarea" || field.type === "select");
            const id = `contact-${field.id}`;
            const label = fieldLabel(field);
            const placeholder = fieldPlaceholder(field);
            return (
              <div key={field.id} className={spanFull ? "sm:col-span-2" : undefined}>
                <label
                  htmlFor={id}
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55"
                >
                  {label}
                  {required ? <span className="ml-1 text-primary">*</span> : null}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    id={id}
                    name={key}
                    rows={5}
                    required={required}
                    maxLength={1500}
                    placeholder={placeholder}
                    className="w-full resize-y rounded-2xl border border-white/12 bg-background/50 px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none transition hover:border-white/20 focus:border-primary/70 focus:bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                ) : field.type === "select" ? (
                  <select
                    id={id}
                    name={key}
                    required={required}
                    className="w-full rounded-2xl border border-white/12 bg-background/50 px-4 py-3.5 text-sm text-white outline-none transition hover:border-white/20 focus:border-primary/70 focus:bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                    defaultValue=""
                  >
                    <option value="">{required ? "Maak een keuze…" : "—"}</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.id} value={optionPayloadValue(option)}>
                        {option.label.trim() || optionPayloadValue(option)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={
                      field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"
                    }
                    name={key}
                    required={required}
                    autoComplete={
                      field.type === "email"
                        ? "email"
                        : field.type === "name"
                          ? "name"
                          : field.type === "phone"
                            ? "tel"
                            : field.type === "company"
                              ? "organization"
                              : undefined
                    }
                    placeholder={placeholder}
                    maxLength={255}
                    className="w-full rounded-2xl border border-white/12 bg-background/50 px-4 py-3.5 text-sm text-white placeholder:text-white/30 outline-none transition hover:border-white/20 focus:border-primary/70 focus:bg-background/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                )}
              </div>
            );
          })}
          {error ? (
            <p
              className={cn(
                "rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200",
                twoCol && "sm:col-span-2",
              )}
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div
            className={cn(
              "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
              twoCol && "sm:col-span-2",
            )}
          >
            <p className="text-xs leading-relaxed text-white/45">{consent}</p>
            <button
              type="submit"
              disabled={!clientReady || submitting}
              aria-disabled={!clientReady || submitting}
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:scale-[1.02] hover:shadow-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {submitting ? t.contact.submitting : submitLabel}
              {!submitting ? (
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              ) : null}
            </button>
          </div>
        </form>
      )}
    </SectionSurface>
  );

  return (
    <section
      className="relative isolate overflow-hidden px-0 pb-24 pt-10 sm:pb-28 sm:pt-14"
      data-cms-section="contact.form"
      data-text-placement={textPlacement}
    >
      <SectionAmbient />
      <div
        className={cn(
          "relative grid items-start gap-10",
          SECTION_PAGE_RAIL,
          sideBySide && "lg:grid-cols-12 lg:gap-14",
        )}
      >
        {copyFirst ? (
          <>
            {copyColumn}
            {formColumn}
          </>
        ) : (
          <>
            {formColumn}
            {copyColumn}
          </>
        )}
      </div>
    </section>
  );
}
