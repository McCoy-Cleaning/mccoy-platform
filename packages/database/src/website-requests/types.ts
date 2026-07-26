/** Row shapes for public.website_requests / public.website_request_replies (snake_case as stored). */

export type WebsiteRequestReplyRow = {
  id: string;
  request_id: string;
  body: string;
  sent_at: string;
  sent_by: string;
  to_email: string;
  provider_message_id: string | null;
  created_at: string;
};

export type WebsiteRequestRow = {
  id: string;
  number: string;
  kind: string;
  status: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone: string | null;
  submitter_company: string | null;
  subject: string;
  fields: Record<string, string>;
  attachments: Array<{ filename: string; contentType: string; sizeBytes: number }>;
  notification_state: string;
  notification_error: string | null;
  company_id: string | null;
  form_id: string | null;
  source_page_id: string | null;
  scope_key: string | null;
  scope_label: string | null;
  created_at: string;
  updated_at: string;
  last_replied_at: string | null;
  /** Present when the row was fetched with an embedded replies selection. */
  website_request_replies?: WebsiteRequestReplyRow[] | Array<{ count: number }>;
};
