import { describe, expect, it } from "vitest";
import {
  ALL_BLOCK_TYPES,
  PUBLISHABLE_BLOCK_TYPES,
  UNPUBLISHABLE_BLOCK_TYPES,
  getBlockDataDefinition,
} from "@mccoy/cms-schema";
import {
  blockEditorRegistry,
  getBlockEditorDefinition,
  listBlockTypesMissingDedicatedEditor,
  listUnsupportedPublishableBlockTypes,
} from "./blockEditorRegistry";
import { CTA_SUPPORTED_PATHS, imageSupportedPaths } from "./editor-definition";

/** Expected top-level / nested path coverage for field-harness assertions. */
const EXPECTED_PATH_MAP: Partial<Record<string, readonly string[]>> = {
  hero: [
    "eyebrow",
    "title",
    "subtitle",
    "align",
    ...CTA_SUPPORTED_PATHS,
    ...imageSupportedPaths("image"),
  ],
  cta: ["title", "body", ...CTA_SUPPORTED_PATHS],
  richText: ["title", "body", ...CTA_SUPPORTED_PATHS],
  centered: ["title", "body", ...CTA_SUPPORTED_PATHS],
  spacer: ["size", "divider"],
  video: ["title", "description", "videoUrl", ...imageSupportedPaths("poster")],
  beforeAfter: [
    "title",
    "beforeLabel",
    "afterLabel",
    ...imageSupportedPaths("before"),
    ...imageSupportedPaths("after"),
  ],
  announcement: ["message", "linkLabel", "link"],
  newsletter: ["title", "body", "buttonLabel", "consent"],
  contactForm: [
    "title",
    "body",
    "eyebrow",
    "textPlacement",
    "fields",
    "fields.id",
    "fields.label",
    "fields.placeholder",
    "fields.type",
  ],
  popup: ["title", "body", ...CTA_SUPPORTED_PATHS],
};

describe("blockEditorRegistry", () => {
  it("registers editors for all publishable block types", () => {
    expect(listUnsupportedPublishableBlockTypes()).toEqual([]);
    for (const type of PUBLISHABLE_BLOCK_TYPES) {
      const def = getBlockEditorDefinition(type);
      expect(def, type).toBeTruthy();
      expect(def!.Editor, type).toBeTruthy();
      expect(["dedicated", "typed-composed"]).toContain(def!.quality);
      expect(def!.supportedPaths.length, type).toBeGreaterThan(0);
    }
  });

  it("stubs may lack registry entries (unsupported quality OK)", () => {
    for (const type of UNPUBLISHABLE_BLOCK_TYPES) {
      const def = getBlockEditorDefinition(type);
      // Remaining unpublishable types (if any) may lack a typed editor.
      expect(def == null).toBe(true);
      expect(getBlockDataDefinition(type).capabilities.publishable).toBe(false);
    }
  });

  it("conversion blocks have typed editors with supportedPaths", () => {
    for (const type of ["newsletter", "contactForm", "popup"] as const) {
      const def = getBlockEditorDefinition(type);
      expect(def, type).toBeTruthy();
      expect(["dedicated", "typed-composed"]).toContain(def!.quality);
      expect(def!.supportedPaths.length).toBeGreaterThan(0);
    }
    const contact = getBlockEditorDefinition("contactForm");
    expect(contact?.nonEditablePaths?.recipient).toBeTruthy();
  });

  it("field coverage harness: supportedPaths include expected maps", () => {
    for (const [type, expected] of Object.entries(EXPECTED_PATH_MAP)) {
      const def = blockEditorRegistry[type as keyof typeof blockEditorRegistry];
      expect(def, type).toBeTruthy();
      for (const path of expected!) {
        expect(def!.supportedPaths, `${type} missing ${path}`).toContain(path);
      }
    }
  });

  it("listBlockTypesMissingDedicatedEditor only reports stubs / unregistered", () => {
    const missing = listBlockTypesMissingDedicatedEditor();
    for (const type of missing) {
      expect(PUBLISHABLE_BLOCK_TYPES.includes(type)).toBe(false);
    }
    for (const type of ALL_BLOCK_TYPES) {
      if (PUBLISHABLE_BLOCK_TYPES.includes(type)) {
        expect(missing).not.toContain(type);
      }
    }
  });
});
