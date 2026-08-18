import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormInboxAttachment } from "@mccoy/email/contracts";
import {
  attachmentBlob,
  attachmentCacheKey,
  useFormInboxAttachment,
} from "../hooks/useFormInboxAttachment";

function AttachmentThumb({
  attachment,
  cacheKey,
  loadAttachment,
  onOpen,
}: {
  attachment: FormInboxAttachment;
  cacheKey: string;
  loadAttachment: (
    attachment: FormInboxAttachment,
    cacheKey: string,
  ) => Promise<FormInboxAttachment | null>;
  onOpen: () => void;
}) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    void loadAttachment(attachment, cacheKey)
      .then((resolved) => {
        if (!resolved || disposed) {
          if (!disposed) setFailed(true);
          return;
        }
        if (resolved.contentUrl) {
          setSrc(resolved.contentUrl);
          return;
        }
        if (!resolved.contentBase64) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(
          attachmentBlob({ ...resolved, contentBase64: resolved.contentBase64 }),
        );
        if (disposed) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, cacheKey, loadAttachment]);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Bekijk ${attachment.filename}`}
      className="group flex w-[4.75rem] flex-col items-stretch gap-1 rounded-xl text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c1220]"
    >
      {failed ? (
        <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/15 bg-black/30 px-1 text-center text-[10px] leading-tight text-white/55">
          Voorbeeld niet beschikbaar
        </span>
      ) : src ? (
        <img
          src={src}
          alt={attachment.filename}
          className="h-20 w-20 rounded-xl border border-white/15 bg-black/30 object-cover transition group-hover:border-white/35"
        />
      ) : (
        <span
          className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/15 bg-black/30 text-white/50"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="sr-only">Afbeelding laden</span>
        </span>
      )}
      <span className="truncate text-[11px] leading-tight text-white/55 group-hover:text-white/80">
        {attachment.filename}
      </span>
    </button>
  );
}

export function AttachmentImageThumbs({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments: FormInboxAttachment[];
}) {
  const { resolveAttachment, download, busyName, error } = useFormInboxAttachment(messageId);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  if (!attachments.length) return null;

  const openAttachment = openIndex === null ? null : (attachments[openIndex] ?? null);
  const openKey = openAttachment ? attachmentCacheKey(openAttachment, openIndex ?? 0) : null;

  return (
    <div>
      <ul className="flex flex-wrap gap-2.5">
        {attachments.map((attachment, index) => {
          const key = attachmentCacheKey(attachment, index);
          return (
            <li key={key}>
              <AttachmentThumb
                attachment={attachment}
                cacheKey={key}
                loadAttachment={resolveAttachment}
                onOpen={() => setOpenIndex(index)}
              />
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <Dialog
        open={openIndex !== null}
        onOpenChange={(next) => {
          if (!next) setOpenIndex(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[min(96vw,56rem)] overflow-hidden border-white/10 bg-[#0f172a] text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8 text-white">{openAttachment?.filename ?? "Foto"}</DialogTitle>
            <DialogDescription className="sr-only">
              Voorbeeld van {openAttachment?.filename ?? "de bijlage"}. Escape sluit dit venster.
            </DialogDescription>
          </DialogHeader>
          {openAttachment && openKey ? (
            <LightboxBody
              attachment={openAttachment}
              cacheKey={openKey}
              loadAttachment={resolveAttachment}
              onDownload={() => void download(openAttachment, openKey)}
              downloading={busyName === openAttachment.filename}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LightboxBody({
  attachment,
  cacheKey,
  loadAttachment,
  onDownload,
  downloading,
}: {
  attachment: FormInboxAttachment;
  cacheKey: string;
  loadAttachment: (
    attachment: FormInboxAttachment,
    cacheKey: string,
  ) => Promise<FormInboxAttachment | null>;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    void loadAttachment(attachment, cacheKey)
      .then((resolved) => {
        if (!resolved || disposed) {
          if (!disposed) setFailed(true);
          return;
        }
        if (resolved.contentUrl) {
          setSrc(resolved.contentUrl);
          return;
        }
        if (!resolved.contentBase64) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(
          attachmentBlob({ ...resolved, contentBase64: resolved.contentBase64 }),
        );
        if (disposed) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, cacheKey, loadAttachment]);

  return (
    <div className="space-y-4">
      {failed ? (
        <p className="rounded-xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-white/55">
          Afbeeldingsvoorbeeld niet beschikbaar. U kunt het bestand nog wel downloaden.
        </p>
      ) : src ? (
        <img
          src={src}
          alt={attachment.filename}
          className="max-h-[min(70vh,36rem)] w-full rounded-xl border border-white/10 bg-black/40 object-contain"
        />
      ) : (
        <div
          className="flex min-h-48 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm text-white/50"
          role="status"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Afbeelding laden…
        </div>
      )}
      <button
        type="button"
        onClick={onDownload}
        disabled={downloading}
        aria-label={`Download ${attachment.filename}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/60 disabled:opacity-50"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download
      </button>
    </div>
  );
}
