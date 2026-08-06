import { describe, expect, it } from "vitest";
import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import {
  beginOptimisticDelete,
  filterTombstonedItems,
  formatBulkDeleteStatus,
  freezeDeleteTargetIds,
  pruneTombstonesAfterRefresh,
  rollbackDeleteFailures,
} from "../lib/optimistic-delete";

function item(id: string): FormInboxMessageSummary {
  return {
    id,
    uid: 1,
    kind: "inquiry",
    from: "a@example.com",
    to: "inbox@mccoy.nl",
    subject: "Hallo",
    date: "2026-08-01T10:00:00.000Z",
    snippet: "",
    unread: false,
    submitterName: id,
    submitterEmail: "a@example.com",
    requestNumber: null,
    scopeKey: null,
    scopeLabel: null,
  };
}

describe("freezeDeleteTargetIds", () => {
  it("deduplicates and drops empties", () => {
    expect(freezeDeleteTargetIds(["a", "a", "", " b ", "b"])).toEqual(["a", "b"]);
  });
});

describe("optimistic delete + stale refresh", () => {
  it("removes targets and restores only failures at original indexes", () => {
    const items = [item("a"), item("b"), item("c"), item("d")];
    const { nextItems, snapshot, tombstones } = beginOptimisticDelete(
      items,
      ["b", "c"],
      new Set(["b", "c", "d"]),
      "b",
      "op1",
    );

    expect(nextItems.map((i) => i.id)).toEqual(["a", "d"]);
    expect(tombstones.has("b")).toBe(true);
    expect(snapshot.previousActiveId).toBe("b");

    const afterPartial = rollbackDeleteFailures(nextItems, snapshot, ["c"]);
    expect(afterPartial.map((i) => i.id)).toEqual(["a", "c", "d"]);
  });

  it("stale refresh cannot restore tombstoned ids", () => {
    const items = [item("a"), item("b"), item("c")];
    const { nextItems, tombstones } = beginOptimisticDelete(
      items,
      ["a", "b"],
      new Set(["a", "b"]),
      null,
      "op-stale",
    );
    expect(nextItems.map((i) => i.id)).toEqual(["c"]);

    const staleRefresh = [item("a"), item("b"), item("c"), item("new")];
    const filtered = filterTombstonedItems(staleRefresh, tombstones);
    expect(filtered.map((i) => i.id)).toEqual(["c", "new"]);

    const pruned = pruneTombstonesAfterRefresh(tombstones, new Set(staleRefresh.map((i) => i.id)));
    // Still present in stale payload → keep tombstones (until expiry / confirmed absence)
    expect(pruned.has("a")).toBe(true);
    expect(pruned.has("b")).toBe(true);

    const authoritative = pruneTombstonesAfterRefresh(tombstones, new Set(["c", "new"]));
    expect(authoritative.size).toBe(0);
  });

  it("preserves newer messages when rolling back failures", () => {
    const items = [item("a"), item("b"), item("c")];
    const { nextItems, snapshot } = beginOptimisticDelete(
      items,
      ["a", "b"],
      new Set(["a", "b"]),
      null,
      "op2",
    );
    const withNew = [...nextItems, item("z")];
    const restored = rollbackDeleteFailures(withNew, snapshot, ["a"]);
    expect(restored.map((i) => i.id)).toEqual(["a", "c", "z"]);
  });
});

describe("formatBulkDeleteStatus", () => {
  it("reports honest partial and total failure copy", () => {
    expect(formatBulkDeleteStatus({ successCount: 7, failedCount: 0 }).status).toBe(
      "7 e-mails verwijderd",
    );
    expect(formatBulkDeleteStatus({ successCount: 5, failedCount: 2 }).error).toMatch(/5 van 7/);
    expect(formatBulkDeleteStatus({ successCount: 0, failedCount: 3 }).error).toMatch(/teruggezet/);
  });
});
