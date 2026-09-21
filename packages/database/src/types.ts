import type {
  AttachmentMeta,
  FormKind,
  InquiryStatus,
  NotificationState,
  RequestReply,
  RequestStatus,
  WebsiteRequest,
  WebsiteRequestSummary,
} from "@mccoy/domain";

export type CreateWebsiteRequestInput = {
  kind: FormKind;
  fields: Record<string, string>;
  attachments: AttachmentMeta[];
  notificationState?: NotificationState;
  notificationError?: string | null;
  formId?: string | null;
  sourcePageId?: string | null;
  scopeKey?: string | null;
  scopeLabel?: string | null;
};

export type ListWebsiteRequestsFilter = {
  kind?: FormKind | "all";
  status?: RequestStatus | "all";
  /** Multi-status allowlist; takes precedence over `status` when non-empty. */
  statuses?: RequestStatus[];
  scopeKey?: string | "all";
  q?: string;
  orderBy?: "created_at" | "updated_at";
};

/**
 * Website-request persistence port.
 * Current implementation: JSON file (+ memory fallback).
 * Next step: Postgres/Supabase adapter implementing the same interface.
 */
export type WebsiteRequestsStore = {
  createWebsiteRequest(input: CreateWebsiteRequestInput): Promise<WebsiteRequest>;
  updateRequestNotification(
    id: string,
    state: NotificationState,
    error?: string | null,
  ): Promise<void>;
  listWebsiteRequests(filter?: ListWebsiteRequestsFilter): Promise<WebsiteRequestSummary[]>;
  getWebsiteRequest(id: string): Promise<WebsiteRequest | null>;
  setWebsiteRequestStatus(id: string, status: RequestStatus): Promise<WebsiteRequest | null>;
  /** Staff triage label (Nieuw / In behandeling / Gefactureerd). Manual only. */
  setWebsiteRequestInquiryStatus(
    id: string,
    inquiryStatus: InquiryStatus,
  ): Promise<WebsiteRequest | null>;
  appendWebsiteRequestReply(
    id: string,
    reply: Omit<RequestReply, "id">,
    nextStatus?: RequestStatus,
  ): Promise<WebsiteRequest | null>;
  /**
   * Staff correction when a visitor submitted the wrong email.
   * Updates `submitter_email` and `fields.email` (when fields exist).
   */
  updateWebsiteRequestSubmitterEmail(
    id: string,
    email: string,
  ): Promise<WebsiteRequest | null>;
  countWebsiteRequests(): Promise<number>;
  /** Count rows with created_at in [fromIso, toIso). `toIso` defaults to now. */
  countWebsiteRequestsCreatedBetween(
    fromIso: string,
    toIso?: string,
  ): Promise<number>;
  /**
   * Clear scope_key/scope_label on rows whose scope is not in `activeScopeKeys`.
   * Empty active set clears every scoped row. Does not change kind or delete rows.
   */
  clearOrphanWebsiteRequestScopes(
    activeScopeKeys: string[],
  ): Promise<{ cleared: number }>;
};
