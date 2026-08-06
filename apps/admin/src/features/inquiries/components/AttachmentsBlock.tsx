import * as React from "react";
import { Download, Loader2, Paperclip } from "lucide-react";
import { getAdminFormInboxAttachment } from "@/lib/api/admin-requests.functions";
import type { FormInboxAttachment } from "@mccoy/email/contracts";

export function AttachmentsBlock({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments: FormInboxAttachment[];
}) {
  const [busyName, setBusyName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!attachments.length) return null;

  const download = async (att: FormInboxAttachment) => {
    if (att.contentBase64) {
      const binary = atob(att.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: att.contentType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!messageId) {
      setError("Bijlage niet beschikbaar om te downloaden.");
      return;
    }

    setBusyName(att.filename);
    setError(null);
    try {
      const result = await getAdminFormInboxAttachment({
        data: { id: messageId, filename: att.filename },
      });
      if (!result.ok || !result.attachment.contentBase64) {
        setError(result.ok ? "Download mislukt." : result.error);
        return;
      }
      const binary = atob(result.attachment.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: result.attachment.contentType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download mislukt.");
    } finally {
      setBusyName(null);
    }
  };

  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/55">
        <Paperclip className="h-4 w-4" />
        Bijlagen
      </h3>
      <ul className="space-y-2">
        {attachments.map((att) => (
          <li
            key={`${att.filename}-${att.size}`}
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
              onClick={() => void download(att)}
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
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
