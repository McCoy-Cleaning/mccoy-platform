import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, dbError, ok, type FakeCall } from "./notification-test-fixtures";
import type { NotificationOutboxRow } from "./types";

const { fakeClientRef } = vi.hoisted(() => ({
  fakeClientRef: { current: null as null | { from: (table: string) => unknown } },
}));

vi.mock("../supabase", () => ({
  createSupabaseServiceClient: () => fakeClientRef.current,
}));

const { processNotificationOutbox } = await import("./worker");

function outboxRow(overrides: Partial<NotificationOutboxRow> = {}): NotificationOutboxRow {
  return {
    id: "outbox-1",
    type: "website_request.received",
    payload: {
      title: "Nieuwe aanvraag",
      body: null,
      destinationPath: "/inquiries",
      entityType: "website_request",
      entityId: "req-1",
      metadata: { requestId: "a0000000-0000-4000-8000-000000000101" },
    },
    dedupe_key: null,
    actor_user_id: null,
    created_at: "2026-07-25T00:00:00.000Z",
    processed_at: null,
    failed_at: null,
    attempts: 0,
    last_error: null,
    ...overrides,
  };
}

function callsFor(calls: FakeCall[], table: string) {
  return calls.filter((c) => c.table === table);
}

describe("processNotificationOutbox (mocked Supabase — no live DB)", () => {
  beforeEach(() => {
    fakeClientRef.current = null;
  });

  it("resolves active_staff recipients, inserts a notification, and marks the outbox row processed", async () => {
    const row = outboxRow();
    const fake = createFakeSupabase({
      notification_outbox: [ok([row]), ok(null)],
      users: [ok([{ id: "staff-1" }, { id: "staff-2" }])],
      notifications: [ok({ id: "notif-1" })],
      notification_recipients: [ok(null)],
    });
    fakeClientRef.current = fake.client;

    const result = await processNotificationOutbox(10);

    expect(result).toEqual({ processed: 1, failed: 0, skipped: 0 });

    const recipientCalls = callsFor(fake.calls, "notification_recipients");
    const upsertCall = recipientCalls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toEqual([
      { notification_id: "notif-1", user_id: "staff-1" },
      { notification_id: "notif-1", user_id: "staff-2" },
    ]);

    const outboxCalls = callsFor(fake.calls, "notification_outbox");
    expect(outboxCalls.some((c) => c.method === "update")).toBe(true);
  });

  it("dedupes via dedupe_key: an existing notification is not recreated, only recipients are ensured", async () => {
    const row = outboxRow({
      type: "mailbox.connection_failed",
      dedupe_key: "mailbox.connection_failed:2026072514",
      payload: {
        title: "Postvak-verbinding mislukt",
        metadata: { provider: "graph", errorCode: "token_expired" },
      },
    });
    const fake = createFakeSupabase({
      notification_outbox: [ok([row]), ok(null)],
      users: [ok([{ id: "staff-1" }])],
      // First (and only) `.from("notifications")` call is the dedupe lookup — found.
      notifications: [ok({ id: "existing-notif" })],
      notification_recipients: [ok(null)],
    });
    fakeClientRef.current = fake.client;

    const result = await processNotificationOutbox(10);

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });

    const notificationCalls = callsFor(fake.calls, "notifications");
    // Only the maybeSingle dedupe lookup — no insert for an already-existing notification.
    expect(notificationCalls.some((c) => c.method === "insert")).toBe(false);
    expect(notificationCalls.some((c) => c.method === "maybeSingle")).toBe(true);

    const upsertCall = callsFor(fake.calls, "notification_recipients").find(
      (c) => c.method === "upsert",
    );
    expect(upsertCall?.args[0]).toEqual([{ notification_id: "existing-notif", user_id: "staff-1" }]);
  });

  it("marks the outbox row failed for an inactive/future notification type without throwing the loop", async () => {
    const row = outboxRow({ type: "order.created", dedupe_key: null });
    const fake = createFakeSupabase({
      notification_outbox: [ok([row]), ok(null)],
    });
    fakeClientRef.current = fake.client;

    const result = await processNotificationOutbox(10);

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });

    const outboxCalls = callsFor(fake.calls, "notification_outbox");
    const updateCall = outboxCalls.find((c) => c.method === "update");
    expect(updateCall).toBeTruthy();
    const updatePayload = updateCall?.args[0] as { last_error?: string };
    expect(updatePayload.last_error).toMatch(/inactive notification type/i);
  });

  it("marks the outbox row failed when metadata fails the strict allowlist schema", async () => {
    // cms.publish_failed uses the `actor_only` resolver — no DB query, needs actor_user_id.
    const row = outboxRow({
      type: "cms.publish_failed",
      dedupe_key: null,
      actor_user_id: "actor-1",
      payload: {
        title: "Publiceren mislukt",
        // `stackTrace` is not in the allowlisted schema — must be rejected, not silently dropped.
        metadata: { pageId: "a0000000-0000-4000-8000-000000000301", stackTrace: "oops" },
      },
    });
    const fake = createFakeSupabase({
      notification_outbox: [ok([row]), ok(null)],
    });
    fakeClientRef.current = fake.client;

    const result = await processNotificationOutbox(10);

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
    // Metadata validation fails before any notifications-table write is attempted.
    expect(callsFor(fake.calls, "notifications")).toHaveLength(0);
  });

  it("skips gracefully when the resolver finds zero recipients (no notification row created)", async () => {
    const row = outboxRow();
    const fake = createFakeSupabase({
      notification_outbox: [ok([row]), ok(null)],
      users: [ok([])],
    });
    fakeClientRef.current = fake.client;

    const result = await processNotificationOutbox(10);

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 1 });
    expect(callsFor(fake.calls, "notifications")).toHaveLength(0);
  });

  it("surfaces a resolver DB error as a failed outbox row instead of throwing out of the batch", async () => {
    const row = outboxRow();
    const fake = createFakeSupabase({
      notification_outbox: [ok([row]), ok(null)],
      users: [dbError("connection reset")],
    });
    fakeClientRef.current = fake.client;

    const result = await processNotificationOutbox(10);

    expect(result).toEqual({ processed: 0, failed: 1, skipped: 0 });
  });
});
