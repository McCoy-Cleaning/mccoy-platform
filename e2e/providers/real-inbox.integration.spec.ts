import { test } from "@playwright/test";

/**
 * Opt-in real Graph/IMAP suite — never runs in default CI.
 * Set E2E_REAL_INBOX=1 and provider credentials locally / protected workflow.
 * See docs/testing/provider-strategy.md.
 */
const enabled = process.env.E2E_REAL_INBOX === "1";

test.describe("Real inbox integration", () => {
  test.skip(!enabled, "Set E2E_REAL_INBOX=1 with Graph or IMAP credentials");

  test("placeholder — implement against non-production mailbox only", async () => {
    test.fail(true, "Add assertions against a dedicated test mailbox when credentials are available");
  });
});
