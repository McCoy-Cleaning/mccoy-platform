import * as React from "react";
import {
  type ContactFormBlockData,
  DEFAULT_CONTACT_FORM_INTRO_NL,
  formFieldPayloadKey,
  optionPayloadValue,
  resolveContactFormFields,
  type FormFieldItem,
  type NewsletterBlockData,
  type PopupBlockData,
  resolveCmsLinkHref,
  linkRel,
  linkTarget,
  type CmsButton,
} from "@mccoy/cms-schema";
import { SectionShell } from "../SectionShell";
import { SectionEyebrow, SectionHeader, SectionSurface } from "../sectionChromeUi";
import { useCmsFormAdapters, useCmsPageId } from "./form-adapters";
import { CmsButtonView } from "./CmsButtonView";
import type { LinkResolverPages } from "./CmsImageView";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type ConversionRenderMode = "preview" | "storefront";

const CONTACT_FORM_SUCCESS_NL = "Bedankt voor uw bericht.";

const FIELD_INPUT_CLASS =
  "w-full rounded-2xl border border-border bg-background/60 px-4 py-3.5 text-sm text-foreground outline-none transition hover:border-primary/40 focus:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60";

const FIELD_LABEL_CLASS =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground";

function isFieldRequired(field: FormFieldItem): boolean {
  return field.required ?? (field.type === "name" || field.type === "email");
}

export function NewsletterSectionView({
  data,
  blockId,
  mode = "storefront",
}: {
  data: unknown;
  blockId: string;
  mode?: ConversionRenderMode;
}) {
  const d = data as NewsletterBlockData;
  const adapters = useCmsFormAdapters();
  const pageId = useCmsPageId();
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [honeypot, setHoneypot] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const preview = mode === "preview";
  const requiresConsent = Boolean(d.consent?.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setError(null);
    if (!email.trim()) {
      setError("Vul een e-mailadres in.");
      setStatus("error");
      return;
    }
    if (requiresConsent && !consent) {
      setError("Bevestig de privacyverklaring om je aan te melden.");
      setStatus("error");
      return;
    }
    if (!adapters.submitNewsletter) {
      setError("Aanmelden is tijdelijk niet beschikbaar.");
      setStatus("error");
      return;
    }
    if (!pageId) {
      setError("Verzenden is tijdelijk niet beschikbaar.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    const result = await adapters.submitNewsletter({
      blockId,
      pageId,
      email: email.trim(),
      consentAccepted: requiresConsent ? consent : true,
      website: honeypot,
    });
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("success");
    setEmail("");
    setConsent(false);
  };

  return (
    <SectionShell blockType="newsletter">
      <SectionHeader title={d.title} body={d.body || undefined} className="mb-6 sm:mb-8" />
      {status === "success" ? (
        <p className="text-sm text-emerald-300" role="status">
          Bedankt — je aanmelding is ontvangen.
        </p>
      ) : (
        <form className="max-w-lg space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
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
          <div>
            <label htmlFor={`newsletter-email-${blockId}`} className="text-xs font-medium text-muted-foreground">
              E-mail
            </label>
            <input
              id={`newsletter-email-${blockId}`}
              type="email"
              name="email"
              required
              autoComplete="email"
              disabled={preview || status === "loading"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          {requiresConsent ? (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                disabled={preview || status === "loading"}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>{d.consent}</span>
            </label>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={preview || status === "loading"}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {status === "loading" ? "Bezig…" : d.buttonLabel || "Aanmelden"}
          </button>
          {preview ? (
            <p className="text-xs text-muted-foreground">Preview — verzenden is uitgeschakeld.</p>
          ) : null}
        </form>
      )}
    </SectionShell>
  );
}

function ContactFormFieldInput({
  field,
  blockId,
  value,
  onChange,
  disabled,
}: {
  field: FormFieldItem;
  blockId: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  const fieldId = `cf-${blockId}-${field.id}`;
  const key = formFieldPayloadKey(field);
  const required = isFieldRequired(field);

  if (field.type === "textarea") {
    return (
      <textarea
        id={fieldId}
        name={key}
        rows={5}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${FIELD_INPUT_CLASS} resize-y`}
      />
    );
  }

  if (field.type === "select") {
    const options = field.options ?? [];
    return (
      <select
        id={fieldId}
        name={key}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT_CLASS}
      >
        <option value="">{required ? "Maak een keuze…" : "—"}</option>
        {options.map((option) => (
          <option key={option.id} value={optionPayloadValue(option)}>
            {option.label.trim() || optionPayloadValue(option)}
          </option>
        ))}
      </select>
    );
  }

  const inputType =
    field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  const autoComplete =
    field.type === "email"
      ? "email"
      : field.type === "name"
        ? "name"
        : field.type === "phone"
          ? "tel"
          : field.type === "company"
            ? "organization"
            : undefined;

  return (
    <input
      id={fieldId}
      type={inputType}
      name={key}
      required={required}
      autoComplete={autoComplete}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={FIELD_INPUT_CLASS}
    />
  );
}

export function ContactFormSectionView({
  data,
  blockId,
  mode = "storefront",
}: {
  data: unknown;
  blockId: string;
  mode?: ConversionRenderMode;
}) {
  const d = data as ContactFormBlockData;
  const adapters = useCmsFormAdapters();
  const pageId = useCmsPageId();
  const fields = React.useMemo(() => resolveContactFormFields(d.fields), [d.fields]);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const preview = mode === "preview";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setError(null);
    const payload: Record<string, string> = {};
    for (const field of fields) {
      const key = formFieldPayloadKey(field);
      payload[key] = (values[key] ?? "").trim();
    }
    if (!payload.name || !payload.email) {
      setError("Naam en e-mail zijn verplicht.");
      setStatus("error");
      return;
    }
    if (!adapters.submitContactForm) {
      setError("Verzenden is tijdelijk niet beschikbaar.");
      setStatus("error");
      return;
    }
    if (!pageId) {
      setError("Verzenden is tijdelijk niet beschikbaar.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    const result = await adapters.submitContactForm({
      blockId,
      pageId,
      fields: payload,
      website: honeypot,
    });
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("success");
    setValues({});
  };

  return (
    <SectionShell blockType="contactForm">
      <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div>
          <SectionEyebrow>Contact</SectionEyebrow>
          <h2 className="font-display mt-3 text-3xl text-foreground md:text-4xl">{d.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            {d.body?.trim() || DEFAULT_CONTACT_FORM_INTRO_NL}
          </p>
        </div>

        <SectionSurface variant="form">
          {status === "success" ? (
            <div className="py-10 text-center" role="status">
              <p className="font-display text-2xl text-foreground">{CONTACT_FORM_SUCCESS_NL}</p>
              <p className="mt-2 text-sm text-muted-foreground">We nemen zo snel mogelijk contact op.</p>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(e) => void onSubmit(e)} noValidate>
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
                const required = isFieldRequired(field);
                return (
                  <div key={field.id}>
                    <label htmlFor={`cf-${blockId}-${field.id}`} className={FIELD_LABEL_CLASS}>
                      {field.label}
                      {required ? <span className="ml-1 text-primary">*</span> : null}
                    </label>
                    <ContactFormFieldInput
                      field={field}
                      blockId={blockId}
                      value={values[key] ?? ""}
                      onChange={(next) => setValues((current) => ({ ...current, [key]: next }))}
                      disabled={preview || status === "loading"}
                    />
                  </div>
                );
              })}
              {error ? (
                <p
                  className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={preview || status === "loading"}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60 sm:w-auto"
              >
                {status === "loading" ? "Bezig…" : "Versturen"}
              </button>
              {preview ? (
                <p className="text-xs text-muted-foreground">Preview — verzenden is uitgeschakeld.</p>
              ) : null}
            </form>
          )}
        </SectionSurface>
      </div>
    </SectionShell>
  );
}

const POPUP_STORAGE_PREFIX = "mccoy:cms-popup-dismissed:";

function popupStorageKey(blockId: string) {
  return `${POPUP_STORAGE_PREFIX}${blockId}`;
}

export function PopupSectionView({
  data,
  blockId,
  mode = "storefront",
  pages = [],
}: {
  data: unknown;
  blockId: string;
  mode?: ConversionRenderMode;
  pages?: LinkResolverPages;
}) {
  const d = data as PopupBlockData;
  const preview = mode === "preview";
  const [open, setOpen] = React.useState(preview);

  React.useEffect(() => {
    if (preview) {
      setOpen(true);
      return;
    }
    try {
      if (typeof window === "undefined") return;
      const dismissed = window.sessionStorage.getItem(popupStorageKey(blockId));
      if (dismissed === "1") {
        setOpen(false);
        return;
      }
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [blockId, preview]);

  const dismiss = () => {
    setOpen(false);
    if (preview) return;
    try {
      window.sessionStorage.setItem(popupStorageKey(blockId), "1");
    } catch {
      /* ignore quota / private mode */
    }
  };

  if (!open) return null;

  const cta = d.cta as CmsButton | undefined;
  const href = cta?.link ? resolveCmsLinkHref(cta.link, pages) : null;

  const panel = (
    <div
      role="dialog"
      aria-modal={!preview}
      aria-labelledby={`popup-title-${blockId}`}
      className={cn(
        "relative w-full max-w-md rounded-2xl border border-white/15 bg-[#0b1220] p-6 shadow-2xl",
        "motion-safe:transition-opacity motion-safe:duration-200",
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg px-2 py-1 text-sm text-white/50 hover:bg-white/10 hover:text-white"
        aria-label="Sluiten"
      >
        ×
      </button>
      <h2 id={`popup-title-${blockId}`} className="pr-8 text-xl font-semibold text-white">
        {d.title}
      </h2>
      {d.body ? <p className="mt-2 text-sm text-white/70">{d.body}</p> : null}
      {cta?.label && href ? (
        preview ? (
          <button
            type="button"
            className="mt-5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            onClick={(e) => e.preventDefault()}
          >
            {cta.label}
          </button>
        ) : (
          <a
            href={href}
            className="mt-5 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            target={cta.link ? linkTarget(cta.link) : undefined}
            rel={cta.link ? linkRel(cta.link) : undefined}
            onClick={dismiss}
          >
            {cta.label}
          </a>
        )
      ) : cta?.label ? (
        <CmsButtonView button={cta} pages={pages} className="mt-5" />
      ) : null}
    </div>
  );

  if (preview) {
    return (
      <SectionShell blockType="popup">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Popup-preview</p>
        {panel}
      </SectionShell>
    );
  }

  return (
    <div
      data-cms-block-type="popup"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Sluit popup"
        onClick={dismiss}
      />
      <div className="relative z-[81]">{panel}</div>
    </div>
  );
}
