import type {
  AttachmentMeta,
  FormKind,
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
  scopeKey?: string | "all";
  q?: string;
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
  appendWebsiteRequestReply(
    id: string,
    reply: Omit<RequestReply, "id">,
    nextStatus?: RequestStatus,
  ): Promise<WebsiteRequest | null>;
  countWebsiteRequests(): Promise<number>;
};
