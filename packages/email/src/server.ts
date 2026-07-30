/**
 * Server-only email adapters (`@mccoy/email/server`).
 * Never import this from browser / client modules.
 */

export {
  isSmtpConfigured,
  isSmtpUsableForOutbound,
  sendSmtpMail,
  defaultTransactionalFrom,
  getSmtpConfig,
} from "./smtp";
export { FormSubmitError, sendWebsiteFormEmail } from "./send-form";
export { sendAdminReplyEmail } from "./send-reply";
export {
  buildStaffInviteEmail,
  buildStaffInviteSupabaseAuthTemplate,
  sendStaffInviteEmail,
  isStaffInviteEmailConfigured,
  shouldPreferBrandedStaffInviteFirst,
  type StaffInviteEmailInput,
  type StaffInviteDelivery,
  type SendStaffInviteEmailResult,
} from "./staff-invite";
export {
  EMAIL_BRAND,
  EMAIL_BRAND_LOGO_PATH,
  EMAIL_BRAND_LOGO_PRODUCTION_URL,
  resolveEmailBrandLogoUrl,
  renderTransactionalEmailHtml,
  renderTransactionalEmailText,
  formatEmailDateNl,
  type EmailBrandLogoInput,
  type TransactionalCta,
  type TransactionalEmailLayoutInput,
} from "./transactional-layout";
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
