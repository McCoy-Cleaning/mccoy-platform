/**
 * In-app notification when an applicant reply is appended to an Aanvraag thread.
 *
 * destination_path must stay query-free until / if DB allows `?` (legacy check
 * `^/[A-Za-z0-9/_-]*$`). Deep link uses metadata.inboxMessageId instead.
 */
import {
  enqueueNotificationOutbox,
  getWebsiteRequest,
  processNotificationOutbox,
  setWebsiteRequestStatus,
} from "@mccoy/database/server";
import { encodeRequestMessageId } from "./inbox-message-id";

const REQUEST_MAILBOX = "website-requests";

export async function notifyApplicantReplyAppended(options: {
  requestId: string;
  mailMessageId: string;
  mailbox: string;
  senderAddress?: string | null;
}): Promise<void> {
  try {
    const request = await getWebsiteRequest(options.requestId);
    if (!request) return;
    if (request.status === "deleted" || request.status === "spam") return;

    const name =
      (typeof request.submitterName === "string" && request.submitterName.trim()) ||
      options.senderAddress?.split("@")[0]?.trim() ||
      "Aanvrager";
    const inboxMessageId = encodeRequestMessageId(options.requestId, REQUEST_MAILBOX);
    const reopenedFromResolved = request.status === "closed";

    // Ensure list unread (status open) even if DB upsert still maps inbound → replied.
    // Deleted/spam requests are intentionally not reopened; their mail remains
    // in Outlook and is excluded from the Aanvragen request pipeline.
    if (request.status === "replied" || request.status === "new" || request.status === "closed") {
      await setWebsiteRequestStatus(options.requestId, "open");
    }
    const { clearInboxListSnapshotCache } = await import("./form-inbox-list-cache");
    clearInboxListSnapshotCache();

    await enqueueNotificationOutbox({
      type: "website_request.applicant_replied",
      title: reopenedFromResolved
        ? `${name.slice(0, 80)} heeft gereageerd op een afgeronde aanvraag.`
        : `${name.slice(0, 80)} heeft gereageerd op je e-mail.`,
      destinationPath: "/inquiries",
      entityType: "website_request",
      entityId: options.requestId,
      metadata: {
        requestId: options.requestId,
        requestNumber: request.number,
        submitterName: name.slice(0, 120),
        inboxMessageId,
        reopenedFromResolved,
      },
      dedupeKey: `website_request.applicant_replied:${options.mailMessageId}`,
    });
    await processNotificationOutbox(5);
  } catch (error) {
    console.error("[email] applicant-reply notification failed", {
      requestId: options.requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }
}
