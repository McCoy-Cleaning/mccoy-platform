import { describe, expect, it } from "vitest";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import type { BuiltinCmsPage } from "./types";
import { normalizeFormScopeSnapshot } from "./form-scope";
import {
  resolvePublishedContactFormFields,
  resolvePublishedFormScope,
} from "./resolve-published-form";
import { normalizeCmsPage } from "./pipeline";
import { formFieldPayloadKey } from "./blocks/form-fields";
import { offerteFormMigrationBlockId } from "./migration/offerte-blocks";

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

function emptyBuiltinSeed(pageId: string, pageKey: "contact" | "offerte" | "vacatures"): BuiltinCmsPage {
  return normalizeCmsPage({
    id: pageId,
    kind: "builtin",
    isCustom: false,
    pageKey,
    title: pageKey,
    slug: `/${pageKey}`,
    description: "",
    inNav: true,
    version: 1,
    layoutVersion: 0,
    blocks: [],
    layout: [],
    sectionContent: {},
    updatedAt: Date.now(),
  }) as BuiltinCmsPage;
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

  it("resolves builtin contact/offerte/vacatures forms from empty seed layouts", () => {
    const contact = emptyBuiltinSeed("page_contact", "contact");
    const offerte = emptyBuiltinSeed("page_offerte", "offerte");
    const vacatures = emptyBuiltinSeed("page_vacatures", "vacatures");

    expect(
      resolvePublishedFormScope(contact, {
        pageId: "page_contact",
        sourceId: FIXED_FORM_SOURCE_IDS.contactForm,
        kind: "inquiry",
      }).ok,
    ).toBe(true);

    expect(
      resolvePublishedFormScope(offerte, {
        pageId: "page_offerte",
        sourceId: FIXED_FORM_SOURCE_IDS.offerteForm,
        kind: "glass_washing",
      }).ok,
    ).toBe(true);

    // In-memory migration clients submit the deterministic block id before publish persists it.
    expect(
      resolvePublishedFormScope(offerte, {
        pageId: "page_offerte",
        sourceId: offerteFormMigrationBlockId("page_offerte"),
        kind: "glass_washing",
      }).ok,
    ).toBe(true);

    expect(
      resolvePublishedFormScope(vacatures, {
        pageId: "page_vacatures",
        sourceId: FIXED_FORM_SOURCE_IDS.vacaturesApplication,
        kind: "job_application",
      }).ok,
    ).toBe(true);
  });

  it("normalizes scope snapshots from CMS JSON", () => {
    expect(normalizeFormScopeSnapshot({ key: "amsterdam", label: "Amsterdam" })).toEqual({
      key: "amsterdam",
      label: "Amsterdam",
    });
    expect(normalizeFormScopeSnapshot("Bad\nLabel")).toBeUndefined();
  });
});

describe("resolvePublishedContactFormFields", () => {
  it("resolves default fields for the fixed contact.form section", () => {
    const page = emptyBuiltinSeed("page_contact", "contact");
    const result = resolvePublishedContactFormFields(
      page,
      FIXED_FORM_SOURCE_IDS.contactForm,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.map((f) => formFieldPayloadKey(f))).toEqual([
        "name",
        "email",
        "company",
        "phone",
        "message",
      ]);
    }
  });

  it("seeds fields when only legacy labels/placeholders are published", () => {
    const page = pageWithContactForm();
    page.sectionContent = {
      "contact.form": {
        heading: "Contact",
        labels: { company: "Firma" },
        placeholders: { phone: "06…" },
      },
    };
    const result = resolvePublishedContactFormFields(
      page,
      FIXED_FORM_SOURCE_IDS.contactForm,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const company = result.fields.find((f) => formFieldPayloadKey(f) === "company");
      const phone = result.fields.find((f) => formFieldPayloadKey(f) === "phone");
      expect(company?.label).toBe("Firma");
      expect(phone?.placeholder).toBe("06…");
    }
  });
});
