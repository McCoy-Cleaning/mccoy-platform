import type { FormScopeSnapshot } from "./form-scope";

export const FORM_KINDS = [
  "inquiry",
  "glass_washing",
  "furniture_cleaning",
  "job_application",
  "newsletter",
] as const;

export type FormKind = (typeof FORM_KINDS)[number];

export const FORM_SUBJECTS: Record<FormKind, string> = {
  inquiry: "Algemene aanvraag",
  glass_washing: "Offerte glasbewassing",
  furniture_cleaning: "Offerte meubelreiniging",
  job_application: "Sollicitatie",
  newsletter: "Nieuwsbrief-aanmelding",
};

export type FormAttachment = {
  filename: string;
  contentBase64: string;
  contentType: string;
};

export type WebsiteFormPayload = {
  kind: FormKind;
  /** Published CMS page id, e.g. page_contact */
  pageId: string;
  /** Block id or fixed source id, e.g. fixed:contact:form */
  sourceId: string;
  fields: Record<string, string>;
  attachments?: FormAttachment[];
  /** Honeypot — must stay empty */
  website?: string;
  /**
   * Compatibility only — ignored for authority.
   * Server overwrites from published form configuration.
   */
  scope?: FormScopeSnapshot;
};
