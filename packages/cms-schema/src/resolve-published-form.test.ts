import { describe, expect, it } from "vitest";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import type { BuiltinCmsPage } from "./types";
import { normalizeFormScopeSnapshot } from "./form-scope";
import { resolvePublishedFormScope } from "./resolve-published-form";

function pageWithContactForm(scope?: { key: string; label: string }): BuiltinCmsPage {
  return {
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
  };
}

describe("resolvePublishedFormScope", () => {
  it("returns published scope and ignores client-supplied values", () => {
    const page = pageWithContactForm({
      key: "vestiging-amsterdam",
      label: "Vestiging Amsterdam",
    });
    const result = resolvePublishedFormScope(page, {
      pageId: "page_contact",
      sourceId: FIXED_FORM_SOURCE_IDS.contactForm,
      kind: "inquiry",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.form.scope).toEqual({
        key: "vestiging-amsterdam",
        label: "Vestiging Amsterdam",
      });
    }
  });

  it("rejects hidden forms", () => {
    const page = pageWithContactForm({ key: "x", label: "X" });
    const layout = page.layout[0];
    if (layout && layout.kind === "fixed") layout.hidden = true;
    const result = resolvePublishedFormScope(page, {
      pageId: "page_contact",
      sourceId: FIXED_FORM_SOURCE_IDS.contactForm,
      kind: "inquiry",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("hidden");
  });

  it("normalizes scope snapshots from CMS JSON", () => {
    expect(normalizeFormScopeSnapshot({ key: "amsterdam", label: "Amsterdam" })).toEqual({
      key: "amsterdam",
      label: "Amsterdam",
    });
    expect(normalizeFormScopeSnapshot("Bad\nLabel")).toBeUndefined();
  });
});
