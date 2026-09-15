-- Inquiry workflow status — a staff triage label: Nieuw / In behandeling / Gefactureerd.
--
-- This is a SEPARATE axis from the existing `status` column
-- (new/open/replied/closed/spam), which tracks the request lifecycle and must
-- not be overloaded (see AGENTS.md "Keep separate state machines").
--
-- "invoiced" (Gefactureerd) is a manual staff label ONLY. It does NOT create,
-- link, or imply a legal invoice, order, payment, or financial record. The
-- authoritative invoice system is documented separately; this column is a
-- triage tag that staff set by hand from the Aanvragen list/detail.
--
-- Writes: service_role only via setWebsiteRequestInquiryStatus (trusted server).
-- Reads: active staff via the existing website_requests RLS select policy.

alter table public.website_requests
  add column if not exists inquiry_status text not null default 'new'
    check (inquiry_status in ('new', 'in_progress', 'invoiced'));

-- NOT NULL with a default backfills every existing row to 'new' implicitly;
-- no separate UPDATE is needed.

comment on column public.website_requests.inquiry_status is
  'Staff triage label (new | in_progress | invoiced). Independent of the request lifecycle status. Manual label only — never creates invoices or financial records.';

create index if not exists website_requests_inquiry_status_idx
  on public.website_requests (inquiry_status, created_at desc);
