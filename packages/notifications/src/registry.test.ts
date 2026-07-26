import { describe, expect, it } from "vitest";

import {
  ACTIVE_NOTIFICATION_TYPES,
  assertNotificationRegistryComplete,
  getNotificationDefinition,
  isActiveNotificationType,
  isNotificationType,
  listActiveNotificationDefinitions,
  NOTIFICATION_REGISTRY,
  NOTIFICATION_TYPES,
  parseNotificationMetadata,
} from "./index";

describe("notification registry allowlist", () => {
  it("covers every NOTIFICATION_TYPES entry exactly once", () => {
    expect(() => assertNotificationRegistryComplete()).not.toThrow();
    expect(Object.keys(NOTIFICATION_REGISTRY).sort()).toEqual(
      [...NOTIFICATION_TYPES].sort(),
    );
  });

  it("marks only Stage C–D types as active", () => {
    const active = listActiveNotificationDefinitions().map((d) => d.type).sort();
    expect(active).toEqual([...ACTIVE_NOTIFICATION_TYPES].sort());

    for (const type of ACTIVE_NOTIFICATION_TYPES) {
      expect(getNotificationDefinition(type).active).toBe(true);
      expect(isActiveNotificationType(type)).toBe(true);
    }

    expect(getNotificationDefinition("order.created").active).toBe(false);
    expect(isActiveNotificationType("order.created")).toBe(false);
  });

  it("uses allowlisted recipient resolvers and categories", () => {
    for (const type of NOTIFICATION_TYPES) {
      const def = getNotificationDefinition(type);
      expect(def.recipientResolver).toMatch(
        /^(active_staff|actor_only|future_)/,
      );
      expect(def.defaultChannels.length).toBeGreaterThan(0);
      expect(["none", "dedupe_key"]).toContain(def.dedupeStrategy);
    }
  });

  it("type guards reject unknown strings", () => {
    expect(isNotificationType("website_request.received")).toBe(true);
    expect(isNotificationType("not.a.type")).toBe(false);
    expect(isNotificationType(null)).toBe(false);
  });
});

describe("notification metadata validation", () => {
  it("accepts allowlisted website_request.received fields", () => {
    const result = parseNotificationMetadata("website_request.received", {
      requestId: "a0000000-0000-4000-8000-000000000101",
      requestNumber: "WR-1001",
      kind: "contact",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.requestId).toBe(
        "a0000000-0000-4000-8000-000000000101",
      );
    }
  });

  it("rejects unknown metadata keys (strict allowlist)", () => {
    const result = parseNotificationMetadata("website_request.received", {
      requestId: "a0000000-0000-4000-8000-000000000101",
      email: "user@example.com",
      body: "secret message",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects inactive / future types", () => {
    const result = parseNotificationMetadata("order.created", {
      orderId: "a0000000-0000-4000-8000-000000000202",
    });
    expect(result.ok).toBe(false);
  });

  it("validates cms and mailbox active schemas", () => {
    expect(
      parseNotificationMetadata("cms.publish_failed", {
        pageId: "a0000000-0000-4000-8000-000000000301",
        attemptId: "attempt-1",
      }).ok,
    ).toBe(true);

    expect(
      parseNotificationMetadata("mailbox.connection_failed", {
        provider: "graph",
        errorCode: "token_expired",
      }).ok,
    ).toBe(true);

    expect(
      parseNotificationMetadata("system.warning", {
        code: "disk_pressure",
      }).ok,
    ).toBe(true);

    expect(
      parseNotificationMetadata("mailbox.connection_failed", {
        provider: "fax",
      }).ok,
    ).toBe(false);
  });
});
