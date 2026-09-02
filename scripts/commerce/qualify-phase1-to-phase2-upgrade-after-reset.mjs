/**
 * Applies Phase 2 migrations after representative Phase 1 seed.
 *
 * Prerequisite: local Supabase `postgres` database at migration version
 * **20260821220000** (Phase 1 commerce, before Phase 2).
 *
 * Operator setup (destructive to local DB only):
 *   supabase db reset --version 20260821220000
 *
 * Then:
 *   node scripts/commerce/qualify-phase1-to-phase2-upgrade-after-reset.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCKER_DB = process.env.QUALIFICATION_DOCKER_DB ?? "supabase_db_mccoy";
const DB_NAME = process.env.QUALIFICATION_UPGRADE_DB ?? "postgres";
const PHASE2_START = "20260822120000";

function dockerPsql(database, input, { file = false } = {}) {
  const args = ["exec", "-i", DOCKER_DB, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"];
  if (file) {
    execFileSync("docker", args, { input: readFileSync(input), stdio: ["pipe", "inherit", "inherit"] });
    return;
  }
  execFileSync("docker", [...args, "-c", input], { stdio: "inherit" });
}

function sortedMigrations() {
  return readdirSync(join(ROOT, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function main() {
  console.log(`[qualify-phase1-to-phase2-after-reset] target database: ${DB_NAME}`);

  dockerPsql(DB_NAME, `
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'company_member_role' AND e.enumlabel = 'account_admin'
      ) THEN
        RAISE EXCEPTION 'Database already has Phase 2 roles. Run: supabase db reset --version 20260821220000';
      END IF;
    END $$;
  `);

  const seedPath = join(ROOT, "supabase", "qualification", "phase1_representative_seed.sql");
  console.log("[qualify-phase1-to-phase2-after-reset] seeding Phase 1 representative data");
  dockerPsql(DB_NAME, seedPath, { file: true });

  for (const file of sortedMigrations()) {
    if (file >= PHASE2_START) {
      console.log(`[qualify-phase1-to-phase2-after-reset] applying ${file}`);
      dockerPsql(DB_NAME, join(ROOT, "supabase", "migrations", file), { file: true });
    }
  }

  console.log("[qualify-phase1-to-phase2-after-reset] done");
}

main();
