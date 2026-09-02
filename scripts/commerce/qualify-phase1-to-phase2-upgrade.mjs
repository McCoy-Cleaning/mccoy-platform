/**
 * Builds an isolated Postgres database at Phase 1 + representative seed,
 * applies Phase 2 migrations, for permanent upgrade qualification.
 *
 * Requires: local Supabase Docker (container supabase_db_mccoy).
 * Usage: node scripts/commerce/qualify-phase1-to-phase2-upgrade.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCKER_DB = process.env.QUALIFICATION_DOCKER_DB ?? "supabase_db_mccoy";
const DB_NAME = process.env.QUALIFICATION_UPGRADE_DB ?? "mccoy_p1_upgrade_test";
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
  const dir = join(ROOT, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function cloneSchemaOnly(targetDb) {
  console.log("[qualify-phase1-to-phase2] cloning filtered schema-only dump to isolated database");
  const dump = execFileSync(
    "docker",
    [
      "exec",
      DOCKER_DB,
      "pg_dump",
      "-U",
      "postgres",
      "--schema-only",
      "--no-owner",
      "--no-privileges",
      "postgres",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const filtered = dump
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith("ALTER DATABASE")) return false;
      if (/CREATE EVENT TRIGGER/i.test(t)) return false;
      if (/ALTER EVENT TRIGGER/i.test(t)) return false;
      if (/WHEN TAG/i.test(t)) return false;
      if (/^EXECUTE FUNCTION extensions\./i.test(t)) return false;
      if (t.includes("log_min_messages")) return false;
      if (t.startsWith("\\restrict")) return false;
      if (t.startsWith("\\unrestrict")) return false;
      return true;
    })
    .join("\n");
  execFileSync("docker", ["exec", "-i", DOCKER_DB, "psql", "-U", "postgres", "-d", targetDb, "-v", "ON_ERROR_STOP=1"], {
    input: filtered,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

function main() {
  console.log(`[qualify-phase1-to-phase2] using database ${DB_NAME} on ${DOCKER_DB}`);

  dockerPsql("postgres", `DROP DATABASE IF EXISTS ${DB_NAME};`);
  dockerPsql("postgres", `CREATE DATABASE ${DB_NAME};`);

  cloneSchemaOnly(DB_NAME);

  const downgradePath = join(ROOT, "supabase", "qualification", "phase2_downgrade_for_qual.sql");
  console.log("[qualify-phase1-to-phase2] downgrading Phase 2 on isolated clone");
  dockerPsql(DB_NAME, downgradePath, { file: true });

  const seedPath = join(ROOT, "supabase", "qualification", "phase1_representative_seed.sql");
  console.log("[qualify-phase1-to-phase2] seeding representative Phase 1 data");
  dockerPsql(DB_NAME, seedPath, { file: true });

  for (const file of sortedMigrations()) {
    if (file >= PHASE2_START) {
      console.log(`[qualify-phase1-to-phase2] applying ${file}`);
      dockerPsql(DB_NAME, join(ROOT, "supabase", "migrations", file), { file: true });
    }
  }

  console.log("[qualify-phase1-to-phase2] upgrade complete — run qualification tests against this database");
}

main();
