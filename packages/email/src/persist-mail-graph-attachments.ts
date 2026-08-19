/**
 * List Graph attachment metadata and persist it on a mail_messages row.
 * Dynamic Graph import keeps ingest out of the graph-mail static graph.
 */
import {
  inboxAttachmentsToStored,
  type StoredMailAttachment,
} from "./mail-message-attachments";

export async function persistMailMessageGraphAttachments(options: {
  mailMessageId: string;
  graphMessageId: string;
  mailbox: string;
}): Promise<StoredMailAttachment[]> {
  const mailMessageId = options.mailMessageId.trim();
  const graphMessageId = options.graphMessageId.trim();
  const mailbox = options.mailbox.trim();
  if (!mailMessageId || !graphMessageId || !mailbox) return [];

  try {
    const { listGraphFormInboxAttachments } = await import("./graph-mail");
    const { updateWebsiteRequestMailMessageAttachments } = await import(
      "@mccoy/database/server"
    );
    const listed = await listGraphFormInboxAttachments(graphMessageId, mailbox);
    const stored = inboxAttachmentsToStored(listed);
    await updateWebsiteRequestMailMessageAttachments(mailMessageId, stored);
    return stored;
  } catch (error) {
    console.warn("[mail-attachments] persist Graph metadata failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return [];
  }
}
