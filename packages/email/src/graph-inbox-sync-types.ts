/** Shared list→sync payload for Graph Aanvragen inbox (no runtime deps). */

export type GraphInboxSyncCandidate = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  internetMessageId?: string | null;
  conversationId?: string | null;
  fromAddress?: string | null;
  /** True when the message passed looksLikeFormCandidate during list. */
  isFormCandidate: boolean;
};
