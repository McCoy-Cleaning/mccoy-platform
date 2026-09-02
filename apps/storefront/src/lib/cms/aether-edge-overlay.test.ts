import { describe, expect, it } from "vitest";
import {
  applyEdgeHead,
  edgeDocumentFromDump,
  lookupEdgePatch,
  planOverlayH1,
  resolveOverlayHeading,
} from "./aether-edge-overlay";

const dump = {
  version: 1 as const,
  siteId: "d06f2e13-d001-45b8-90a7-dc2724330a5e",
  patches: [
    {
      status: "approved",
      kind: "h1",
      pageUrl: "https://mccoy.nl/services",
      proposedValue: "Schoonmaakdiensten Twente — McCoy Cleaning",
    },
    {
      status: "approved",
      kind: "title",
      pageUrl: "https://mccoy.nl/services",
      proposedValue: "Services title",
    },
    {
      status: "approved",
      kind: "meta_description",
      pageUrl: "https://mccoy.nl/services",
      proposedValue: "Services meta",
    },
    {
      status: "pending_review",
      kind: "h1",
      pageUrl: "https://mccoy.nl/about",
      proposedValue: "Should ignore",
    },
    {
      status: "approved",
      kind: "title",
      pageUrl: "https://mccoy.nl/en/terms",
      proposedValue: "Terms &amp; conditions",
    },
    {
      status: "approved",
      kind: "h1",
      pageUrl: "https://mccoy.nl/contact",
      proposedValue: "Contact — McCoy Cleaning Twente | Oldenzaal",
    },
  ],
};

describe("edge overlay approved-only", () => {
  it("ignores unapproved patches and collapses by path", () => {
    const doc = edgeDocumentFromDump(dump);
    expect(doc).toBeTruthy();
    expect(lookupEdgePatch(doc, "/about")).toBeNull();
    expect(lookupEdgePatch(doc, "/services/")?.h1).toBe(
      "Schoonmaakdiensten Twente — McCoy Cleaning",
    );
    expect(lookupEdgePatch(doc, "/en/terms")?.title).toBe("Terms & conditions");
  });
});

describe("overlay H1 plan", () => {
  it("applies approved h1 when the page has none", () => {
    const plan = planOverlayH1({
      hasExistingH1: false,
      pageTitle: "Page title",
      patchH1: "Contact — McCoy Cleaning Twente | Oldenzaal",
    });
    expect(plan).toEqual({
      mode: "inject",
      text: "Contact — McCoy Cleaning Twente | Oldenzaal",
    });
  });

  it("replaces an existing heading and never plans a second H1", () => {
    const plan = planOverlayH1({
      hasExistingH1: true,
      existingHeading: "Ons aanbod",
      patchH1: "Schoonmaakdiensten Twente — McCoy Cleaning",
    });
    expect(plan).toEqual({
      mode: "replace",
      text: "Schoonmaakdiensten Twente — McCoy Cleaning",
    });
    expect(resolveOverlayHeading("Ons aanbod", "Schoonmaakdiensten Twente — McCoy Cleaning")).toBe(
      "Schoonmaakdiensten Twente — McCoy Cleaning",
    );
    expect(resolveOverlayHeading("Ons aanbod", null)).toBe("Ons aanbod");
  });

  it("falls back to pageTitle only when injecting and no patch h1 exists", () => {
    expect(
      planOverlayH1({ hasExistingH1: false, pageTitle: "Offerte", patchH1: null }),
    ).toEqual({ mode: "inject", text: "Offerte" });
    expect(planOverlayH1({ hasExistingH1: true, existingHeading: "Hi", patchH1: null })).toEqual({
      mode: "none",
    });
  });
});

describe("overlay head", () => {
  it("applies approved title and meta description", () => {
    const doc = edgeDocumentFromDump(dump);
    const patch = lookupEdgePatch(doc, "/services");
    const head = applyEdgeHead(
      {
        title: "Frozen title",
        meta: [
          { title: "Frozen title" },
          { name: "description", content: "Frozen desc" },
          { property: "og:description", content: "Frozen desc" },
        ],
      },
      patch,
    );
    expect(head.title).toBe("Services title");
    expect(head.meta?.find((m) => m.name === "description")?.content).toBe("Services meta");
    expect(head.meta?.find((m) => m.property === "og:description")?.content).toBe("Services meta");
  });

  it("leaves frozen head alone when no approved patch exists", () => {
    const head = applyEdgeHead(
      { title: "Frozen", meta: [{ name: "description", content: "Keep" }] },
      lookupEdgePatch(edgeDocumentFromDump(dump), "/about"),
    );
    expect(head.title).toBe("Frozen");
    expect(head.meta?.[0]?.content).toBe("Keep");
  });
});
