import assert from "node:assert/strict";
import path from "node:path";
import {
  BACKUP_FOLDER_RE,
  DEFAULT_BACKUP_RETAIN,
  KNOWN_STORAGE_BUCKETS,
  applyDotEnv,
  assertSafeBackupRoot,
  assertSafeStoragePath,
  buildManifest,
  classifyStorageEntry,
  collectStorageObjects,
  formatBackupFolderName,
  parseRetain,
  projectHostFromUrl,
  redactSecrets,
  requireEnv,
  resolveBackupRoot,
  resolveDumpUrl,
  selectExpiredBackupFolders,
  sqlDumpIncludesAuth,
} from "./backup-helpers.mjs";

assert.equal(KNOWN_STORAGE_BUCKETS.includes("cms-media"), true);
assert.equal(KNOWN_STORAGE_BUCKETS.includes("website-request-attachments"), true);

const stamp = formatBackupFolderName(new Date("2026-09-20T11:26:05.123Z"));
assert.equal(stamp, "2026-09-20T112605");
assert.equal(BACKUP_FOLDER_RE.test(stamp), true);
assert.equal(BACKUP_FOLDER_RE.test("not-a-backup"), false);

assert.equal(parseRetain(undefined), DEFAULT_BACKUP_RETAIN);
assert.equal(parseRetain("7"), 7);
assert.throws(() => parseRetain("0"), />= 1/);
assert.throws(() => parseRetain("nope"), />= 1/);

assert.equal(projectHostFromUrl("https://abc.supabase.co"), "abc.supabase.co");
assert.equal(
  projectHostFromUrl("postgresql://postgres.abc:super-secret@aws-0-eu.pooler.supabase.com:5432/postgres"),
  "aws-0-eu.pooler.supabase.com:5432",
);
assert.ok(!projectHostFromUrl("postgresql://u:p@host/db").includes("p"));

assert.equal(
  resolveBackupRoot({ backupDir: "", repoRoot: "C:/repo" }).replaceAll("\\", "/"),
  "C:/repo/.data/backups",
);
assert.equal(resolveBackupRoot({ backupDir: "D:/McCoyBackups", repoRoot: "C:/repo" }), "D:/McCoyBackups");

assert.equal(
  assertSafeBackupRoot("C:/repo/.data/backups", "C:/repo", path).replaceAll("\\", "/").toLowerCase().endsWith("/.data/backups"),
  true,
);
assert.doesNotThrow(() => assertSafeBackupRoot("D:/owned/backups", "C:/repo", path));
assert.throws(() => assertSafeBackupRoot("C:/repo/apps/admin", "C:/repo", path), /working tree/);

const expired = selectExpiredBackupFolders(
  ["2026-09-01T010000", "2026-09-10T010000", "2026-09-20T010000", "notes.txt"],
  2,
);
assert.deepEqual(expired, ["2026-09-01T010000"]);
assert.deepEqual(selectExpiredBackupFolders(["2026-09-20T010000"], 14), []);

assert.equal(classifyStorageEntry({ name: "folder", id: null }), "folder");
assert.equal(classifyStorageEntry({ name: "file.webp", id: "abc", metadata: { size: 12 } }), "file");
assert.equal(classifyStorageEntry({ name: "" }), "skip");

assert.equal(assertSafeStoragePath("media/hero.webp"), "media/hero.webp");
assert.throws(() => assertSafeStoragePath("../etc/passwd"), /unsafe/);
assert.throws(() => assertSafeStoragePath("/abs"), /unsafe/);

const listed = await collectStorageObjects(async (prefix) => {
  if (prefix === "") {
    return {
      items: [
        { name: "media", id: null },
        { name: "readme.txt", id: "1", metadata: { size: 4 } },
      ],
    };
  }
  if (prefix === "media") {
    return { items: [{ name: "hero.webp", id: "2", metadata: { size: 40 } }] };
  }
  return { items: [] };
});
assert.deepEqual(
  listed.map((row) => row.path).sort(),
  ["media/hero.webp", "readme.txt"],
);

const manifest = buildManifest({
  createdAt: "2026-09-20T11:26:05.123Z",
  finishedAt: "2026-09-20T11:26:08.000Z",
  projectHost: "abc.supabase.co",
  retain: 14,
  database: {
    format: "custom",
    files: ["database.dump"],
    schemas: ["public", "private", "auth", "storage"],
    authIncluded: true,
  },
  storage: { "cms-media": { files: 2, bytes: 44 } },
});
assert.equal(manifest.projectHost, "abc.supabase.co");
assert.equal(manifest.database.authIncluded, true);
assert.equal(JSON.stringify(manifest).includes("postgres"), false);
assert.equal(JSON.stringify(manifest).includes("secret"), false);
assert.throws(
  () => buildManifest({ projectHost: "postgresql://u:p@host/db" }),
  /host only/,
);

assert.match(
  redactSecrets("url=postgresql://postgres:hunter2@host:5432/postgres token=sb_secret_abc-def"),
  /\[redacted\].*\[redacted\]/,
);

const env = { EXISTING: "keep" };
applyDotEnv({ EXISTING: "nope", SUPABASE_URL: "https://abc.supabase.co" }, env);
assert.equal(env.EXISTING, "keep");
assert.equal(env.SUPABASE_URL, "https://abc.supabase.co");

assert.equal(requireEnv({ A: " x " }, "A"), "x");
assert.throws(() => requireEnv({}, "SUPABASE_SECRET_KEY"), /SUPABASE_SECRET_KEY/);
assert.throws(() => resolveDumpUrl({}), /SUPABASE_DB_URL/);

assert.equal(sqlDumpIncludesAuth("COPY auth.users (id) FROM stdin;"), true);
assert.equal(sqlDumpIncludesAuth("CREATE TABLE public.orders"), false);

console.log("backup-helpers tests passed");
