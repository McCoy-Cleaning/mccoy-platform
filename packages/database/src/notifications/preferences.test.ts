import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_NOTIFICATION_TYPES } from "@mccoy/notifications/server";

import { createFakeSupabase, ok } from "./notification-test-fixtures";

const { fakeClientRef } = vi.hoisted(() => ({
  fakeClientRef: { current: null as null | { from: (table: string) => unknown } },
}));

vi.mock("../supabase", () => ({
  createSupabaseServiceClient: () => fakeClientRef.current,
}));

const { listNotificationPreferencesForUser, setNotificationPreference } = await import(
  "./preferences"
);

describe("listNotificationPreferencesForUser", () => {
  beforeEach(() => {
    fakeClientRef.current = null;
  });

  it("returns registry defaults for every active type when no rows are stored", async () => {
    const fake = createFakeSupabase({
      notification_preferences: [ok([])],
    });
    fakeClientRef.current = fake.client;

    const result = await listNotificationPreferencesForUser("user-1");

    expect(result.map((r) => r.type).sort()).toEqual([...ACTIVE_NOTIFICATION_TYPES].sort());

    const websiteRequest = result.find((r) => r.type === "website_request.received")!;
    expect(websiteRequest.inAppEnabled).toBe(true);
    expect(websiteRequest.browserEnabled).toBe(true); // registry default: in_app + browser

    const publishSucceeded = result.find((r) => r.type === "cms.publish_succeeded")!;
    expect(publishSucceeded.inAppEnabled).toBe(true);
    expect(publishSucceeded.browserEnabled).toBe(false); // registry default: in_app only
  });

  it("merges a stored override on top of the registry default", async () => {
    const fake = createFakeSupabase({
      notification_preferences: [
        ok([
          {
            notification_type: "website_request.received",
            in_app_enabled: true,
            browser_enabled: false,
            email_enabled: false,
          },
        ]),
      ],
    });
    fakeClientRef.current = fake.client;

    const result = await listNotificationPreferencesForUser("user-1");
    const websiteRequest = result.find((r) => r.type === "website_request.received")!;

    expect(websiteRequest.browserEnabled).toBe(false);
    // Untouched types still fall back to the registry default.
    const mailboxFailed = result.find((r) => r.type === "mailbox.connection_failed")!;
    expect(mailboxFailed.browserEnabled).toBe(true);
  });
});

describe("setNotificationPreference", () => {
  beforeEach(() => {
    fakeClientRef.current = null;
  });

  it("rejects inactive/future notification types", async () => {
    const fake = createFakeSupabase({});
    fakeClientRef.current = fake.client;

    await expect(
      setNotificationPreference("user-1", "order.created", "in_app", false),
    ).rejects.toThrow(/inactive notification type/i);
  });

  it("reads the existing row and only flips the targeted channel (no clobber)", async () => {
    const fake = createFakeSupabase({
      notification_preferences: [
        ok({ in_app_enabled: true, browser_enabled: true, email_enabled: false }),
        ok(null),
      ],
    });
    fakeClientRef.current = fake.client;

    const result = await setNotificationPreference(
      "user-1",
      "cms.publish_failed",
      "browser",
      false,
    );

    expect(result).toEqual({
      type: "cms.publish_failed",
      category: "cms",
      inAppEnabled: true,
      browserEnabled: false,
    });

    const upsertCall = fake.calls.find(
      (c) => c.table === "notification_preferences" && c.method === "upsert",
    );
    expect(upsertCall?.args[0]).toEqual({
      user_id: "user-1",
      notification_type: "cms.publish_failed",
      in_app_enabled: true,
      browser_enabled: false,
      email_enabled: false,
    });
  });

  it("falls back to registry defaults when no row exists yet, then upserts the full state", async () => {
    const fake = createFakeSupabase({
      notification_preferences: [ok(null), ok(null)],
    });
    fakeClientRef.current = fake.client;

    const result = await setNotificationPreference(
      "user-1",
      "system.warning",
      "in_app",
      false,
    );

    // system.warning registry default is in_app + browser — only in_app flips.
    expect(result.inAppEnabled).toBe(false);
    expect(result.browserEnabled).toBe(true);
  });
});
