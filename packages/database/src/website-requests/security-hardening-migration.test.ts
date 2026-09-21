import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../supabase/migrations/20260921200000_harden_admin_mfa_and_website_form_uploads.sql",
);
const sql = readFileSync(migrationPath, "utf8").toLowerCase();

function functionDefinition(name: string): string {
  const start = sql.indexOf(`create or replace function private.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + 3);
}

describe("Aanvragen security migration", () => {
  it("requires AAL2 in the shared active-staff predicate and notification policies", () => {
    expect(functionDefinition("current_user_is_active_staff")).toContain("'aal2'");
    expect(sql).toContain("notifications_require_staff_aal2");
    expect(sql).toContain("notification_recipients_require_staff_aal2");
    expect(sql).toContain("notification_preferences_require_staff_aal2");
    expect(sql.match(/as restrictive/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps quota and capability state private, forced-RLS, and service-only", () => {
    for (const table of ["website_form_rate_limits", "website_form_upload_batches"]) {
      expect(sql).toContain(`alter table private.${table} force row level security`);
      expect(sql).toContain(
        `revoke all on table private.${table} from public, anon, authenticated`,
      );
    }
    for (const fn of [
      "consume_website_form_quota",
      "create_website_form_upload_batch",
      "claim_website_form_upload_batch",
    ]) {
      const definition = functionDefinition(fn);
      expect(definition).toContain("set search_path = ''");
      expect(definition).not.toContain("security definer");
      expect(sql).toContain(`grant execute on function private.${fn}`);
    }
  });

  it("binds a batch to exact paths and permits only one successful claim", () => {
    const claim = functionDefinition("claim_website_form_upload_batch");
    expect(claim).toContain("and storage_paths = p_storage_paths");
    expect(claim).toContain("and request_id is null");
    expect(claim).toContain("and consumed_at is null");
    expect(claim).toContain("and expires_at > now()");
  });
});
