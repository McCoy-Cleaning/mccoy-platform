/**
 * Root `@mccoy/email` is contracts-only.
 * Prefer:
 * - `@mccoy/email/contracts` for shared types/helpers
 * - `@mccoy/email/server` for SMTP/IMAP sending and inbox adapters
 *
 * Do not re-export Node mail adapters from this root.
 */

export {
  FormSubmitError,
  buildFormEmail,
  buildSubmitterConfirmationEmail,
  escapeHtml,
  classifyFormEmailSubject,
  extractRequestNumber,
  extractSubmitterNameFromSubject,
  FORM_SUBJECT_NEEDLES,
  parseFormFieldsFromHtml,
  parseFormFieldsFromText,
  normalizeFormFieldLabel,
  FormInboxConfigError,
  FormInboxError,
  type ParsedFormField,
  type FormInboxAttachment,
  type FormInboxMessage,
  type FormInboxMessageSummary,
  type FormInboxThreadItem,
} from "./contracts";
