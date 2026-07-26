import {
  CMS_SYNC_CHANNEL,
  broadcastPublishedChrome,
  isCmsSyncChildMessage,
  type CmsPage,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";
import { storefrontOrigin } from "@/lib/cms/project-images";

const SYNC_TIMEOUT_MS = 8_000;

export type PublishedChromePush = {
  navigation: SiteNavigationContent;
  pages?: CmsPage[];
  removePageIds?: string[];
};

/**
 * Prototype-only: push published navigation (+ optional pages) into the storefront.
 *
 * After B5, the public storefront ignores localStorage — the /cms-sync iframe applies
 * chrome in-memory and BroadcastChannels other storefront tabs on the same origin.
 * Same-origin admin skips the iframe and broadcasts directly.
 */
export function pushPublishedChromeToStorefront(payload: PublishedChromePush): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const origin = storefrontOrigin();
  if (origin === window.location.origin) {
    broadcastPublishedChrome(payload);
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "CMS sync";
  iframe.style.cssText =
    "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:0";
  iframe.src = `${origin}/cms-sync`;

  let settled = false;
  const cleanup = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    window.removeEventListener("message", onMessage);
    iframe.remove();
  };

  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin) return;
    if (event.source !== iframe.contentWindow) return;
    if (!isCmsSyncChildMessage(event.data)) return;

    if (event.data.type === "sync-ready") {
      try {
        iframe.contentWindow?.postMessage(
          {
            channel: CMS_SYNC_CHANNEL,
            type: "sync-published-navigation",
            navigation: payload.navigation,
            pages: payload.pages,
            removePageIds: payload.removePageIds,
          },
          origin,
        );
      } catch (e) {
        console.warn("CMS navigation sync post failed:", e);
        cleanup();
      }
      return;
    }

    if (event.data.type === "sync-ack") {
      if (!event.data.ok) {
        console.warn("CMS navigation sync rejected:", event.data.reason);
      }
      cleanup();
    }
  };

  const timeoutId = window.setTimeout(() => {
    console.warn(
      "CMS navigation sync timed out — is the storefront running on",
      origin,
      "?",
    );
    cleanup();
  }, SYNC_TIMEOUT_MS);

  window.addEventListener("message", onMessage);
  document.body.appendChild(iframe);
}

/** @deprecated Use pushPublishedChromeToStorefront */
export function pushPublishedNavigationToStorefront(navigation: SiteNavigationContent): void {
  pushPublishedChromeToStorefront({ navigation });
}
