/**
 * Deterministic Aanvragen inbox for MCCOY_E2E=1.
 * Delegates to the shared website_requests inbox (same as production).
 */
import {
  deleteWebsiteRequestFormInboxMessage,
  getWebsiteRequestFormInboxAttachment,
  getWebsiteRequestFormInboxMessage,
  getWebsiteRequestFormInboxThread,
  listWebsiteRequestFormInboxMessages,
  websiteRequestToSummary,
} from "./website-request-inbox";
import type { InboxFacets, InboxListFilters } from "./filter-inbox-messages";
import type {
  FormInboxAttachment,
  FormInboxMessage,
  FormInboxMessageSummary,
  FormInboxThreadItem,
} from "./form-inbox-contracts";

export { websiteRequestToSummary };

export function isE2eFormInboxEnabled(): boolean {
  return process.env.MCCOY_E2E === "1";
}

export async function listE2eFormInboxMessages(
  options?: InboxListFilters & { limit?: number },
): Promise<{ items: FormInboxMessageSummary[]; facets: InboxFacets }> {
  return listWebsiteRequestFormInboxMessages(options);
}

export async function getE2eFormInboxMessage(id: string): Promise<FormInboxMessage | null> {
  return getWebsiteRequestFormInboxMessage(id);
}

export async function getE2eFormInboxThread(id: string): Promise<FormInboxThreadItem[]> {
  return getWebsiteRequestFormInboxThread(id);
}

export async function getE2eFormInboxAttachment(
  _id: string,
  _filename: string,
): Promise<FormInboxAttachment | null> {
  return getWebsiteRequestFormInboxAttachment();
}

export async function deleteE2eFormInboxMessage(id: string): Promise<void> {
  await deleteWebsiteRequestFormInboxMessage(id);
}
