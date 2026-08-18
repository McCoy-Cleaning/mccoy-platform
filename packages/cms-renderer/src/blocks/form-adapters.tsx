import * as React from "react";

export type NewsletterSubmitInput = {
  blockId: string;
  pageId: string;
  email: string;
  consentAccepted: boolean;
  /** Honeypot — must stay empty */
  website?: string;
};

export type ContactFormSubmitInput = {
  blockId: string;
  pageId: string;
  fields: Record<string, string>;
  /** Selected file inputs — uploaded by the storefront adapter before submit. */
  files?: File[];
  /** Honeypot — must stay empty */
  website?: string;
};

export type QuoteFormSubmitInput = {
  blockId: string;
  pageId: string;
  kind: "glass_washing" | "furniture_cleaning";
  fields: Record<string, string>;
  /** Selected file inputs — uploaded by the storefront adapter before submit. */
  files?: File[];
  /** Honeypot — must stay empty */
  website?: string;
};

export type CmsFormAdapters = {
  submitNewsletter?: (
    input: NewsletterSubmitInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  submitContactForm?: (
    input: ContactFormSubmitInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  submitQuoteForm?: (
    input: QuoteFormSubmitInput,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

const CmsFormAdaptersContext = React.createContext<CmsFormAdapters | null>(null);
const CmsPageIdContext = React.createContext<string | null>(null);

export function CmsFormAdaptersProvider({
  adapters,
  children,
}: {
  adapters: CmsFormAdapters;
  children: React.ReactNode;
}) {
  return (
    <CmsFormAdaptersContext.Provider value={adapters}>{children}</CmsFormAdaptersContext.Provider>
  );
}

export function CmsPageIdProvider({
  pageId,
  children,
}: {
  pageId: string;
  children: React.ReactNode;
}) {
  return <CmsPageIdContext.Provider value={pageId}>{children}</CmsPageIdContext.Provider>;
}

export function useCmsFormAdapters(): CmsFormAdapters {
  return React.useContext(CmsFormAdaptersContext) ?? {};
}

/** Published CMS page id for form submissions (e.g. page_contact). */
export function useCmsPageId(): string | null {
  return React.useContext(CmsPageIdContext);
}
