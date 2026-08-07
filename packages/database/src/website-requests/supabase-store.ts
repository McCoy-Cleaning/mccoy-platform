/**
 * Postgres-backed website-requests store (Stage C).
 * Create is atomic with the notification_outbox row via the
 * `create_website_request_with_notification` RPC (see
 * supabase/migrations/20260725121000_website_requests.sql).
 */
import { FORM_SUBJECTS } from "@mccoy/domain";
import type {
  AttachmentMeta,
  NotificationState,
  RequestReply,
  RequestStatus,
  WebsiteRequest,
  WebsiteRequestSummary,
} from "@mccoy/domain";

import { createSupabaseServiceClient } from "../supabase";
import type {
  CreateWebsiteRequestInput,
  ListWebsiteRequestsFilter,
  WebsiteRequestsStore,
} from "../types";
import type { WebsiteRequestReplyRow, WebsiteRequestRow } from "./types";

const LIST_LIMIT = 300;

function isReplyRows(
  value: WebsiteRequestRow["website_request_replies"],
): value is WebsiteRequestReplyRow[] {
  return Array.isArray(value) && (value.length === 0 || "body" in value[0]!);
}

function mapReply(row: WebsiteRequestReplyRow): RequestReply {
  return {
    id: row.id,
    body: row.body,
    sentAt: row.sent_at,
    sentBy: row.sent_by,
    toEmail: row.to_email,
    resendId: row.provider_message_id ?? undefined,
  };
}

function mapRequest(row: WebsiteRequestRow): WebsiteRequest {
  const embedded = row.website_request_replies;
  const replies = isReplyRows(embedded)
    ? [...embedded]
        .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
        .map(mapReply)
    : [];

  return {
    id: row.id,
    number: row.number,
    kind: row.kind as WebsiteRequest["kind"],
    status: row.status as RequestStatus,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    submitterPhone: row.submitter_phone ?? null,
    submitterCompany: row.submitter_company ?? null,
    subject: row.subject,
    fields: row.fields ?? {},
    attachments: (row.attachments ?? []) as AttachmentMeta[],
    replies,
    notificationState: row.notification_state as NotificationState,
    notificationError: row.notification_error ?? null,
    companyId: row.company_id ?? null,
    formId: row.form_id ?? null,
    sourcePageId: row.source_page_id ?? null,
    scopeKey: row.scope_key ?? null,
    scopeLabel: row.scope_label ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRepliedAt: row.last_replied_at ?? null,
  };
}

function mapSummary(row: WebsiteRequestRow): WebsiteRequestSummary {
  const embedded = row.website_request_replies;
  const replyCount =
    Array.isArray(embedded) && embedded.length > 0 && "count" in embedded[0]!
      ? Number((embedded[0] as { count: number }).count ?? 0)
      : 0;

  return {
    id: row.id,
    number: row.number,
    kind: row.kind as WebsiteRequestSummary["kind"],
    status: row.status as RequestStatus,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    subject: row.subject,
    attachmentCount: Array.isArray(row.attachments) ? row.attachments.length : 0,
    replyCount,
    formId: row.form_id ?? null,
    sourcePageId: row.source_page_id ?? null,
    scopeKey: row.scope_key ?? null,
    scopeLabel: row.scope_label ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRepliedAt: row.last_replied_at ?? null,
  };
}

/** PostgREST `.or()` filters use commas/parens as syntax — strip them from free-text search. */
function sanitizeSearchTerm(raw: string): string {
  return raw
    .replace(/[,()*]/g, " ")
    .trim()
    .slice(0, 200);
}

export async function createWebsiteRequest(
  input: CreateWebsiteRequestInput,
): Promise<WebsiteRequest> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("create_website_request_with_notification", {
    p_kind: input.kind,
    p_status: "new",
    p_submitter_name: input.fields.name?.trim() || "Onbekend",
    p_submitter_email: input.fields.email?.trim().toLowerCase() || "",
    p_submitter_phone: input.fields.phone?.trim() || null,
    p_submitter_company: input.fields.company?.trim() || null,
    p_subject: FORM_SUBJECTS[input.kind],
    p_fields: input.fields,
    p_attachments: input.attachments,
    p_notification_state: input.notificationState ?? "pending",
    p_form_id: input.formId ?? null,
    p_source_page_id: input.sourcePageId ?? null,
    p_scope_key: input.scopeKey ?? null,
    p_scope_label: input.scopeLabel ?? null,
  });

  if (error) {
    throw new Error(`createWebsiteRequest failed: ${error.message}`);
  }

  return mapRequest(data as WebsiteRequestRow);
}

export async function updateRequestNotification(
  id: string,
  state: NotificationState,
  error: string | null = null,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error: dbError } = await supabase
    .from("website_requests")
    .update({ notification_state: state, notification_error: error })
    .eq("id", id);

  if (dbError) {
    throw new Error(`updateRequestNotification failed: ${dbError.message}`);
  }
}

export async function listWebsiteRequests(
  filter: ListWebsiteRequestsFilter = {},
): Promise<WebsiteRequestSummary[]> {
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("website_requests")
    .select("*, website_request_replies(count)")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (filter.kind && filter.kind !== "all") {
    query = query.eq("kind", filter.kind);
  }
  if (filter.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }
  if (filter.scopeKey && filter.scopeKey !== "all") {
    query = query.eq("scope_key", filter.scopeKey);
  }

  const term = filter.q ? sanitizeSearchTerm(filter.q) : "";
  if (term) {
    // PostgREST .or() wildcard token is `*` (translated to `%` for ilike).
    const like = `*${term}*`;
    query = query.or(
      [
        `submitter_name.ilike.${like}`,
        `submitter_email.ilike.${like}`,
        `submitter_company.ilike.${like}`,
        `subject.ilike.${like}`,
        `number.ilike.${like}`,
        `scope_label.ilike.${like}`,
        `scope_key.ilike.${like}`,
        `fields->>message.ilike.${like}`,
        `fields->>motivation.ilike.${like}`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`listWebsiteRequests failed: ${error.message}`);
  }

  return ((data as WebsiteRequestRow[] | null) ?? []).map(mapSummary);
}

export async function getWebsiteRequest(id: string): Promise<WebsiteRequest | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("website_requests")
    .select("*, website_request_replies(*)")
    .order("sent_at", { referencedTable: "website_request_replies", ascending: true })
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`getWebsiteRequest failed: ${error.message}`);
  }
  if (!data) return null;
  return mapRequest(data as WebsiteRequestRow);
}

export async function setWebsiteRequestStatus(
  id: string,
  status: RequestStatus,
): Promise<WebsiteRequest | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("website_requests")
    .update({ status })
    .eq("id", id)
    .select("*, website_request_replies(*)")
    .maybeSingle();

  if (error) {
    throw new Error(`setWebsiteRequestStatus failed: ${error.message}`);
  }
  if (!data) return null;
  return mapRequest(data as WebsiteRequestRow);
}

export async function appendWebsiteRequestReply(
  id: string,
  reply: Omit<RequestReply, "id">,
  nextStatus: RequestStatus = "replied",
): Promise<WebsiteRequest | null> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.rpc("append_website_request_reply", {
    p_request_id: id,
    p_body: reply.body,
    p_sent_by: reply.sentBy,
    p_to_email: reply.toEmail,
    p_provider_message_id: reply.resendId ?? null,
    p_next_status: nextStatus,
  });

  if (error) {
    if (/not found/i.test(error.message)) return null;
    throw new Error(`appendWebsiteRequestReply failed: ${error.message}`);
  }

  return getWebsiteRequest(id);
}

export async function countWebsiteRequests(): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("website_requests")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(`countWebsiteRequests failed: ${error.message}`);
  }
  return count ?? 0;
}

export async function countWebsiteRequestsCreatedBetween(
  fromIso: string,
  toIso?: string,
): Promise<number> {
  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("website_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromIso);
  if (toIso) {
    query = query.lt("created_at", toIso);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`countWebsiteRequestsCreatedBetween failed: ${error.message}`);
  }
  return count ?? 0;
}

export async function clearOrphanWebsiteRequestScopes(
  activeScopeKeys: string[],
): Promise<{ cleared: number }> {
  const supabase = createSupabaseServiceClient();
  const active = new Set(
    activeScopeKeys.map((key) => key.trim().toLowerCase()).filter(Boolean),
  );

  const { data, error } = await supabase
    .from("website_requests")
    .select("id, scope_key")
    .not("scope_key", "is", null)
    .limit(2000);

  if (error) {
    throw new Error(`clearOrphanWebsiteRequestScopes list failed: ${error.message}`);
  }

  const orphanIds = ((data as Array<{ id: string; scope_key: string | null }> | null) ?? [])
    .filter((row) => {
      const key = row.scope_key?.trim().toLowerCase() ?? "";
      return key.length > 0 && !active.has(key);
    })
    .map((row) => row.id);

  if (orphanIds.length === 0) return { cleared: 0 };

  const { error: updateError } = await supabase
    .from("website_requests")
    .update({ scope_key: null, scope_label: null })
    .in("id", orphanIds);

  if (updateError) {
    throw new Error(`clearOrphanWebsiteRequestScopes update failed: ${updateError.message}`);
  }

  return { cleared: orphanIds.length };
}

/** Postgres-backed implementation of WebsiteRequestsStore. */
export const supabaseWebsiteRequestsStore: WebsiteRequestsStore = {
  createWebsiteRequest,
  updateRequestNotification,
  listWebsiteRequests,
  getWebsiteRequest,
  setWebsiteRequestStatus,
  appendWebsiteRequestReply,
  countWebsiteRequests,
  countWebsiteRequestsCreatedBetween,
  clearOrphanWebsiteRequestScopes,
};
