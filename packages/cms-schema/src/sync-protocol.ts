import { parseSiteNavigation, type SiteNavigationContent } from "./navigation";
import type { CmsPage } from "./types";

/**
 * Prototype bridge: admin (:5174) → storefront (:5173) published navigation (+ pages).
 * Mirrors preview/edit postMessage style — no shared cross-origin localStorage.
 */
export const CMS_SYNC_CHANNEL = "mccoy-cms-sync-v1";

/**
 * Same-origin BroadcastChannel so the /cms-sync iframe (or same-origin admin)
 * can update the live storefront tab after B5 dropped public localStorage.
 */
export const CMS_SYNC_BROADCAST = "mccoy-cms-published-chrome-v1";

export type CmsSyncParentToChild = {
  channel: typeof CMS_SYNC_CHANNEL;
  type: "sync-published-navigation";
  navigation: SiteNavigationContent;
  /** Upsert these published pages into the storefront chrome store (e.g. after Opslaan). */
  pages?: CmsPage[];
  /** Remove published pages by id (e.g. after delete). */
  removePageIds?: string[];
};

export type CmsSyncChildToParent =
  | {
      channel: typeof CMS_SYNC_CHANNEL;
      type: "sync-ready";
    }
  | {
      channel: typeof CMS_SYNC_CHANNEL;
      type: "sync-ack";
      ok: true;
    }
  | {
      channel: typeof CMS_SYNC_CHANNEL;
      type: "sync-ack";
      ok: false;
      reason: string;
    };

export type CmsPublishedChromeBroadcast = {
  channel: typeof CMS_SYNC_BROADCAST;
  navigation: SiteNavigationContent;
  pages?: CmsPage[];
  removePageIds?: string[];
};

function isStringIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && id.length > 0);
}

function isCmsPageArray(value: unknown): value is CmsPage[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (p) =>
      !!p &&
      typeof p === "object" &&
      typeof (p as CmsPage).id === "string" &&
      typeof (p as CmsPage).slug === "string" &&
      typeof (p as CmsPage).title === "string",
  );
}

export function isCmsSyncParentMessage(data: unknown): data is CmsSyncParentToChild {
  if (!data || typeof data !== "object") return false;
  const msg = data as CmsSyncParentToChild;
  if (msg.channel !== CMS_SYNC_CHANNEL || msg.type !== "sync-published-navigation") return false;
  if (parseSiteNavigation(msg.navigation) == null) return false;
  if (msg.pages !== undefined && !isCmsPageArray(msg.pages)) return false;
  if (msg.removePageIds !== undefined && !isStringIdArray(msg.removePageIds)) return false;
  return true;
}

export function isCmsSyncChildMessage(data: unknown): data is CmsSyncChildToParent {
  if (!data || typeof data !== "object") return false;
  const msg = data as CmsSyncChildToParent;
  if (msg.channel !== CMS_SYNC_CHANNEL) return false;
  if (msg.type === "sync-ready") return true;
  if (msg.type === "sync-ack") {
    if (msg.ok === true) return true;
    return msg.ok === false && typeof msg.reason === "string";
  }
  return false;
}

export function parseSyncPublishedNavigation(
  data: unknown,
): SiteNavigationContent | null {
  if (!isCmsSyncParentMessage(data)) return null;
  return parseSiteNavigation(data.navigation);
}

export function parseSyncPublishedChrome(data: unknown): {
  navigation: SiteNavigationContent;
  pages?: CmsPage[];
  removePageIds?: string[];
} | null {
  if (!isCmsSyncParentMessage(data)) return null;
  const navigation = parseSiteNavigation(data.navigation);
  if (!navigation) return null;
  return {
    navigation,
    pages: data.pages,
    removePageIds: data.removePageIds,
  };
}

export function isCmsPublishedChromeBroadcast(
  data: unknown,
): data is CmsPublishedChromeBroadcast {
  if (!data || typeof data !== "object") return false;
  const msg = data as CmsPublishedChromeBroadcast;
  if (msg.channel !== CMS_SYNC_BROADCAST) return false;
  if (parseSiteNavigation(msg.navigation) == null) return false;
  if (msg.pages !== undefined && !isCmsPageArray(msg.pages)) return false;
  if (msg.removePageIds !== undefined && !isStringIdArray(msg.removePageIds)) return false;
  return true;
}

export function broadcastPublishedChrome(payload: {
  navigation: SiteNavigationContent;
  pages?: CmsPage[];
  removePageIds?: string[];
}): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(CMS_SYNC_BROADCAST);
    const message: CmsPublishedChromeBroadcast = {
      channel: CMS_SYNC_BROADCAST,
      navigation: payload.navigation,
      pages: payload.pages,
      removePageIds: payload.removePageIds,
    };
    bc.postMessage(message);
    // Closing immediately after postMessage can drop delivery in Chromium.
    // Defer close so same-origin storefront tabs actually receive the chrome update.
    window.setTimeout(() => {
      try {
        bc.close();
      } catch {
        /* ignore */
      }
    }, 250);
  } catch {
    /* BroadcastChannel unavailable */
  }
}
