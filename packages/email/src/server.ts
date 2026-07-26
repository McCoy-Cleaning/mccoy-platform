/**
 * Server-only email adapters (`@mccoy/email/server`).
 * Never import this from browser / client modules.
 */

export {
  isSmtpConfigured,
  sendSmtpMail,
  defaultTransactionalFrom,
} from "./smtp";
export { FormSubmitError, sendWebsiteFormEmail } from "./send-form";
export { sendAdminReplyEmail } from "./send-reply";
export {
  buildStaffInviteEmail,
  sendStaffInviteEmail,
  isStaffInviteEmailConfigured,
  type StaffInviteEmailInput,
  type SendStaffInviteEmailResult,
} from "./staff-invite";
export {
  FormInboxConfigError,
  FormInboxError,
  decodeInboxMessageId,
  encodeInboxMessageId,
  encodeGraphMessageId,
  encodeImapMessageId,
  getFormInboxAttachment,
  getFormInboxMessage,
  getFormInboxThread,
  isFormInboxConfigured,
  isMcCoyWebsiteFormNotification,
  listFormInboxMessages,
  resolveSubmitterEmail,
  type FormInboxAttachment,
  type FormInboxMessage,
  type FormInboxMessageSummary,
  type FormInboxThreadItem,
} from "./form-inbox";
export { isGraphMailConfigured, getGraphMailConfig } from "./graph-config";
export {
  formInboxConfigHelpMessage,
  getFormInboxProviderMode,
  shouldAllowImapInbox,
  shouldAttemptGraphMail,
  shouldFallbackFromGraph,
  type FormInboxProviderMode,
} from "./form-inbox-provider";
export { clearGraphAccessTokenCache } from "./graph-auth";
export { INBOX_MESSAGE_ID_PATTERN } from "./inbox-message-id";
/** Re-export pure helpers so server consumers can import one entry when needed. */
export { buildFormEmail, escapeHtml } from "./templates";
export {
  classifyFormEmailSubject,
  extractRequestNumber,
  extractSubmitterNameFromSubject,
  FORM_SUBJECT_NEEDLES,
} from "./classify-form-email";
export {
  parseFormFieldsFromHtml,
  parseFormFieldsFromText,
  normalizeFormFieldLabel,
  type ParsedFormField,
} from "./parse-form-fields";
export {
  correlateInboundMailToWebsiteRequest,
  type MailCorrelationResult,
} from "./mail-received-correlation";
