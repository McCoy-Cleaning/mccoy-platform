import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  CMS_SYNC_CHANNEL,
  broadcastPublishedChrome,
  parseSyncPublishedChrome,
  resolveAdminParentOrigins,
  type CmsSyncChildToParent,
} from "@mccoy/cms-schema";
import { cms } from "@/lib/cms/store";

export const Route = createFileRoute("/cms-sync")({
  head: () => ({
    meta: [
      { title: "CMS Sync — McCoy (noindex)" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CmsSyncFrame,
});

/**
 * Hidden iframe target for prototype admin → storefront published chrome sync.
 * Origin-checked postMessage only; never trusts query strings.
 * After apply, BroadcastChannels other storefront tabs (B5 public ignores localStorage).
 */
function CmsSyncFrame() {
  React.useEffect(() => {
    const allowedParents = resolveAdminParentOrigins({
      currentOrigin: window.location.origin,
      envAdminOrigin: import.meta.env.VITE_ADMIN_ORIGIN as string | undefined,
      referrer: document.referrer,
    });

    const reply = (msg: CmsSyncChildToParent, targetOrigin: string) => {
      try {
        window.parent.postMessage(msg, targetOrigin);
      } catch {
        /* ignore */
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (!allowedParents.includes(event.origin)) return;
      const chrome = parseSyncPublishedChrome(event.data);
      if (!chrome) {
        if (
          event.data &&
          typeof event.data === "object" &&
          (event.data as { channel?: string; type?: string }).channel === CMS_SYNC_CHANNEL &&
          (event.data as { type?: string }).type === "sync-published-navigation"
        ) {
          reply(
            {
              channel: CMS_SYNC_CHANNEL,
              type: "sync-ack",
              ok: false,
              reason: "Ongeldige navigatie.",
            },
            event.origin,
          );
        }
        return;
      }
      const result = cms.applyPublishedChrome(chrome);
      if (!result.ok) {
        reply(
          { channel: CMS_SYNC_CHANNEL, type: "sync-ack", ok: false, reason: result.reason },
          event.origin,
        );
        return;
      }
      // Notify the live storefront tab(s) — this iframe's memory is isolated.
      broadcastPublishedChrome(chrome);
      reply({ channel: CMS_SYNC_CHANNEL, type: "sync-ack", ok: true }, event.origin);
    };

    window.addEventListener("message", onMessage);

    for (const origin of allowedParents) {
      reply({ channel: CMS_SYNC_CHANNEL, type: "sync-ready" }, origin);
    }

    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-background text-white/40 text-xs">
      CMS sync bridge
    </div>
  );
}
