/**
 * Pure builders for Graph reply draft payloads.
 * createReply drafts reject internetMessageHeaders (ErrorInvalidPropertySet).
 */

export type GraphReplyDraftPatch = {
  body: { contentType: "HTML"; content: string };
  toRecipients: Array<{ emailAddress: { address: string } }>;
  bccRecipients?: Array<{ emailAddress: { address: string } }>;
  replyTo?: Array<{ emailAddress: { address: string } }>;
};

export function buildGraphReplyDraftPatch(options: {
  html: string;
  to: string;
  replyTo?: string;
  bcc?: string[];
}): GraphReplyDraftPatch {
  const patch: GraphReplyDraftPatch = {
    body: {
      contentType: "HTML",
      content: options.html,
    },
    toRecipients: [{ emailAddress: { address: options.to } }],
  };

  const bcc = (options.bcc ?? [])
    .map((addr) => addr.trim().toLowerCase())
    .filter((addr) => addr.length > 0 && addr !== options.to.trim().toLowerCase());
  if (bcc.length > 0) {
    patch.bccRecipients = bcc.map((address) => ({ emailAddress: { address } }));
  }

  if (options.replyTo?.trim()) {
    patch.replyTo = [{ emailAddress: { address: options.replyTo.trim() } }];
  }

  return patch;
}

/** Guard: reply draft patches must never carry internetMessageHeaders. */
export function assertReplyDraftPatchSafe(patch: Record<string, unknown>): void {
  if ("internetMessageHeaders" in patch) {
    throw new Error(
      "internetMessageHeaders must not be PATCHed on createReply drafts (ErrorInvalidPropertySet)",
    );
  }
}
