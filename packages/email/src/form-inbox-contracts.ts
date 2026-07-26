import type { FormKind } from "@mccoy/domain";

import type { ParsedFormField } from "./parse-form-fields";

export type FormInboxAttachment = {
  filename: string;
  contentType: string;
  size: number;
  /** Present when size is within limits (base64). */
  contentBase64?: string;
  omitted?: boolean;
  /** IMAP BODYSTRUCTURE part id for on-demand download. */
  part?: string;
};

export type FormInboxMessageSummary = {
  id: string;
  uid: number;
  kind: FormKind;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  unread: boolean;
  /** Visitor name from subject or parsed form fields when available. */
  submitterName: string | null;
  submitterEmail: string | null;
  requestNumber: string | null;
  /** Stable scope filter key (null for historical / unscoped). */
  scopeKey: string | null;
  /** Display label when known from headers/body/request. */
  scopeLabel: string | null;
};

export type FormInboxThreadItem = {
  id: string;
  uid: number;
  direction: "form" | "customer" | "admin";
  from: string;
  to: string;
  date: string;
  subject: string;
  textBody: string;
  messageId: string | null;
  attachments: FormInboxAttachment[];
};

export type FormInboxMessage = FormInboxMessageSummary & {
  textBody: string;
  htmlSafePreview: string;
  replyToHeader: string | null;
  messageId: string | null;
  /** Structured fields from the McCoy form notification table. */
  fields: ParsedFormField[];
  attachments: FormInboxAttachment[];
  /** Conversation messages related to this form request (includes root). */
  thread: FormInboxThreadItem[];
};

export class FormInboxConfigError extends Error {
  readonly code = "config" as const;
  constructor(
    message = "Configure Microsoft Graph (FORM_INBOX_PROVIDER=graph|auto) or SMTP_*/FORM_INBOX_* for Gmail-style IMAP. M365 IMAP basic auth is blocked — use Graph for reads.",
  ) {
    super(message);
    this.name = "FormInboxConfigError";
  }
}

export class FormInboxError extends Error {
  readonly code = "provider" as const;
  constructor(message: string) {
    super(message);
    this.name = "FormInboxError";
  }
}
