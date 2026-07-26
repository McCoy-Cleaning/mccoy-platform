import type { FormKind } from "./forms";

/** Website-request status — separate from order/payment/fulfilment statuses. */
export const REQUEST_STATUSES = [
  "new",
  "open",
  "replied",
  "closed",
  "spam",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type AttachmentMeta = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type RequestReply = {
  id: string;
  body: string;
  sentAt: string;
  sentBy: string;
  toEmail: string;
  /** Provider message id (SMTP Message-ID); legacy field name kept for stored replies. */
  resendId?: string;
};

export type NotificationState = "pending" | "sent" | "failed" | "skipped";

export type WebsiteRequest = {
  id: string;
  number: string;
  kind: FormKind;
  status: RequestStatus;
  submitterName: string;
  submitterEmail: string;
  submitterPhone: string | null;
  submitterCompany: string | null;
  subject: string;
  fields: Record<string, string>;
  attachments: AttachmentMeta[];
  replies: RequestReply[];
  notificationState: NotificationState;
  notificationError: string | null;
  companyId: string | null;
  /** Stable form identity: `${pageId}:${sourceId}` */
  formId: string | null;
  sourcePageId: string | null;
  /** Stable scope filter key (null for historical / unscoped). */
  scopeKey: string | null;
  /** Display label snapshot at submit time. */
  scopeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  lastRepliedAt: string | null;
};

export type WebsiteRequestSummary = {
  id: string;
  number: string;
  kind: FormKind;
  status: RequestStatus;
  submitterName: string;
  submitterEmail: string;
  subject: string;
  attachmentCount: number;
  replyCount: number;
  formId: string | null;
  sourcePageId: string | null;
  scopeKey: string | null;
  scopeLabel: string | null;
  createdAt: string;
  updatedAt: string;
  lastRepliedAt: string | null;
};
