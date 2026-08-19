/**
 * Website-requests dual store dispatch (Stage C).
 *
 * Prefers Postgres (`public.website_requests` + `public.website_request_replies`,
 * see supabase/migrations/20260725121000_website_requests.sql) whenever
 * SUPABASE_SECRET_KEY is configured — mirrors `getCmsStore()` in ../cms/supabase-store.ts.
 * Falls back to the JSON file store (../json-store.ts) when Supabase is not configured,
 * e.g. local development without a Supabase project, or Playwright E2E (MCCOY_E2E=1),
 * which never sets SUPABASE_SECRET_KEY and resets the JSON file per run — keeping
 * e2e-form-inbox.ts / e2e/global-setup.ts fixtures unchanged.
 *
 * No dual-write: once Supabase is configured for an environment, that environment's
 * requests live in Postgres only. The JSON store remains untouched dead weight for
 * that environment (documented remaining gap — see task summary).
 */
import { hasSupabaseServiceConfig } from "../supabase";
import type { WebsiteRequestsStore } from "../types";
import { jsonWebsiteRequestsStore } from "../json-store";
import { supabaseWebsiteRequestsStore } from "./supabase-store";

export { supabaseWebsiteRequestsStore } from "./supabase-store";
export type { WebsiteRequestRow, WebsiteRequestReplyRow } from "./types";
export {
  upsertWebsiteRequestMailMessage,
  listWebsiteRequestMailMessages,
  listKnownMailIdentitiesForMailbox,
  updateWebsiteRequestMailMessageAttachments,
  type WebsiteRequestMailMessageInput,
  type WebsiteRequestMailMessageRow,
  type WebsiteRequestMailAttachmentMeta,
  type UpsertMailMessageResult,
} from "./mail-messages";

export {
  listHiddenWebsiteRequestNumbers,
  findWebsiteRequestIdByGraphMessageId,
  findWebsiteRequestIdByNumber,
} from "./delete-lookup";

export function getWebsiteRequestsStore(): WebsiteRequestsStore {
  return hasSupabaseServiceConfig() ? supabaseWebsiteRequestsStore : jsonWebsiteRequestsStore;
}

export const createWebsiteRequest: WebsiteRequestsStore["createWebsiteRequest"] = (input) =>
  getWebsiteRequestsStore().createWebsiteRequest(input);

export const updateRequestNotification: WebsiteRequestsStore["updateRequestNotification"] = (
  id,
  state,
  error,
) => getWebsiteRequestsStore().updateRequestNotification(id, state, error);

export const listWebsiteRequests: WebsiteRequestsStore["listWebsiteRequests"] = (filter) =>
  getWebsiteRequestsStore().listWebsiteRequests(filter);

export const getWebsiteRequest: WebsiteRequestsStore["getWebsiteRequest"] = (id) =>
  getWebsiteRequestsStore().getWebsiteRequest(id);

export const setWebsiteRequestStatus: WebsiteRequestsStore["setWebsiteRequestStatus"] = (
  id,
  status,
) => getWebsiteRequestsStore().setWebsiteRequestStatus(id, status);

export const appendWebsiteRequestReply: WebsiteRequestsStore["appendWebsiteRequestReply"] = (
  id,
  reply,
  nextStatus,
) => getWebsiteRequestsStore().appendWebsiteRequestReply(id, reply, nextStatus);

export const countWebsiteRequests: WebsiteRequestsStore["countWebsiteRequests"] = () =>
  getWebsiteRequestsStore().countWebsiteRequests();

export const countWebsiteRequestsCreatedBetween: WebsiteRequestsStore["countWebsiteRequestsCreatedBetween"] =
  (fromIso, toIso) =>
    getWebsiteRequestsStore().countWebsiteRequestsCreatedBetween(fromIso, toIso);

export const clearOrphanWebsiteRequestScopes: WebsiteRequestsStore["clearOrphanWebsiteRequestScopes"] =
  (activeScopeKeys) => getWebsiteRequestsStore().clearOrphanWebsiteRequestScopes(activeScopeKeys);

export {
  loadActivePublishedFormScopeKeys,
  reconcileOrphanWebsiteRequestScopes,
  type ReconcileOrphanScopesResult,
} from "./reconcile-orphan-scopes";

export {
  WEBSITE_REQUEST_ATTACHMENTS_BUCKET,
  WEBSITE_REQUEST_ATTACHMENT_MAX_BYTES,
  WEBSITE_REQUEST_ATTACHMENT_URL_TTL_SECONDS,
  websiteRequestAttachmentStoragePath,
  sanitizeStorageObjectName,
  sanitizeAttachmentFilename,
  isWebsiteRequestUploadStoragePath,
  websiteRequestUploadStorageFilename,
  createWebsiteRequestAttachmentUploadSlots,
  storeWebsiteRequestAttachments,
  finalizeWebsiteRequestUploadedAttachments,
  getStoredWebsiteRequestAttachmentByPath,
  getStoredWebsiteRequestAttachment,
  createStoredWebsiteRequestAttachmentAccess,
  type WebsiteRequestAttachmentContent,
  type WebsiteRequestAttachmentUploadSlot,
  type StoreWebsiteRequestAttachmentsResult,
  type WebsiteRequestAttachmentAccess,
} from "./attachments";
