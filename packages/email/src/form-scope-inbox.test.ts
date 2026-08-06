import { describe, expect, it } from "vitest";
import type { FormKind } from "@mccoy/domain";
import {
  buildAanvragenScopeFacets,
  buildInboxFacets,
  filterInboxMessages,
  mergeScopeFacets,
} from "./filter-inbox-messages";
import { enrichInboxSummariesWithRequestScopes } from "./enrich-inbox-scopes";
import type { FormInboxMessageSummary } from "./form-inbox-contracts";
import { classifyFormEmailSubject, extractFormScopeKeyFromSubject } from "./classify-form-email";
import { mergeMailboxAndWebsiteRequestSummaries } from "./enrich-inbox-scopes";
import {
  activePublishedScopeKeySet,
  clearOrphanScopesOnInboxSummaries,
  findOrphanedScopeKeys,
  isOrphanFormScope,
} from "./orphan-form-scopes";
import { buildFormEmail } from "./templates";

function msg(
  partial: Partial<FormInboxMessageSummary> & { kind: FormKind; id: string },
): FormInboxMessageSummary {
  return {
    uid: 1,
    subject: "test",
    from: "a@b.nl",
    to: "info@mccoy.nl",
    date: new Date().toISOString(),
    snippet: "",
    unread: false,
    submitterName: null,
    submitterEmail: null,
    requestNumber: null,
    scopeKey: null,
    scopeLabel: null,
    ...partial,
  };
}

describe("filterInboxMessages", () => {
  const items = [
    msg({
      id: "1",
      kind: "inquiry",
      scopeKey: "amsterdam",
      scopeLabel: "Amsterdam",
    }),
    msg({
      id: "2",
      kind: "glass_washing",
      scopeKey: "amsterdam",
      scopeLabel: "Amsterdam",
    }),
    msg({ id: "3", kind: "inquiry", scopeKey: null }),
  ];

  it("filters by kind and scope with AND", () => {
    expect(filterInboxMessages(items, { kind: "inquiry", scopeKey: "amsterdam" }).map((m) => m.id)).toEqual([
      "1",
    ]);
    expect(filterInboxMessages(items, { kind: "all", scopeKey: "amsterdam" }).map((m) => m.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("builds facets from the full window", () => {
    const facets = buildInboxFacets(items);
    expect(facets.scopes).toEqual([
      { key: "amsterdam", label: "Amsterdam", count: 2 },
    ]);
  });

  it("merges store and mailbox facets", () => {
    const merged = mergeScopeFacets(
      [{ key: "rotterdam", label: "Rotterdam", count: 3 }],
      [{ key: "amsterdam", label: "Amsterdam", count: 2 }],
    );
    expect(merged.map((s) => s.key).sort()).toEqual(["amsterdam", "rotterdam"]);
  });

  it("Aanvragen scope facets use mailbox counts and drop ghost store-only scopes", () => {
    const facets = buildAanvragenScopeFacets({
      published: [{ key: "questions", label: "questions", count: 0 }],
      mailbox: [],
      storeLabels: [
        { key: "test", label: "test", count: 1 },
        { key: "questions", label: "questions", count: 0 },
      ],
    });
    expect(facets).toEqual([{ key: "questions", label: "questions", count: 0 }]);
  });

  it("drops deleted-form scopes even when mailbox still has mail (retire to Algemeen)", () => {
    const facets = buildAanvragenScopeFacets({
      published: [],
      mailbox: [{ key: "test", label: "test", count: 1 }],
      storeLabels: [{ key: "test", label: "test", count: 9 }],
    });
    expect(facets).toEqual([]);
  });

  it("keeps published scope tabs with mailbox counts after orphan mail is cleared", () => {
    const facets = buildAanvragenScopeFacets({
      published: [{ key: "amsterdam", label: "Amsterdam", count: 0 }],
      mailbox: [{ key: "amsterdam", label: "Amsterdam", count: 2 }],
    });
    expect(facets).toEqual([{ key: "amsterdam", label: "Amsterdam", count: 2 }]);
  });
});

describe("orphan form scopes", () => {
  it("detects scopes missing from published forms", () => {
    const active = activePublishedScopeKeySet([
      { key: "amsterdam" },
      { key: "Rotterdam" },
    ]);
    expect(active.has("amsterdam")).toBe(true);
    expect(active.has("rotterdam")).toBe(true);
    expect(isOrphanFormScope("questions", active)).toBe(true);
    expect(isOrphanFormScope("amsterdam", active)).toBe(false);
    expect(isOrphanFormScope(null, active)).toBe(false);
    expect(findOrphanedScopeKeys(["amsterdam", "test", "TEST", null], active)).toEqual([
      "test",
    ]);
  });

  it("clears orphan scopeKey/scopeLabel without changing kind", () => {
    const active = activePublishedScopeKeySet([{ key: "amsterdam" }]);
    const cleared = clearOrphanScopesOnInboxSummaries(
      [
        msg({
          id: "1",
          kind: "inquiry",
          scopeKey: "questions",
          scopeLabel: "questions",
        }),
        msg({
          id: "2",
          kind: "job_application",
          scopeKey: "amsterdam",
          scopeLabel: "Amsterdam",
        }),
        msg({ id: "3", kind: "inquiry", scopeKey: null }),
      ],
      active,
    );
    expect(cleared[0]).toMatchObject({
      id: "1",
      kind: "inquiry",
      scopeKey: null,
      scopeLabel: null,
    });
    expect(cleared[1]).toMatchObject({
      id: "2",
      kind: "job_application",
      scopeKey: "amsterdam",
      scopeLabel: "Amsterdam",
    });
    expect(cleared[2]?.scopeKey).toBeNull();
  });

  it("after clearing orphans, facets no longer expose dead scope tabs", () => {
    const active = activePublishedScopeKeySet([{ key: "amsterdam" }]);
    const cleared = clearOrphanScopesOnInboxSummaries(
      [
        msg({
          id: "1",
          kind: "inquiry",
          scopeKey: "test",
          scopeLabel: "test",
        }),
        msg({
          id: "2",
          kind: "inquiry",
          scopeKey: "amsterdam",
          scopeLabel: "Amsterdam",
        }),
      ],
      active,
    );
    const mailboxFacets = buildInboxFacets(cleared);
    const tabs = buildAanvragenScopeFacets({
      published: [{ key: "amsterdam", label: "Amsterdam", count: 0 }],
      mailbox: mailboxFacets.scopes,
    });
    expect(tabs).toEqual([{ key: "amsterdam", label: "Amsterdam", count: 1 }]);
    expect(cleared.find((m) => m.id === "1")?.scopeKey).toBeNull();
  });
});

describe("mergeMailboxAndWebsiteRequestSummaries", () => {
  it("keeps request-only rows and enriches mailbox scope from the request", () => {
    const merged = mergeMailboxAndWebsiteRequestSummaries(
      [
        msg({
          id: "graph:1",
          kind: "inquiry",
          requestNumber: "WR-1",
          scopeKey: null,
        }),
      ],
      [
        msg({
          id: "req:1",
          kind: "inquiry",
          requestNumber: "WR-1",
          scopeKey: "test",
          scopeLabel: "test",
        }),
        msg({
          id: "req:2",
          kind: "inquiry",
          requestNumber: "WR-2",
          scopeKey: "test",
          scopeLabel: "test",
        }),
      ],
    );
    expect(merged).toHaveLength(2);
    const wr1 = merged.find((m) => m.requestNumber === "WR-1");
    const wr2 = merged.find((m) => m.requestNumber === "WR-2");
    // Prefer request-backed id so the list row is the stable inquiry, not a Graph item.
    expect(wr1?.id).toBe("req:1");
    expect(wr1?.scopeKey).toBe("test");
    expect(wr2?.id).toBe("req:2");
  });

  it("strips Graph subject scopes that are no longer published after merge", () => {
    const active = activePublishedScopeKeySet([{ key: "live" }]);
    const merged = mergeMailboxAndWebsiteRequestSummaries(
      [
        msg({
          id: "graph:1",
          kind: "inquiry",
          requestNumber: "WR-9",
          scopeKey: "dead",
          scopeLabel: "dead",
        }),
      ],
      [
        msg({
          id: "req:9",
          kind: "inquiry",
          requestNumber: "WR-9",
          scopeKey: null,
          scopeLabel: null,
        }),
      ],
    );
    const cleared = clearOrphanScopesOnInboxSummaries(merged, active);
    expect(cleared).toHaveLength(1);
    expect(cleared[0]?.scopeKey).toBeNull();
    expect(cleared[0]?.scopeLabel).toBeNull();
    expect(cleared[0]?.kind).toBe("inquiry");
  });

  it("suppresses mailbox and request rows for closed/spam WR numbers", () => {
    const merged = mergeMailboxAndWebsiteRequestSummaries(
      [
        msg({
          id: "graph:1",
          kind: "inquiry",
          requestNumber: "WR-CLOSED",
          scopeKey: "test",
        }),
        msg({
          id: "graph:2",
          kind: "inquiry",
          requestNumber: "WR-OPEN",
          scopeKey: "test",
        }),
      ],
      [
        msg({
          id: "req:closed",
          kind: "inquiry",
          requestNumber: "WR-CLOSED",
          scopeKey: "test",
        }),
        msg({
          id: "req:open",
          kind: "inquiry",
          requestNumber: "WR-OPEN",
          scopeKey: "test",
        }),
      ],
      { hiddenRequestNumbers: new Set(["WR-CLOSED"]) },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.requestNumber).toBe("WR-OPEN");
    expect(merged[0]?.id).toBe("req:open");
  });
});

describe("enrichInboxSummariesWithRequestScopes", () => {
  it("fills missing scope from website request number", () => {
    const items = [
      msg({ id: "1", kind: "inquiry", requestNumber: "WR-2026-00009", scopeKey: null }),
      msg({
        id: "2",
        kind: "inquiry",
        requestNumber: "WR-2026-00010",
        scopeKey: "already",
        scopeLabel: "Already",
      }),
    ];
    const enriched = enrichInboxSummariesWithRequestScopes(items, [
      { number: "WR-2026-00009", scopeKey: "test", scopeLabel: "test" },
      { number: "WR-2026-00010", scopeKey: "ignored", scopeLabel: "Ignored" },
    ]);
    expect(enriched[0]?.scopeKey).toBe("test");
    expect(enriched[0]?.scopeLabel).toBe("test");
    expect(enriched[1]?.scopeKey).toBe("already");
  });
});

describe("scoped email subject", () => {
  it("embeds FORM_SCOPE marker and classifies kind", () => {
    const email = buildFormEmail(
      "inquiry",
      { name: "Maria", email: "m@example.com" },
      [],
      { key: "vestiging-amsterdam", label: "Vestiging Amsterdam" },
    );
    expect(email.subject.startsWith("[FORM_SCOPE:vestiging-amsterdam]")).toBe(true);
    expect(classifyFormEmailSubject(email.subject)).toBe("inquiry");
    expect(extractFormScopeKeyFromSubject(email.subject)).toBe("vestiging-amsterdam");
    expect(email.html).toContain("Vestiging Amsterdam");
    expect(email.html).not.toContain("<script");
  });

  it("does not treat EXTERNAL brackets as scope", () => {
    expect(extractFormScopeKeyFromSubject("[EXTERNAL] Algemene aanvraag — Maria")).toBeNull();
    expect(
      extractFormScopeKeyFromSubject(
        "Re: [FORM_SCOPE:amsterdam] Algemene aanvraag — Maria",
      ),
    ).toBe("amsterdam");
  });
});
