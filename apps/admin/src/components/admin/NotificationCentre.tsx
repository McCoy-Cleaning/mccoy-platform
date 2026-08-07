import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Globe2,
  Inbox,
  Loader2,
  Mail,
  Monitor,
  X,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from "@/lib/notifications/notification-service";
import type { AdminNotificationItem } from "@/lib/notifications/types";
import { useAdminNotifications } from "@/lib/notifications/use-admin-notifications";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; color: string }
> = {
  requests: { icon: Inbox, label: "Aanvragen", color: "#22d3ee" },
  cms: { icon: Globe2, label: "Content", color: "#a78bfa" },
  mailbox: { icon: Mail, label: "Mailbox", color: "#38bdf8" },
  system: { icon: AlertTriangle, label: "Systeem", color: "#f59e0b" },
};

function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { icon: Bell, label: "Melding", color: "#94a3b8" };
}

function severityDotClass(severity: string): string {
  if (severity === "success") return "bg-emerald-400";
  if (severity === "warning") return "bg-amber-400";
  if (severity === "error" || severity === "critical") return "bg-red-400";
  return "bg-[#1e88e5]";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gisteren";
  return `${days}d geleden`;
}

export function NotificationCentre({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { status, items, unreadCount, error, refresh, markRead, markAllRead, dismiss, open } =
    useAdminNotifications();
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [attention, setAttention] = React.useState(false);
  const prevUnreadRef = React.useRef<number | null>(null);

  // Flash the bell when unread count rises so staff notice without opening the panel.
  React.useEffect(() => {
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = unreadCount;
    if (prev == null) return;
    if (unreadCount > prev) {
      setAttention(true);
      const t = window.setTimeout(() => setAttention(false), 8_000);
      return () => window.clearTimeout(t);
    }
    if (unreadCount === 0) setAttention(false);
  }, [unreadCount]);

  const handleOpenItem = async (item: AdminNotificationItem) => {
    if (busyId) return;
    setBusyId(item.notificationId);
    try {
      const destination = await open(item.notificationId);
      setPanelOpen(false);
      setAttention(false);
      void navigate({ href: destination });
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkRead = async (
    item: AdminNotificationItem,
    event: Pick<React.SyntheticEvent, "stopPropagation">,
  ) => {
    event.stopPropagation();
    if (item.readAt || busyId) return;
    setBusyId(item.notificationId);
    try {
      await markRead(item.notificationId);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (
    item: AdminNotificationItem,
    event: Pick<React.SyntheticEvent, "stopPropagation">,
  ) => {
    event.stopPropagation();
    if (busyId) return;
    setBusyId(item.notificationId);
    try {
      await dismiss(item.notificationId);
    } finally {
      setBusyId(null);
    }
  };

  const hasUnread = unreadCount > 0;

  return (
    <Popover
      open={panelOpen}
      onOpenChange={(open) => {
        setPanelOpen(open);
        if (open) setAttention(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hasUnread ? `Meldingen, ${unreadCount} ongelezen` : "Meldingen"}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-visible rounded-lg border text-white/70 transition",
            "h-9 w-9 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white",
            hasUnread && "border-sky-400/40 bg-sky-500/15 text-white",
            attention && "animate-pulse border-sky-300/70 bg-sky-500/25 text-white shadow-[0_0_0_3px_rgba(56,189,248,0.35)]",
            className,
          )}
        >
          {hasUnread ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {hasUnread ? (
            <span
              className={cn(
                "absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-none text-white shadow-[0_0_0_2px_#0a0a0f]",
                attention ? "bg-rose-500" : "bg-[#1e88e5]",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
          {attention ? (
            <span
              className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-sky-400/80 ring-offset-2 ring-offset-[#0a0a0f]"
              aria-hidden
            />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border-white/10 bg-[#0f0f16] p-0 text-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Meldingen</h2>
          <div className="flex items-center gap-1.5">
            <BrowserPermissionHint />
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Alles gelezen
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          {status === "loading" && items.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Meldingen laden…
            </div>
          )}

          {status === "error" && (
            <div className="space-y-2 p-6 text-center">
              <p className="text-xs text-red-300">{error ?? "Meldingen konden niet laden."}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
              >
                Opnieuw proberen
              </button>
            </div>
          )}

          {status !== "loading" && status !== "error" && items.length === 0 && (
            <div className="p-8 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-white/25" />
              <p className="text-sm text-white/60">Geen meldingen</p>
              <p className="mt-1 text-xs text-white/35">
                Je ontvangt hier updates over aanvragen, content en systeemstatus.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <ul className="divide-y divide-white/5">
              {items.map((item) => {
                const meta = categoryMeta(item.category);
                const Icon = meta.icon;
                const unread = !item.readAt;
                const busy = busyId === item.notificationId;
                return (
                  <li key={item.recipientId}>
                    <div
                      role="button"
                      tabIndex={busy ? -1 : 0}
                      aria-disabled={busy || undefined}
                      onClick={() => void handleOpenItem(item)}
                      onKeyDown={(e) => {
                        if (busy) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void handleOpenItem(item);
                        }
                      }}
                      className={cn(
                        "group flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e88e5]",
                        busy && "cursor-default opacity-60",
                        unread && "bg-white/[0.02]",
                      )}
                    >
                      <div
                        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10"
                        style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "truncate text-sm",
                              unread ? "font-semibold text-white" : "font-medium text-white/70",
                            )}
                          >
                            {item.title}
                          </p>
                          {unread && (
                            <span
                              className={cn(
                                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                                severityDotClass(item.severity),
                              )}
                              aria-hidden
                            />
                          )}
                        </div>
                        {item.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-white/50">{item.body}</p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/35">
                          <span>{meta.label}</span>
                          <span>·</span>
                          <span>{relativeTime(item.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {unread && (
                          <button
                            type="button"
                            aria-label="Markeer als gelezen"
                            title="Markeer als gelezen"
                            disabled={busy}
                            onClick={(e) => void handleMarkRead(item, e)}
                            className="grid h-6 w-6 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Melding verwijderen"
                          title="Melding verwijderen"
                          disabled={busy}
                          onClick={(e) => void handleDismiss(item, e)}
                          className="grid h-6 w-6 place-items-center rounded-md text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Requests the browser-level Notification permission (opt-in gesture required by
 * every browser) and, once granted, links to Settings → Meldingsvoorkeuren where
 * the per-type "browser" channel is actually enabled/disabled server-side. This
 * component never itself decides which types popup — see `NotificationService`.
 */
function BrowserPermissionHint() {
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  React.useEffect(() => {
    setPermission(getBrowserNotificationPermission());
  }, []);

  if (permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <Link
        to="/admin/settings"
        title="Bureaubladmeldingen zijn toegestaan — beheer per type in Instellingen"
        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-white/50 transition hover:bg-white/10 hover:text-white"
      >
        <Monitor className="h-3.5 w-3.5" />
      </Link>
    );
  }

  if (permission === "denied") {
    return (
      <span
        title="Bureaubladmeldingen zijn geblokkeerd in de browserinstellingen"
        className="inline-flex h-7 items-center px-2 text-white/25"
      >
        <Monitor className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void requestBrowserNotificationPermission().then(setPermission)}
      title="Bureaubladmeldingen inschakelen (alleen als dit tabblad niet actief is)"
      className="h-7 px-2 text-white/60 hover:bg-white/10 hover:text-white"
    >
      <BellRing className="h-3.5 w-3.5" />
    </Button>
  );
}
