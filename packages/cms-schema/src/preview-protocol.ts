import type { CmsPage, PageOverrides, PreviewSnapshot } from "./types";

export const CMS_PREVIEW_CHANNEL = "mccoy-cms-preview-v1";

export type PreviewParentToChild =
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "preview-snapshot";
      snapshot: PreviewSnapshot;
    }
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "preview-clear";
    }
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "edit-draft";
      pageId: string;
      page: CmsPage;
      overrides: PageOverrides;
      version: number;
    }
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "edit-draft-clear";
      pageId: string;
    };

export type PreviewChildToParent =
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "preview-ready";
      pageId: string;
    }
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "edit-ready";
      pageId: string;
    }
  | {
      channel: typeof CMS_PREVIEW_CHANNEL;
      type: "draft-override";
      pageId: string;
      key: string;
      value: string;
    };

export function isPreviewParentMessage(data: unknown): data is PreviewParentToChild {
  if (!data || typeof data !== "object") return false;
  const msg = data as PreviewParentToChild;
  return (
    msg.channel === CMS_PREVIEW_CHANNEL &&
    (msg.type === "preview-snapshot" ||
      msg.type === "preview-clear" ||
      msg.type === "edit-draft" ||
      msg.type === "edit-draft-clear")
  );
}

export function isEditDraftMessage(
  data: unknown,
): data is Extract<PreviewParentToChild, { type: "edit-draft" }> {
  if (!data || typeof data !== "object") return false;
  const msg = data as PreviewParentToChild;
  return (
    msg.channel === CMS_PREVIEW_CHANNEL &&
    msg.type === "edit-draft" &&
    typeof msg.pageId === "string" &&
    !!msg.page &&
    typeof msg.version === "number"
  );
}

export function isPreviewChildMessage(
  data: unknown,
): data is Extract<PreviewChildToParent, { type: "preview-ready" }> {
  if (!data || typeof data !== "object") return false;
  const msg = data as PreviewChildToParent;
  return msg.channel === CMS_PREVIEW_CHANNEL && msg.type === "preview-ready" && typeof msg.pageId === "string";
}

export function isEditReadyMessage(
  data: unknown,
): data is Extract<PreviewChildToParent, { type: "edit-ready" }> {
  if (!data || typeof data !== "object") return false;
  const msg = data as PreviewChildToParent;
  return msg.channel === CMS_PREVIEW_CHANNEL && msg.type === "edit-ready" && typeof msg.pageId === "string";
}

export function isDraftOverrideMessage(
  data: unknown,
): data is Extract<PreviewChildToParent, { type: "draft-override" }> {
  if (!data || typeof data !== "object") return false;
  const msg = data as PreviewChildToParent;
  return (
    msg.channel === CMS_PREVIEW_CHANNEL &&
    msg.type === "draft-override" &&
    typeof msg.pageId === "string" &&
    typeof msg.key === "string" &&
    typeof msg.value === "string"
  );
}

export function sanitizePreviewSnapshot(snapshot: PreviewSnapshot): PreviewSnapshot {
  return {
    pageId: snapshot.pageId,
    version: snapshot.version,
    capturedAt: snapshot.capturedAt,
    page: structuredClone(snapshot.page),
    overrides: { ...snapshot.overrides },
  };
}
