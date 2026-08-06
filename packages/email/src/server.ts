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
export { sendAdminReplyEmail, type SendAdminReplyEmailResult } from "./send-reply";
export {
  correlateInboundGraphMessage,
  normaliseInternetMessageId,
  parseReferencesHeader,
  type CorrelateInboundResult,
  type InboundMailCandidate,
  type KnownInquiryMailIdentity,
} from "./inquiry-thread-correlation";
export {
  buildStaffInviteEmail,
  buildStaffInviteSupabaseAuthTemplate,
  buildStaffPasswordResetEmail,
  buildStaffAccountRecoveryEmail,
  sendStaffInviteEmail,
  sendStaffPasswordResetEmail,
  sendStaffAccountRecoveryEmail,
  isStaffInviteEmailConfigured,
  staffAuthEmailConfigErrorMessage,
  shouldPreferBrandedStaffInviteFirst,
  type StaffInviteEmailInput,
  type StaffPasswordResetEmailInput,
  type StaffAccountRecoveryEmailInput,
  type StaffInviteDelivery,
  type SendStaffInviteEmailResult,
} from "./staff-invite";
export {
  buildStaffAuthAppLink,
  normalizeStaffAuthAppLinkType,
  resolveStaffAuthEmailLink,
  withInviteRedirectTo,
  type StaffAuthAppLinkType,
  type StaffAuthGenerateLinkProperties,
} from "./staff-auth-app-link";
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
  EMAIL_BRAND_LOGO_CID,
  embedBrandLogoCidInHtml,
  loadEmailBrandLogoAttachment,
  prepareStaffEmailHtmlForDelivery,
  resolveStaffEmailRecipientName,
  staffEmailBrandLogoUrl,
  staffEmailGreeting,
  type EmailBrandLogoAttachment,
  type PreparedStaffEmailDelivery,
} from "./email-brand-logo";
export {
  FormInboxConfigError,
  FormInboxError,
  decodeInboxMessageId,
  encodeInboxMessageId,
  encodeGraphMessageId,
  encodeImapMessageId,
  deleteFormInboxMessage,
  bulkDeleteFormInboxMessages,
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
  classifyGraphThreadDirection,
  formKindFromInternetHeaders,
  hasMcCoyFormMarkerHeaders,
  isMcCoyWebsiteFormNotificationBySender,
  isMcCoyWebsiteFormNotificationGraph,
  isReplyOrForwardSubject,
  looksLikeFormCandidate,
  showAllGraphInboxMessages,
  type GraphSendReplyResult,
  type GraphInboxSyncCandidate,
} from "./graph-mail";
export { syncGraphInboxAfterList } from "./graph-inbox-sync";
export {
  syncWebsiteRequestGraphThread,
  type SyncWebsiteRequestGraphThreadResult,
} from "./sync-request-graph-thread";
export {
  dedupeInquiryThreadItems,
  extractSimpleReplyBody,
  stripQuotedReplyBody,
  normaliseThreadMessageBody,
  isTemplatedWrapOf,
  looksLikeMcCoyAdminEmailTemplate,
  outboundMailDuplicatesStaffReply,
} from "./inquiry-thread-dedupe";
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
export { bulkDeleteFailureMessage, type InboxBulkDeleteFailure } from "./inbox-delete-errors";
export {
  bulkDeleteGraphMessages,
  GRAPH_BATCH_SIZE,
  type GraphBulkDeleteItemResult,
  type GraphBulkDeleteResult,
} from "./graph-bulk-delete";
export type {
  FormInboxBulkDeleteResult,
  FormInboxDeleteItemResult,
} from "./form-inbox";
export type { InboxLoadMetrics } from "./graph-mail";
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
