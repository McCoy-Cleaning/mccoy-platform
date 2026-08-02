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

  it("keeps deleted-form scopes that still have mailbox mail", () => {
    const facets = buildAanvragenScopeFacets({
      published: [],
      mailbox: [{ key: "test", label: "test", count: 1 }],
      storeLabels: [{ key: "test", label: "test", count: 9 }],
    });
    expect(facets).toEqual([{ key: "test", label: "test", count: 1 }]);
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
    expect(wr1?.id).toBe("graph:1");
    expect(wr1?.scopeKey).toBe("test");
    expect(wr2?.id).toBe("req:2");
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
