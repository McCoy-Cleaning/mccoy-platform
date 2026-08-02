import { describe, expect, it } from "vitest";

import { dedupeFormInboxSummaries } from "./graph-mail";
import type { FormInboxMessageSummary } from "./form-inbox-contracts";

function summary(
  overrides: Partial<FormInboxMessageSummary> & Pick<FormInboxMessageSummary, "id">,
): FormInboxMessageSummary {
  return {
    uid: 1,
    kind: "job_application",
    subject: "Sollicitatie — Test",
    from: "Test <test@example.com>",
    to: "info@mccoy.nl",
    date: "2026-08-01T10:00:00.000Z",
    snippet: "Hallo",
    unread: false,
    submitterName: "Test",
    submitterEmail: "test@example.com",
    requestNumber: null,
    scopeKey: null,
    scopeLabel: null,
    ...overrides,
  };
}

describe("dedupeFormInboxSummaries", () => {
  it("keeps one row per McCoy request number", () => {
    const items = dedupeFormInboxSummaries([
      summary({
        id: "graph:a",
        requestNumber: "WR-00042",
        date: "2026-08-01T10:00:00.000Z",
      }),
      summary({
        id: "graph:b",
        requestNumber: "WR-00042",
        date: "2026-08-01T10:00:01.000Z",
      }),
      summary({
        id: "graph:c",
        requestNumber: "WR-00043",
        date: "2026-08-01T09:00:00.000Z",
      }),
    ]);

    expect(items.map((i) => i.id)).toEqual(["graph:b", "graph:c"]);
  });

  it("preserves messages without a request number", () => {
    const items = dedupeFormInboxSummaries([
      summary({ id: "graph:x", requestNumber: null }),
      summary({ id: "graph:y", requestNumber: null }),
    ]);
    expect(items).toHaveLength(2);
  });
});
