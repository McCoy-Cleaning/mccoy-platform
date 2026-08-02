/**
 * Shared email contracts — safe for any environment (`@mccoy/email/contracts`).
 * Does not import nodemailer, imapflow, mailparser, or Node builtins.
 */

export { FormSubmitError } from "./form-submit-error";
export { buildFormEmail, escapeHtml } from "./templates";
export {
  classifyFormEmailSubject,
  extractFormScopeKeyFromSubject,
  extractRequestNumber,
  extractSubmitterNameFromSubject,
  FORM_SUBJECT_NEEDLES,
} from "./classify-form-email";
export {
  filterInboxMessages,
  buildInboxFacets,
  mergeScopeFacets,
  buildAanvragenScopeFacets,
  type InboxListFilters,
  type InboxFacets,
  type InboxScopeFacet,
  type InboxKindFacet,
} from "./filter-inbox-messages";
export {
  enrichInboxSummariesWithRequestScopes,
  mergeMailboxAndWebsiteRequestSummaries,
  type InboxScopeEnrichmentSource,
} from "./enrich-inbox-scopes";
export {
  parseFormFieldsFromHtml,
  parseFormFieldsFromText,
  normalizeFormFieldLabel,
  type ParsedFormField,
} from "./parse-form-fields";
export {
  FormInboxConfigError,
  FormInboxError,
  type FormInboxAttachment,
  type FormInboxMessage,
  type FormInboxMessageSummary,
  type FormInboxThreadItem,
} from "./form-inbox-contracts";
export {
  decodeInboxMessageId,
  encodeE2eMessageId,
  encodeGraphMessageId,
  encodeImapMessageId,
  INBOX_MESSAGE_ID_PATTERN,
  type DecodedInboxMessageId,
} from "./inbox-message-id";
