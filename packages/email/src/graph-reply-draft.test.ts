import { describe, expect, it } from "vitest";
import {
  assertReplyDraftPatchSafe,
  buildGraphReplyDraftPatch,
} from "./graph-reply-draft";

describe("buildGraphReplyDraftPatch", () => {
  it("builds body + toRecipients without internetMessageHeaders", () => {
    const patch = buildGraphReplyDraftPatch({
      html: "<p>Hallo</p>",
      to: "oana@example.com",
      replyTo: "info@mccoy.nl",
    });

    expect(patch).toEqual({
      body: { contentType: "HTML", content: "<p>Hallo</p>" },
      toRecipients: [{ emailAddress: { address: "oana@example.com" } }],
      replyTo: [{ emailAddress: { address: "info@mccoy.nl" } }],
    });
    expect(patch).not.toHaveProperty("internetMessageHeaders");
    expect(patch).not.toHaveProperty("subject");
    assertReplyDraftPatchSafe(patch as unknown as Record<string, unknown>);
  });

  it("rejects patches that include internetMessageHeaders", () => {
    expect(() =>
      assertReplyDraftPatchSafe({
        body: { contentType: "HTML", content: "x" },
        internetMessageHeaders: [{ name: "x-mccoy-request-number", value: "WR-1" }],
      }),
    ).toThrow(/internetMessageHeaders/);
  });
});
