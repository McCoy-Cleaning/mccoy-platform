import * as React from "react";
import { getAdminFormInboxAttachment } from "@/lib/api/admin-requests.functions";
import type { FormInboxAttachment } from "@mccoy/email/contracts";

export function attachmentBlob(
  attachment: FormInboxAttachment & { contentBase64: string },
): Blob {
  const binary = atob(attachment.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {
    type: attachment.contentType || "application/octet-stream",
  });
}

export function signedUrlIsFresh(attachment: FormInboxAttachment): boolean {
  if (!attachment.contentUrl && !attachment.downloadUrl) return false;
  if (!attachment.urlExpiresAt) return true;
  return new Date(attachment.urlExpiresAt).getTime() > Date.now() + 10_000;
}

export function hasAttachmentContent(attachment: FormInboxAttachment): boolean {
  return Boolean(attachment.contentBase64) || signedUrlIsFresh(attachment);
}

export function attachmentCacheKey(attachment: FormInboxAttachment, index: number): string {
  return `${index}:${attachment.filename}:${attachment.size}`;
}

function triggerSignedDownload(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.click();
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useFormInboxAttachment(messageId?: string) {
  const [busyName, setBusyName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resolvedRef = React.useRef(new Map<string, FormInboxAttachment>());
  const pendingRef = React.useRef(new Map<string, Promise<FormInboxAttachment | null>>());

  const resolveAttachment = React.useCallback(
    async (att: FormInboxAttachment, key: string): Promise<FormInboxAttachment | null> => {
      if (hasAttachmentContent(att)) return att;

      const resolved = resolvedRef.current.get(key);
      if (resolved && hasAttachmentContent(resolved)) return resolved;
      if (resolved) resolvedRef.current.delete(key);

      const pending = pendingRef.current.get(key);
      if (pending) return pending;
      if (!messageId) return null;

      const request = getAdminFormInboxAttachment({
        data: { id: messageId, filename: att.filename },
      })
        .then((result) => {
          if (!result.ok) throw new Error(result.error);
          if (!hasAttachmentContent(result.attachment)) return null;
          resolvedRef.current.set(key, result.attachment);
          return result.attachment;
        })
        .finally(() => {
          pendingRef.current.delete(key);
        });

      pendingRef.current.set(key, request);
      return request;
    },
    [messageId],
  );

  const download = React.useCallback(
    async (att: FormInboxAttachment, key: string) => {
      if (att.downloadUrl && signedUrlIsFresh(att)) {
        triggerSignedDownload(att.downloadUrl);
        return;
      }
      if (att.contentBase64) {
        triggerBlobDownload(
          attachmentBlob({ ...att, contentBase64: att.contentBase64 }),
          att.filename,
        );
        return;
      }

      if (!messageId) {
        setError("Bijlage niet beschikbaar om te downloaden.");
        return;
      }

      setBusyName(att.filename);
      setError(null);
      try {
        const resolved = await resolveAttachment(att, key);
        if (!resolved) {
          setError(
            "Bijlage gevonden maar de inhoud kon niet worden gedownload. Probeer het opnieuw.",
          );
          return;
        }
        if (resolved.downloadUrl && signedUrlIsFresh(resolved)) {
          triggerSignedDownload(resolved.downloadUrl);
          return;
        }
        if (!resolved.contentBase64) {
          setError(
            "Bijlage gevonden maar de inhoud kon niet worden gedownload. Probeer het opnieuw.",
          );
          return;
        }
        triggerBlobDownload(
          attachmentBlob({ ...resolved, contentBase64: resolved.contentBase64 }),
          resolved.filename,
        );
      } catch (downloadError) {
        setError(
          downloadError instanceof Error && downloadError.message
            ? downloadError.message
            : "Download mislukt.",
        );
      } finally {
        setBusyName(null);
      }
    },
    [messageId, resolveAttachment],
  );

  return { resolveAttachment, download, busyName, error, setError };
}
