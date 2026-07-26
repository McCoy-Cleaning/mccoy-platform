import * as React from "react";
import {
  type ContactFormBlockData,
  type NewsletterBlockData,
  type PopupBlockData,
  resolveCmsLinkHref,
  linkRel,
  linkTarget,
  type CmsButton,
} from "@mccoy/cms-schema";
import {
  SECTION_PAGE_RAIL,
  SECTION_SHELL_Y,
  SECTION_TITLE,
  sectionInnerAlignRowClass,
  sectionInnerColumnClass,
} from "../sectionLayout";
import { useContentAlign } from "../contentAlign";
import { useCmsFormAdapters, useCmsPageId } from "./form-adapters";
import { CmsButtonView, type LinkResolverPages } from "./primitives";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SectionShell({
  blockType,
  children,
  tone = "default",
}: {
  blockType: string;
  children: React.ReactNode;
  tone?: "default" | "muted" | "cta";
}) {
  const contentAlign = useContentAlign();
  const framed =
    tone === "muted"
      ? "rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 sm:px-10 sm:py-16"
      : tone === "cta"
        ? "my-4 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 py-16 sm:px-12 sm:py-24"
        : null;
  return (
    <section
      data-cms-block-type={blockType}
      data-cms-content-align={contentAlign}
      className={SECTION_SHELL_Y}
    >
      <div className={SECTION_PAGE_RAIL} data-cms-section-rail="">
        <div className={sectionInnerAlignRowClass(contentAlign)} data-cms-section-align="">
          <div className={sectionInnerColumnClass()} data-cms-section-inner="">
            {framed ? <div className={framed}>{children}</div> : children}
          </div>
        </div>
      </div>
    </section>
  );
}

export type ConversionRenderMode = "preview" | "storefront";

function fieldKeyFromLabel(label: string, id: string): string {
  const lower = label.trim().toLowerCase();
  if (/^(e-?mail|email)$/i.test(lower)) return "email";
  if (/^(naam|name)$/i.test(lower)) return "name";
  if (/^(bericht|message|opmerking)$/i.test(lower)) return "message";
  if (/^(telefoon|phone|tel)$/i.test(lower)) return "phone";
  if (/^(bedrijf|company)$/i.test(lower)) return "company";
  const slug = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return slug || `field_${id.slice(0, 12)}`;
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
    <SectionShell blockType="newsletter" tone="muted">
      <h2 className={SECTION_TITLE}>{d.title}</h2>
      {d.body ? <p className="mt-2 max-w-2xl text-white/70">{d.body}</p> : null}
      {status === "success" ? (
        <p className="mt-6 text-sm text-emerald-300" role="status">
          Bedankt — je aanmelding is ontvangen.
        </p>
      ) : (
        <form className="mt-6 max-w-lg space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
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
            <label htmlFor={`newsletter-email-${blockId}`} className="text-xs font-medium text-white/60">
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
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
          {requiresConsent ? (
            <label className="flex items-start gap-2 text-sm text-white/75">
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
            <p className="text-xs text-white/45">Preview — verzenden is uitgeschakeld.</p>
          ) : null}
        </form>
      )}
    </SectionShell>
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
  const fields = (d.fields ?? []).filter((f) => f.text.trim());
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const preview = mode === "preview";

  const keys = React.useMemo(
    () =>
      fields.map((f) => ({
        item: f,
        key: fieldKeyFromLabel(f.text, f.id),
        inputType: /e-?mail/i.test(f.text) ? "email" : /bericht|message/i.test(f.text) ? "textarea" : "text",
      })),
    [fields],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setError(null);
    const payload: Record<string, string> = {};
    for (const row of keys) {
      payload[row.key] = (values[row.key] ?? "").trim();
    }
    if (!payload.email || !payload.name) {
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

  if (fields.length === 0) {
    return (
      <SectionShell blockType="contactForm" tone="muted">
        <h2 className={SECTION_TITLE}>{d.title}</h2>
        <p className="mt-2 text-sm text-white/55">Nog geen velden geconfigureerd.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell blockType="contactForm">
      <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Contact</p>
          <h2 className="font-display mt-3 text-3xl text-white md:text-4xl">{d.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60 md:text-base">
            Vul het formulier in. Uw aanvraag wordt opgeslagen en per e-mail doorgestuurd naar
            info@mccoy.nl.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-12 top-0 h-40 w-40 rounded-full bg-primary/15 blur-3xl" aria-hidden />
          {status === "success" ? (
            <div className="relative py-10 text-center" role="status">
              <p className="font-display text-2xl text-white">
                {d.confirmation?.trim() || "Bedankt voor uw bericht."}
              </p>
              <p className="mt-2 text-sm text-white/55">We nemen zo snel mogelijk contact op.</p>
            </div>
          ) : (
            <form className="relative space-y-5" onSubmit={(e) => void onSubmit(e)} noValidate>
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
              {keys.map(({ item, key, inputType }) => {
                const fieldId = `cf-${blockId}-${item.id}`;
                const required = key === "name" || key === "email";
                return (
                  <div key={item.id}>
                    <label
                      htmlFor={fieldId}
                      className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-white/55"
                    >
                      {item.text}
                      {required ? <span className="ml-1 text-primary">*</span> : null}
                    </label>
                    {inputType === "textarea" ? (
                      <textarea
                        id={fieldId}
                        name={key}
                        rows={5}
                        required={required}
                        disabled={preview || status === "loading"}
                        value={values[key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        className="w-full resize-y rounded-2xl border border-white/12 bg-black/35 px-4 py-3.5 text-sm text-white outline-none transition hover:border-white/20 focus:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                      />
                    ) : (
                      <input
                        id={fieldId}
                        type={inputType}
                        name={key}
                        required={required}
                        disabled={preview || status === "loading"}
                        value={values[key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        className="w-full rounded-2xl border border-white/12 bg-black/35 px-4 py-3.5 text-sm text-white outline-none transition hover:border-white/20 focus:border-primary/70 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
                      />
                    )}
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
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60 sm:w-auto"
              >
                {status === "loading" ? "Bezig…" : "Versturen"}
              </button>
              {preview ? (
                <p className="text-xs text-white/45">Preview — verzenden is uitgeschakeld.</p>
              ) : null}
            </form>
          )}
        </div>
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
      <SectionShell blockType="popup" tone="muted">
        <p className="mb-3 text-xs uppercase tracking-wider text-white/45">Popup-preview</p>
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
