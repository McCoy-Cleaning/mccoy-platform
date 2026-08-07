import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  dismissAdminNotification,
  listAdminNotifications,
  listAdminNotificationPreferences,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  openAdminNotification,
} from "@/lib/api/notifications.functions";
import { emitPlatformEvent } from "@/lib/platform-events";
import { getAdminRealtimeSupabase } from "@/lib/supabase-browser";
import { adminHydrateRealtimeAccessToken } from "@/lib/api/admin-auth.functions";
import { refreshAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";

import { ensurePlatformToastBridge } from "./toast-bridge";
import type { AdminNotificationItem, NotificationServiceState } from "./types";
import {
  encodeWebsiteRequestInboxId,
  resolveInquiryNotificationHref,
} from "./destinations";

ensurePlatformToastBridge();

const BROADCAST_CHANNEL_NAME = "mccoy-admin-notifications";
const REFRESH_DEBOUNCE_MS = 400;
const HEARTBEAT_INTERVAL_MS = 4_000;
const HEARTBEAT_STALE_MS = 11_000;
const MAX_TOASTED_PER_REFRESH = 5;
/** Fallback when Realtime publication is missing or the channel drops. */
const POLL_INTERVAL_MS = 15_000;

type BroadcastMutationOp = "read" | "read-all" | "dismiss" | "open";

type BroadcastMessage =
  | { kind: "heartbeat"; tabId: string; ts: number }
  | { kind: "bye"; tabId: string }
  | { kind: "mutated"; op: BroadcastMutationOp; notificationId?: string; ts: number };

type Listener = (state: NotificationServiceState) => void;

function toastKindForSeverity(severity: string): "success" | "info" | "warning" | "error" {
  if (severity === "success") return "success";
  if (severity === "warning") return "warning";
  if (severity === "error" || severity === "critical") return "error";
  return "info";
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

class AdminNotificationService {
  private readonly userId: string;
  private readonly tabId: string =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  private readonly listeners = new Set<Listener>();
  private readonly peers = new Map<string, number>();

  private items: AdminNotificationItem[] = [];
  private unreadCount = 0;
  private status: NotificationServiceState["status"] = "idle";
  private error: string | null = null;
  /** Per-type "browser" channel preference, from Settings → Meldingsvoorkeuren. Fails closed (unset ⇒ no desktop popup). */
  private browserEnabledByType = new Map<string, boolean>();

  private started = false;
  private hasLoadedOnce = false;
  private channelDisconnected = false;

  private channel: RealtimeChannel | null = null;
  private broadcast: BroadcastChannel | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private realtimeAuthRenewTimer: ReturnType<typeof setTimeout> | undefined;
  private realtimeExpiresAt: number | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  getState(): NotificationServiceState {
    return {
      status: this.status,
      items: this.items,
      unreadCount: this.unreadCount,
      error: this.error,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.loadInitial();
    void this.refreshPreferences();
    this.setupRealtime();
    this.setupBroadcastChannel();
    this.setupPolling();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.teardownRealtime();
    this.teardownBroadcastChannel();
    this.teardownPolling();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
    }
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  async loadInitial(): Promise<void> {
    this.status = "loading";
    this.notify();
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      const result = await listAdminNotifications({ data: {} });
      if (!result.ok) {
        this.status = "error";
        this.error = result.error;
        this.notify();
        emitPlatformEvent({
          type: "notification-refresh-failed",
          errorCode: "code" in result ? String(result.code) : "unknown",
        });
        return;
      }

      const wasErrored = this.status === "error";
      this.applyFetchResult(result.items, result.unreadCount, !this.hasLoadedOnce);
      this.hasLoadedOnce = true;
      if (wasErrored) {
        emitPlatformEvent({ type: "notification-connection-restored" });
      }
    } catch {
      this.status = "error";
      this.error = "Kon meldingen niet laden.";
      this.notify();
      emitPlatformEvent({ type: "notification-refresh-failed", errorCode: "network" });
    }
  }

  /** Refreshes the per-type browser-channel preference cache used to gate desktop popups. */
  async refreshPreferences(): Promise<void> {
    try {
      const result = await listAdminNotificationPreferences();
      if (!result.ok) return;
      const next = new Map<string, boolean>();
      for (const pref of result.preferences) {
        next.set(pref.type, pref.browserEnabled);
      }
      this.browserEnabledByType = next;
    } catch {
      // Keep the previous (safer, fail-closed) cache on transient failure.
    }
  }

  async markRead(notificationId: string): Promise<void> {
    this.applyLocalMutation("read", notificationId);
    this.broadcastMutation("read", notificationId);
    try {
      const result = await markAdminNotificationRead({ data: { notificationId } });
      if (result.ok) {
        emitPlatformEvent({ type: "notification-read", notificationId });
      }
    } catch {
      // Best-effort optimistic update — next refresh() reconciles any drift.
    }
  }

  async markAllRead(): Promise<void> {
    this.applyLocalMutation("read-all");
    this.broadcastMutation("read-all");
    try {
      await markAllAdminNotificationsRead();
    } catch {
      // Reconciled on next refresh().
    }
  }

  async dismiss(notificationId: string): Promise<void> {
    this.applyLocalMutation("dismiss", notificationId);
    this.broadcastMutation("dismiss", notificationId);
    try {
      await dismissAdminNotification({ data: { notificationId } });
    } catch {
      // Reconciled on next refresh().
    }
  }

  /** Marks opened (implies read) and resolves the allowlisted destination to navigate to. */
  async open(notificationId: string): Promise<string> {
    this.applyLocalMutation("open", notificationId);
    this.broadcastMutation("open", notificationId);
    try {
      const result = await openAdminNotification({ data: { notificationId } });
      if (result.ok) {
        emitPlatformEvent({ type: "notification-read", notificationId });
        return result.destinationPath;
      }
    } catch {
      // Fall through to the safe default below.
    }
    return "/admin";
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  private applyFetchResult(
    items: AdminNotificationItem[],
    unreadCount: number,
    isInitial: boolean,
  ): void {
    if (!isInitial) {
      const previousIds = new Set(this.items.map((item) => item.recipientId));
      const newlyArrived = items.filter(
        (item) => !previousIds.has(item.recipientId) && !item.readAt && !item.dismissedAt,
      );
      for (const item of newlyArrived.slice(0, MAX_TOASTED_PER_REFRESH)) {
        this.emitArrival(item);
      }
    } else {
      // If the page loads after a reply (Realtime missed / no publication yet),
      // still surface a toast for unread items from the last 15 minutes.
      const recentCutoff = Date.now() - 15 * 60_000;
      const recentUnread = items.filter(
        (item) =>
          !item.readAt &&
          !item.dismissedAt &&
          new Date(item.createdAt).getTime() >= recentCutoff,
      );
      for (const item of recentUnread.slice(0, MAX_TOASTED_PER_REFRESH)) {
        this.emitArrival(item, { preferInAppToast: true });
      }
    }

    this.items = items;
    this.unreadCount = unreadCount;
    this.status = "ready";
    this.error = null;
    this.notify();
  }

  private emitArrival(
    item: AdminNotificationItem,
    options?: { preferInAppToast?: boolean },
  ): void {
    emitPlatformEvent({
      type: "notification-received",
      notificationId: item.notificationId,
      notificationType: item.type,
      category: item.category,
    });
    if (item.category === "requests") {
      refreshAdminRequestsUnreadBadge();
    }
    const useBrowserPopup =
      !options?.preferInAppToast &&
      typeof document !== "undefined" &&
      document.hidden;
    if (useBrowserPopup) {
      this.maybeShowBrowserNotification(item);
      return;
    }
    const href = resolveInquiryNotificationHref({
      type: item.type,
      destinationPath: item.destinationPath,
      entityType: item.entityType,
      entityId: item.entityId,
      metadata: item.metadata,
      encodeRequestMessageId: encodeWebsiteRequestInboxId,
    });
    emitPlatformEvent({
      type: "ui-toast",
      kind: toastKindForSeverity(item.severity),
      title: item.title,
      description: item.body ?? "Open meldingen om te bekijken.",
      dedupeKey: `notification:${item.notificationId}`,
      href,
    });
  }

  private applyLocalMutation(op: BroadcastMutationOp, notificationId?: string): void {
    const now = new Date().toISOString();
    let changed = false;

    if (op === "dismiss") {
      const before = this.items.length;
      this.items = this.items.filter((item) => item.notificationId !== notificationId);
      changed = this.items.length !== before;
    } else {
      this.items = this.items.map((item) => {
        if (op !== "read-all" && item.notificationId !== notificationId) return item;
        if (item.readAt) return item;
        changed = true;
        return {
          ...item,
          seenAt: item.seenAt ?? now,
          readAt: now,
          openedAt: op === "open" ? (item.openedAt ?? now) : item.openedAt,
        };
      });
    }

    if (changed) {
      this.unreadCount = this.items.filter((item) => !item.readAt && !item.dismissedAt).length;
      this.notify();
    }
  }

  private maybeShowBrowserNotification(item: AdminNotificationItem): void {
    if (!isBrowserNotificationSupported()) return;
    if (Notification.permission !== "granted") return;
    // Fails closed: no cached preference (not yet loaded, or type not implemented) ⇒ no popup.
    if (this.browserEnabledByType.get(item.type) !== true) return;
    if (!this.isLeaderTab()) return;
    try {
      const href = resolveInquiryNotificationHref({
        type: item.type,
        destinationPath: item.destinationPath,
        entityType: item.entityType,
        entityId: item.entityId,
        metadata: item.metadata,
        encodeRequestMessageId: encodeWebsiteRequestInboxId,
      });
      const notification = new Notification(item.title, {
        body: item.body ?? undefined,
        silent: true,
        tag: item.notificationId,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (href) window.location.assign(href);
      };
    } catch {
      // Notification constructor can throw in restricted/embedded contexts — ignore.
    }
  }

  private async applyRealtimeAccessToken(): Promise<boolean> {
    const supabase = getAdminRealtimeSupabase();
    if (!supabase) return false;
    const hydrated = await adminHydrateRealtimeAccessToken();
    if (!hydrated.ok) return false;
    const { accessToken, expiresAt } = hydrated.hydration;
    supabase.realtime.setAuth(accessToken);
    this.realtimeExpiresAt = expiresAt;
    this.scheduleRealtimeAuthRenewal();
    return true;
  }

  private scheduleRealtimeAuthRenewal(): void {
    if (this.realtimeAuthRenewTimer) {
      clearTimeout(this.realtimeAuthRenewTimer);
      this.realtimeAuthRenewTimer = undefined;
    }
    if (!this.realtimeExpiresAt) return;
    const renewInMs = Math.max(15_000, this.realtimeExpiresAt - Date.now() - 60_000);
    this.realtimeAuthRenewTimer = setTimeout(() => {
      void this.applyRealtimeAccessToken().then((ok) => {
        if (!ok) this.channelDisconnected = true;
      });
    }, renewInMs);
  }

  private setupRealtime(): void {
    void (async () => {
      const supabase = getAdminRealtimeSupabase();
      if (!supabase) return;
      const authed = await this.applyRealtimeAccessToken();
      if (!authed || !this.started) return;

      this.teardownRealtimeChannelOnly();
      this.channel = supabase
        .channel(`admin-notifications-${this.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_recipients",
            filter: `user_id=eq.${this.userId}`,
          },
          () => this.scheduleRefresh(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            if (this.channelDisconnected) this.scheduleRefresh();
            this.channelDisconnected = false;
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.channelDisconnected = true;
            // Re-auth via cookie session then resubscribe shortly.
            void this.applyRealtimeAccessToken();
          }
        });
    })();
  }

  private teardownRealtimeChannelOnly(): void {
    if (this.channel) {
      void this.channel.unsubscribe();
      this.channel = null;
    }
  }

  private teardownRealtime(): void {
    if (this.realtimeAuthRenewTimer) {
      clearTimeout(this.realtimeAuthRenewTimer);
      this.realtimeAuthRenewTimer = undefined;
    }
    this.realtimeExpiresAt = null;
    this.teardownRealtimeChannelOnly();
    const supabase = getAdminRealtimeSupabase();
    if (supabase) {
      try {
        supabase.realtime.setAuth("");
      } catch {
        // ignore
      }
    }
  }

  private setupPolling(): void {
    if (typeof window === "undefined") return;
    this.teardownPolling();
    this.pollTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      this.scheduleRefresh();
    }, POLL_INTERVAL_MS);
  }

  private teardownPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === "undefined") return;
    this.broadcast = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    this.broadcast.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.kind === "heartbeat") {
        this.peers.set(message.tabId, message.ts);
        return;
      }
      if (message.kind === "bye") {
        this.peers.delete(message.tabId);
        return;
      }
      if (message.kind === "mutated") {
        this.applyLocalMutation(message.op, message.notificationId);
      }
    };
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  private teardownBroadcastChannel(): void {
    if (this.broadcast) {
      this.broadcast.postMessage({ kind: "bye", tabId: this.tabId } satisfies BroadcastMessage);
      this.broadcast.close();
      this.broadcast = null;
    }
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.peers.clear();
  }

  private sendHeartbeat(): void {
    const ts = Date.now();
    this.peers.set(this.tabId, ts);
    this.broadcast?.postMessage({ kind: "heartbeat", tabId: this.tabId, ts } satisfies BroadcastMessage);
    for (const [id, lastSeen] of this.peers) {
      if (ts - lastSeen > HEARTBEAT_STALE_MS) this.peers.delete(id);
    }
  }

  /** Elected via lexicographically-smallest live tab id — dedupes desktop notifications across tabs. */
  private isLeaderTab(): boolean {
    if (!this.broadcast) return true;
    const now = Date.now();
    let leader = this.tabId;
    for (const [id, lastSeen] of this.peers) {
      if (now - lastSeen > HEARTBEAT_STALE_MS) continue;
      if (id < leader) leader = id;
    }
    return leader === this.tabId;
  }

  private broadcastMutation(op: BroadcastMutationOp, notificationId?: string): void {
    this.broadcast?.postMessage({
      kind: "mutated",
      op,
      notificationId,
      ts: Date.now(),
    } satisfies BroadcastMessage);
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, REFRESH_DEBOUNCE_MS);
  }

  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== "undefined" && !document.hidden) {
      this.scheduleRefresh();
      void this.refreshPreferences();
    }
  };

  private readonly handleOnline = (): void => {
    this.scheduleRefresh();
  };

  private readonly handleBeforeUnload = (): void => {
    this.broadcast?.postMessage({ kind: "bye", tabId: this.tabId } satisfies BroadcastMessage);
  };
}

const registry = new Map<string, AdminNotificationService>();

/** One service instance per signed-in staff user id; refcounted via `subscribe()`. */
export function getAdminNotificationService(userId: string): AdminNotificationService {
  const existing = registry.get(userId);
  if (existing) return existing;

  // Guard against a stale instance from a previous account in the same tab (rare — dev/testing).
  for (const [key, service] of registry) {
    if (key !== userId) {
      service.stop();
      registry.delete(key);
    }
  }

  const created = new AdminNotificationService(userId);
  registry.set(userId, created);
  return created;
}

/** Call on sign-out so subscriptions/timers stop immediately rather than waiting for unmount. */
export function disposeAllAdminNotificationServices(): void {
  for (const service of registry.values()) service.stop();
  registry.clear();
}

export type { AdminNotificationService };
