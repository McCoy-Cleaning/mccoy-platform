import { describe, expect, it } from "vitest";
import type { BuiltinCmsPage } from "./types";
import { collectPublishedFormScopes } from "./collect-published-form-scopes";
import { normalizeCmsPage } from "./pipeline";

function contactPageWithScope(scope?: { key: string; label: string }): BuiltinCmsPage {
  return normalizeCmsPage({
    id: "page_contact",
    kind: "builtin",
    isCustom: false,
    pageKey: "contact",
    title: "Contact",
    slug: "contact",
    description: "",
    inNav: true,
    version: 1,
    layoutVersion: 3,
    blocks: [],
    layout: [
      {
        kind: "fixed",
        id: "fixed:contact:form",
        key: "contact.form",
        hidden: false,
      },
    ],
    sectionContent: {
      "contact.form": {
        heading: "Contact",
        scope,
      },
    },
    updatedAt: Date.now(),
  }) as BuiltinCmsPage;
}

describe("collectPublishedFormScopes", () => {
  it("includes configured scopes from live published forms even with zero submissions", () => {
    const scopes = collectPublishedFormScopes([
      contactPageWithScope({ key: "a", label: "test" }),
    ]);
    expect(scopes).toEqual([{ key: "a", label: "test", count: 0 }]);
  });

  it("skips hidden fixed form sections", () => {
    const page = contactPageWithScope({ key: "a", label: "test" });
    const item = page.layout[0];
    if (item && item.kind === "fixed") item.hidden = true;
    expect(collectPublishedFormScopes([page])).toEqual([]);
  });
});
