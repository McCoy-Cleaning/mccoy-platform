#!/usr/bin/env node
/**
 * Local McCoy backup: Postgres dump + Storage objects.
 *
 * Writes to MCCOY_BACKUP_DIR (default <repo>/.data/backups). Never uploads
 * customer data. Uses server-side SUPABASE_SECRET_KEY + SUPABASE_DB_URL only.
 *
 * Usage (repo root):
 *   npm run backup:mccoy
 *   node --env-file=.env scripts/backup/backup-mccoy.mjs
 *
 * See docs/operations/data-backup.md
 */

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  DUMP_SCHEMAS,
  KNOWN_STORAGE_BUCKETS,
  applyDotEnv,
  assertSafeBackupRoot,
  assertSafeStoragePath,
  buildManifest,
  collectStorageObjects,
  formatBackupFolderName,
  logSafe,
  parseDotEnv,
  parseRetain,
  projectHostFromUrl,
  redactSecrets,
  requireEnv,
  resolveBackupRoot,
  resolveDumpUrl,
  resolveSecretKey,
  selectExpiredBackupFolders,
} from "./backup-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DOWNLOAD_CONCURRENCY = 4;

function loadRepoEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  applyDotEnv(parseDotEnv(readFileSync(envPath, "utf8")), process.env);
}

function commandExists(command) {
  const finder = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    const child = spawn(finder, [command], { stdio: "ignore", windowsHide: true });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

function runCommand(command, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(new Error(redactSecrets(error.message)));
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = redactSecrets((stderr || stdout || `exit ${code}`).trim().slice(0, 800));
      reject(new Error(`${path.basename(command)} failed (${code}): ${detail}`));
    });
  });
}

async function dumpWithPgDump(pgDump, dbUrl, destFile, schemas) {
  await runCommand(pgDump, [
    `--dbname=${dbUrl}`,
    "--format=custom",
    "--no-owner",
    "--no-acl",
    `--file=${destFile}`,
    ...schemas.map((schema) => `--schema=${schema}`),
  ]);
}

async function dumpWithSupabaseCli(npxBin, dbUrl, destDir, schemas) {
  const schemaFile = path.join(destDir, "database.sql");
  const dataFile = path.join(destDir, "database-data.sql");
  const schemaList = schemas.join(",");
  const schemaArgs = [
    "--yes",
    "supabase",
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "--schema",
    schemaList,
    "-f",
    schemaFile,
  ];
  const dataArgs = [
    "--yes",
    "supabase",
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "--schema",
    schemaList,
    "--data-only",
    "--use-copy",
    "-f",
    dataFile,
  ];
  await runCommand(npxBin, schemaArgs, { cwd: ROOT });
  await runCommand(npxBin, dataArgs, { cwd: ROOT });
  return { schemaFile, dataFile };
}

async function dumpDatabase(dbUrl, destDir) {
  const schemasWithAuth = [...DUMP_SCHEMAS];
  const schemasWithoutAuth = DUMP_SCHEMAS.filter((schema) => schema !== "auth");
  const pgDump = (await commandExists("pg_dump")) ? "pg_dump" : null;
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

  if (pgDump) {
    const destFile = path.join(destDir, "database.dump");
    try {
      await dumpWithPgDump(pgDump, dbUrl, destFile, schemasWithAuth);
      return {
        format: "custom",
        files: ["database.dump"],
        schemas: schemasWithAuth,
        authIncluded: true,
      };
    } catch (error) {
      logSafe("backup.database.auth_retry", {
        ok: false,
        reason: redactSecrets(error.message),
      });
      await dumpWithPgDump(pgDump, dbUrl, destFile, schemasWithoutAuth);
      return {
        format: "custom",
        files: ["database.dump"],
        schemas: schemasWithoutAuth,
        authIncluded: false,
      };
    }
  }

  if (!(await commandExists(npxBin))) {
    throw new Error(
      "Neither pg_dump nor npx is available. Install PostgreSQL client tools (preferred) or Node + Docker for `npx supabase db dump`.",
    );
  }

  try {
    await dumpWithSupabaseCli(npxBin, dbUrl, destDir, schemasWithAuth);
    return {
      format: "sql",
      files: ["database.sql", "database-data.sql"],
      schemas: schemasWithAuth,
      authIncluded: true,
    };
  } catch (error) {
    logSafe("backup.database.auth_retry", {
      ok: false,
      reason: redactSecrets(error.message),
    });
    await dumpWithSupabaseCli(npxBin, dbUrl, destDir, schemasWithoutAuth);
    return {
      format: "sql",
      files: ["database.sql", "database-data.sql"],
      schemas: schemasWithoutAuth,
      authIncluded: false,
    };
  }
}

async function writeBlob(destPath, blob) {
  await mkdir(path.dirname(destPath), { recursive: true });
  if (blob && typeof blob.stream === "function") {
    await pipeline(Readable.fromWeb(blob.stream()), createWriteStream(destPath));
    return;
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  await writeFile(destPath, buffer);
}

async function mapPool(items, concurrency, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, items.length) || 0 }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function downloadBucket(supabase, bucket, destRoot) {
  const { data: listed, error: listError } = await supabase.storage.from(bucket).list("", { limit: 1 });
  if (listError) {
    const message = listError.message || "list failed";
    if (/not found|does not exist/i.test(message)) {
      return { files: 0, bytes: 0, missing: true };
    }
    throw new Error(`${bucket}: ${message}`);
  }
  void listed;

  const objects = await collectStorageObjects(async (prefix, { limit, offset }) => {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) return { items: [], error };
    return { items: data ?? [] };
  });

  let bytes = 0;
  await mapPool(objects, DOWNLOAD_CONCURRENCY, async (object) => {
    const safePath = assertSafeStoragePath(object.path);
    const { data, error } = await supabase.storage.from(bucket).download(safePath);
    if (error || !data) {
      throw new Error(`${bucket}/${safePath}: ${error?.message || "download failed"}`);
    }
    const destPath = path.join(destRoot, ...safePath.split("/"));
    await writeBlob(destPath, data);
    try {
      bytes += (await stat(destPath)).size;
    } catch {
      bytes += object.bytes;
    }
  });

  return { files: objects.length, bytes };
}

async function backupStorage(supabase, destDir) {
  const { data: remoteBuckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    logSafe("backup.storage.list_buckets", {
      ok: false,
      reason: redactSecrets(bucketsError.message),
    });
  }
  const names = new Set(KNOWN_STORAGE_BUCKETS);
  for (const bucket of remoteBuckets ?? []) {
    if (bucket?.name) names.add(bucket.name);
  }

  const storage = {};
  const missingKnown = [];
  for (const bucket of [...names].sort()) {
    const result = await downloadBucket(supabase, bucket, path.join(destDir, "storage", bucket));
    storage[bucket] = result;
    if (result.missing && KNOWN_STORAGE_BUCKETS.includes(bucket)) {
      missingKnown.push(bucket);
    }
    logSafe("backup.storage.bucket", {
      ok: !result.missing,
      bucket,
      files: result.files,
      bytes: result.bytes,
      missing: Boolean(result.missing),
    });
  }
  if (missingKnown.length > 0) {
    throw new Error(`Known Storage buckets missing: ${missingKnown.join(", ")}`);
  }
  return storage;
}

async function applyRetention(backupRoot, retain) {
  const entries = await readdir(backupRoot, { withFileTypes: true });
  const complete = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(path.join(backupRoot, entry.name, "manifest.json"))) continue;
    complete.push(entry.name);
  }
  const expired = selectExpiredBackupFolders(complete, retain);
  for (const name of expired) {
    await rm(path.join(backupRoot, name), { recursive: true, force: true });
    logSafe("backup.retention.deleted", { folder: name });
  }
  return { deleted: expired.length, kept: complete.length - expired.length };
}

async function main() {
  loadRepoEnv();

  const supabaseUrl = requireEnv(process.env, "SUPABASE_URL");
  const secretKey = resolveSecretKey(process.env);
  const dumpUrl = resolveDumpUrl(process.env);
  const retain = parseRetain(process.env.MCCOY_BACKUP_RETAIN);
  const backupRoot = assertSafeBackupRoot(
    resolveBackupRoot({
      backupDir: process.env.MCCOY_BACKUP_DIR,
      repoRoot: ROOT,
    }),
    ROOT,
    path,
  );

  const createdAt = new Date();
  const folderName = formatBackupFolderName(createdAt);
  const destDir = path.join(backupRoot, folderName);
  const projectHost = projectHostFromUrl(supabaseUrl);

  const relativeRoot = path.relative(ROOT, backupRoot);
  logSafe("backup.start", {
    folder: folderName,
    usedDefaultDir: !String(process.env.MCCOY_BACKUP_DIR || "").trim(),
    backupRootOutsideRepo: relativeRoot.startsWith("..") || path.isAbsolute(relativeRoot),
    projectHost,
    retain,
  });

  await mkdir(destDir, { recursive: true });
  let completed = false;

  try {
    const database = await dumpDatabase(dumpUrl, destDir);
    logSafe("backup.database.ok", {
      format: database.format,
      files: database.files,
      schemas: database.schemas,
      authIncluded: database.authIncluded,
    });

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const storage = await backupStorage(supabase, destDir);

    const finishedAt = new Date();
    const manifest = buildManifest({
      createdAt: createdAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      projectHost,
      retain,
      database,
      storage,
    });
    await writeFile(path.join(destDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    completed = true;

    const retention = await applyRetention(backupRoot, retain);
    logSafe("backup.ok", {
      ok: true,
      folder: folderName,
      durationMs: finishedAt.getTime() - createdAt.getTime(),
      databaseFormat: database.format,
      authIncluded: database.authIncluded,
      storageFiles: Object.values(storage).reduce((sum, row) => sum + (row.files || 0), 0),
      retention,
    });
  } catch (error) {
    logSafe("backup.failed", { ok: false, error: redactSecrets(error.message) });
    if (!completed) {
      rmSync(destDir, { recursive: true, force: true });
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  logSafe("backup.failed", { ok: false, error: redactSecrets(error?.message || error) });
  process.exitCode = 1;
});
