import { describe, expect, it } from "vitest";

import {
  WEBSITE_FORM_MAX_FIELDS,
  websiteFormPayloadSchema,
  websiteFormPrepareAttachmentsSchema,
} from "./schemas";

function fieldsWithKeyCount(count: number): Record<string, string> {
  const fields: Record<string, string> = {};
  for (let i = 0; i < count; i += 1) fields[`field_${i}`] = "x";
  return fields;
}

const basePayload = {
  kind: "inquiry" as const,
  pageId: "page-1",
  sourceId: "source-1",
};

describe("websiteFormPayloadSchema field-count bound", () => {
  it("accepts a realistic published form", () => {
    const parsed = websiteFormPayloadSchema.safeParse({
      ...basePayload,
      fields: { name: "Jan", email: "jan@example.com", message: "Hallo" },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts exactly the maximum key count", () => {
    const parsed = websiteFormPayloadSchema.safeParse({
      ...basePayload,
      fields: fieldsWithKeyCount(WEBSITE_FORM_MAX_FIELDS),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an anonymous submission with an unbounded number of keys", () => {
    // z.record bounds each value but not the key count, so a public form was a
    // cheap memory/CPU amplifier for an unauthenticated submitter.
    const parsed = websiteFormPayloadSchema.safeParse({
      ...basePayload,
      fields: fieldsWithKeyCount(WEBSITE_FORM_MAX_FIELDS + 1),
    });
    expect(parsed.success).toBe(false);
  });

  it("still bounds each individual value", () => {
    const parsed = websiteFormPayloadSchema.safeParse({
      ...basePayload,
      fields: { message: "x".repeat(2001) },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("websiteFormPrepareAttachmentsSchema field-count bound", () => {
  const prepareBase = {
    ...basePayload,
    files: [{ filename: "a.pdf", contentType: "application/pdf", sizeBytes: 1024 }],
  };

  it("accepts a realistic form", () => {
    const parsed = websiteFormPrepareAttachmentsSchema.safeParse({
      ...prepareBase,
      fields: { name: "Jan" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unbounded number of keys on the prepare step too", () => {
    const parsed = websiteFormPrepareAttachmentsSchema.safeParse({
      ...prepareBase,
      fields: fieldsWithKeyCount(WEBSITE_FORM_MAX_FIELDS + 1),
    });
    expect(parsed.success).toBe(false);
  });
});
