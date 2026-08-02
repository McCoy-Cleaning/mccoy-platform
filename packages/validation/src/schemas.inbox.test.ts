import { describe, expect, it } from "vitest";

import { adminInboxBulkDeleteSchema, adminInboxMessageIdSchema } from "./schemas";

const VALID_IMAP_ID = "imap:inbox:42";
const VALID_GRAPH_ID = "graph:mailbox@example.com:AAMkAGI2TG93AAA=";
const VALID_E2E_ID = "e2e:test-mailbox:550e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID = "req:website-requests:550e8400-e29b-41d4-a716-446655440000";

describe("adminInboxMessageIdSchema", () => {
  it("accepts imap, graph, req, and e2e ids", () => {
    expect(adminInboxMessageIdSchema.parse({ id: VALID_IMAP_ID }).id).toBe(VALID_IMAP_ID);
    expect(adminInboxMessageIdSchema.parse({ id: VALID_GRAPH_ID }).id).toBe(VALID_GRAPH_ID);
    expect(adminInboxMessageIdSchema.parse({ id: VALID_REQ_ID }).id).toBe(VALID_REQ_ID);
    expect(adminInboxMessageIdSchema.parse({ id: VALID_E2E_ID }).id).toBe(VALID_E2E_ID);
  });

  it("rejects malformed ids", () => {
    expect(() => adminInboxMessageIdSchema.parse({ id: "smtp:bad" })).toThrow();
  });
});

describe("adminInboxBulkDeleteSchema", () => {
  it("dedupes ids and enforces limits", () => {
    const parsed = adminInboxBulkDeleteSchema.parse({
      ids: [VALID_IMAP_ID, VALID_IMAP_ID, VALID_GRAPH_ID],
    });
    expect(parsed.ids).toEqual([VALID_IMAP_ID, VALID_GRAPH_ID]);
  });

  it("rejects empty selection", () => {
    expect(() => adminInboxBulkDeleteSchema.parse({ ids: [] })).toThrow();
  });

  it("rejects more than 50 ids", () => {
    const ids = Array.from({ length: 51 }, (_, index) => `imap:inbox:${index + 1}`);
    expect(() => adminInboxBulkDeleteSchema.parse({ ids })).toThrow();
  });
});
