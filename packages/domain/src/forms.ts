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

/** Browser upload intent — metadata only; bytes go straight to private storage. */
export type FormUploadFileIntent = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

/** Attachment already uploaded to private storage (no Base64 in the form payload). */
export type UploadedFormAttachment = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
};

/** Max files per website form submission (private storage path). */
export const MAX_WEBSITE_FORM_ATTACHMENT_COUNT = 8;

/** Max bytes per attachment in private storage (25 MB). */
export const MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES = 25 * 1024 * 1024;

/** Max combined attachment bytes per submission. */
export const MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES =
  MAX_WEBSITE_FORM_ATTACHMENT_COUNT * MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES;

export type WebsiteFormPayload = {
  kind: FormKind;
  /** Published CMS page id, e.g. page_contact */
  pageId: string;
  /** Block id or fixed source id, e.g. fixed:contact:form */
  sourceId: string;
  fields: Record<string, string>;
  /** Legacy Base64 path (small files / mail recovery). Prefer uploadedAttachments. */
  attachments?: FormAttachment[];
  /** Files already uploaded to private storage (no Base64 in the function payload). */
  uploadedAttachments?: UploadedFormAttachment[];
  /** Honeypot — must stay empty */
  website?: string;
  /**
   * Compatibility only — ignored for authority.
   * Server overwrites from published form configuration.
   */
  scope?: FormScopeSnapshot;
};
