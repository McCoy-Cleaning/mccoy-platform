import * as React from "react";
import { Download, Loader2, Paperclip } from "lucide-react";
import type { FormInboxAttachment } from "@mccoy/email/contracts";
import {
  isPreviewableImageAttachment,
} from "../lib/form-field-attachments";
import {
  attachmentBlob,
  attachmentCacheKey,
  signedUrlIsFresh,
  useFormInboxAttachment,
} from "../hooks/useFormInboxAttachment";
import { AttachmentImageThumbs } from "./AttachmentImageThumbs";

export function AttachmentsBlock({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments: FormInboxAttachment[];
}) {
  const { download, busyName, error, setError } = useFormInboxAttachment(messageId);

  if (!attachments.length) return null;

  const images = attachments.filter(isPreviewableImageAttachment);
  const files = attachments.filter((item) => !isPreviewableImageAttachment(item));

  return (
    <div className="space-y-5">
      {images.length > 0 ? (
        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/55">
            Foto&apos;s
          </h3>
          <AttachmentImageThumbs messageId={messageId} attachments={images} />
        </div>
      ) : null}

      {files.length > 0 ? (
        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/55">
            <Paperclip className="h-4 w-4" />
            Bijlagen
          </h3>
          <ul className="space-y-2">
            {files.map((att, index) => (
              <li
                key={`${att.filename}-${att.size}-${index}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-white/90">{att.filename}</div>
                  <div className="text-xs text-white/45">
                    {att.contentType}
                    {att.size > 0 ? ` · ${Math.round(att.size / 1024)} KB` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void download(att, attachmentCacheKey(att, index)).catch(() => {
                      setError("Download mislukt.");
                    })
                  }
                  disabled={busyName === att.filename}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {busyName === att.filename ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Kept for tests that still exercise Base64 → Blob download helpers. */
export function downloadAttachmentBlob(
  attachment: FormInboxAttachment & { contentBase64: string },
): void {
  const blob = attachmentBlob(attachment);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = attachment.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function attachmentHasFreshSignedUrl(attachment: FormInboxAttachment): boolean {
  return signedUrlIsFresh(attachment);
}
