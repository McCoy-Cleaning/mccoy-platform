import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const MIGRATION_URL = new URL(
  "../../../../supabase/migrations/20260921122315_harden_website_request_mail_identity.sql",
  import.meta.url,
);

describe("website request mail identity migration", () => {
  it("keeps provider identities bound to their original request", async () => {
    const sql = await readFile(MIGRATION_URL, "utf8");

    expect(sql).toContain("v_existing_request_id <> p_request_id");
    expect(sql).toContain("identity_belongs_to_another_request");
  });

  it("keeps deleted requests deleted and reopens resolved requests on new inbound mail", async () => {
    const sql = await readFile(MIGRATION_URL, "utf8");

    expect(sql).toContain("v_request_status in ('deleted', 'spam')");
    expect(sql).toContain("status in ('new', 'open', 'replied', 'closed')");
  });

  it("keeps the privileged RPC restricted to the service role", async () => {
    const sql = await readFile(MIGRATION_URL, "utf8");

    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
