import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("../supabase", () => ({
  createSupabaseServiceClient: mocks.createSupabaseServiceClient,
}));

import { listUnreadEntityIdsForUser, markReadForEntity } from "./queries";

type QueryResult = { data: unknown; error: null | { message: string } };

function thenableQuery(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> & {
    then?: Promise<QueryResult>["then"];
  } = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
  };
  for (const method of ["select", "update", "eq", "is", "in"] as const) {
    query[method].mockReturnValue(query);
  }
  query.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("notification entity read state", () => {
  it("lists unread entity ids for the current recipient", async () => {
    const recipients = thenableQuery({
      data: [
        { notifications: { entity_id: "request-a" } },
        { notifications: [{ entity_id: "request-b" }] },
      ],
      error: null,
    });
    mocks.createSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => recipients),
    });

    await expect(
      listUnreadEntityIdsForUser("user-1", "website_request", [
        "request-a",
        "request-b",
        "request-a",
      ]),
    ).resolves.toEqual(["request-a", "request-b"]);
    expect(recipients.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(recipients.is).toHaveBeenCalledWith("read_at", null);
    expect(recipients.is).toHaveBeenCalledWith("dismissed_at", null);
    expect(recipients.in).toHaveBeenCalledWith("notifications.entity_id", [
      "request-a",
      "request-b",
    ]);
  });

  it("resolves notification ids before updating recipient rows", async () => {
    const notifications = thenableQuery({
      data: [{ id: "notification-a" }, { id: "notification-b" }],
      error: null,
    });
    const recipients = thenableQuery({
      data: [{ id: "recipient-a" }, { id: "recipient-b" }],
      error: null,
    });
    const from = vi.fn((table: string) => (table === "notifications" ? notifications : recipients));
    mocks.createSupabaseServiceClient.mockReturnValue({ from });

    await expect(markReadForEntity("user-1", "website_request", "request-a")).resolves.toBe(2);
    expect(notifications.eq).toHaveBeenCalledWith("entity_type", "website_request");
    expect(notifications.eq).toHaveBeenCalledWith("entity_id", "request-a");
    expect(recipients.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(recipients.in).toHaveBeenCalledWith("notification_id", [
      "notification-a",
      "notification-b",
    ]);
  });
});
