import { describe, expect, it } from "vitest";
import { createFileCmsStore } from "./file-store";
import { builtinCmsSeedPages } from "./seeds";
import { importAetherStagedFixes } from "./import-aether-drafts";

describe("importAetherStagedFixes", () => {
  it("writes locale drafts via saveDraft and never publishes", async () => {
    const store = createFileCmsStore({ memoryOnly: true });
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
    const before = await store.getActivePublishedRevision("page_services");
    const beforeTitle = before?.payload.localeContent?.nl?.seo?.title ?? before?.payload.title;
    const beforeRev = before?.id;
    const dump = { version: 1, patches: [
      { pageUrl: "https://www.mccoy.nl/services", kind: "title", proposedValue: "Schoonmaakdiensten Twente", status: "approved", currentValue: "Diensten" },
      { pageUrl: "https://www.mccoy.nl/contact", kind: "h1", proposedValue: "Neem contact op", status: "pending_review" },
      { pageUrl: "https://www.mccoy.nl/services", kind: "canonical", proposedValue: "https://www.mccoy.nl/services", status: "approved" },
    ] };
    const result = await importAetherStagedFixes({ store, dump });
    expect(result.published).toBe(false);
    expect(result.drafted).toBe(2);
    expect(result.rows.find((r) => r.field === "seo.title")?.drafted).toBe(true);
    expect(result.rows.find((r) => r.field === "pageTitle")?.drafted).toBe(true);
    expect(result.rows.find((r) => r.skippedReason === "canonical_not_in_mccoy_cms")?.drafted).toBe(false);
    const draft = await store.getDraftPayload("page_services");
    expect(draft?.localeContent?.nl?.seo?.title).toBe("Schoonmaakdiensten Twente");
    const published = await store.getActivePublishedRevision("page_services");
    expect(published?.id).toBe(beforeRev);
    expect(published?.payload.localeContent?.nl?.seo?.title ?? published?.payload.title).toBe(beforeTitle);
    expect(result.rows.find((r) => r.field === "seo.title")?.frozenLiveTitle).toBe(true);
  });
});
