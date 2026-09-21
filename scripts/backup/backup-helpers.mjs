/**
 * Pure helpers for McCoy local database + Storage backups.
 * Keep secrets out of return values and logs.
 */

export const DEFAULT_BACKUP_RETAIN = 14;
export const DEFAULT_BACKUP_DIR_SEGMENTS = [".data", "backups"];
export const KNOWN_STORAGE_BUCKETS = Object.freeze([
  "cms-media",
  "website-request-attachments",
]);
export const DUMP_SCHEMAS = Object.freeze(["public", "private", "auth", "storage"]);
export const BACKUP_FOLDER_RE = /^\d{4}-\d{2}-\d{2}T\d{6}$/;

const SECRET_LIKE =
  /postgres(?:ql)?:\/\/[^\s"'\\]+|sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|service_role|SUPABASE_SECRET_KEY|SUPABASE_DB_URL/gi;

export function redactSecrets(text) {
  return String(text ?? "").replace(SECRET_LIKE, "[redacted]");
}

export function formatBackupFolderName(date = new Date()) {
  const iso = date.toISOString();
  return iso.slice(0, 19).replaceAll(":", "");
}

export function parseRetain(value, fallback = DEFAULT_BACKUP_RETAIN) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const n = Number.parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("MCCOY_BACKUP_RETAIN must be an integer >= 1");
  }
  return n;
}

export function projectHostFromUrl(url) {
  if (!url || typeof url !== "string") return "unknown";
  try {
    return new URL(url).host || "unknown";
  } catch {
    return "unknown";
  }
}

export function resolveBackupRoot({ backupDir, repoRoot }) {
  const trimmed = typeof backupDir === "string" ? backupDir.trim() : "";
  if (trimmed) return trimmed;
  return [repoRoot, ...DEFAULT_BACKUP_DIR_SEGMENTS].join("/");
}

/**
 * Backups may live outside the repo, or under gitignored `.data/` / `tmp/`.
 * Other in-repo paths risk committing customer dumps.
 */
export function assertSafeBackupRoot(dir, repoRoot, pathApi) {
  const { resolve, relative, isAbsolute, sep } = pathApi;
  const resolved = resolve(dir);
  const repo = resolve(repoRoot);
  const rel = relative(repo, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) return resolved;
  const first = rel.split(/[\\/]/)[0];
  if (first === ".data" || first === "tmp") return resolved;
  throw new Error(
    `MCCOY_BACKUP_DIR must be outside the git working tree or under .data/ / tmp/ (got ${rel.split(sep).join("/")})`,
  );
}

export function selectExpiredBackupFolders(folderNames, retain) {
  const keep = parseRetain(retain);
  const stamps = folderNames.filter((name) => BACKUP_FOLDER_RE.test(name)).sort().reverse();
  return stamps.slice(keep);
}

export function classifyStorageEntry(item) {
  if (!item || typeof item.name !== "string" || item.name.length === 0) return "skip";
  if (item.id === null || item.id === undefined) return "folder";
  return "file";
}

export function joinStoragePath(prefix, name) {
  const base = prefix ? `${prefix.replace(/\/+$/, "")}/` : "";
  return `${base}${name}`;
}

export function assertSafeStoragePath(objectPath) {
  const normalized = String(objectPath ?? "").replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error("unsafe storage path");
  }
  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("unsafe storage path");
  }
  return normalized;
}

/**
 * Recursively list Storage objects via a page callback.
 * `listPage(prefix, { limit, offset })` → `{ items, error? }`
 */
export async function collectStorageObjects(listPage, { limit = 100 } = {}) {
  const files = [];
  const folders = [""];

  while (folders.length > 0) {
    const prefix = folders.pop();
    let offset = 0;
    for (;;) {
      const page = await listPage(prefix, { limit, offset });
      if (page?.error) {
        throw new Error(page.error.message || "storage list failed");
      }
      const items = page?.items ?? [];
      if (items.length === 0) break;
      for (const item of items) {
        const kind = classifyStorageEntry(item);
        if (kind === "skip") continue;
        const fullPath = joinStoragePath(prefix, item.name);
        if (kind === "folder") {
          folders.push(fullPath);
          continue;
        }
        files.push({
          path: assertSafeStoragePath(fullPath),
          bytes: Number(item.metadata?.size) || 0,
        });
      }
      if (items.length < limit) break;
      offset += limit;
    }
  }

  return files;
}

export function buildManifest({
  createdAt,
  finishedAt,
  projectHost,
  retain,
  database,
  storage,
} = {}) {
  const host = String(projectHost ?? "unknown");
  if (/postgres(?:ql)?:\/\//i.test(host) || host.includes("@")) {
    throw new Error("manifest projectHost must be a host only");
  }
  return {
    ok: true,
    tool: "mccoy-backup",
    version: 1,
    createdAt,
    finishedAt,
    projectHost: host,
    retain: parseRetain(retain),
    database: {
      format: database?.format ?? "unknown",
      files: [...(database?.files ?? [])],
      schemas: [...(database?.schemas ?? [])],
      authIncluded: database?.authIncluded ?? false,
    },
    storage: Object.fromEntries(
      Object.entries(storage ?? {}).map(([bucket, info]) => [
        bucket,
        {
          files: Number(info?.files) || 0,
          bytes: Number(info?.bytes) || 0,
          ...(info?.missing ? { missing: true } : {}),
        },
      ]),
    ),
  };
}

export function parseDotEnv(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function applyDotEnv(parsed, env) {
  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined || env[key] === "") {
      env[key] = value;
    }
  }
}

export function requireEnv(env, name) {
  const value = typeof env[name] === "string" ? env[name].trim() : "";
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function resolveDumpUrl(env) {
  const url = (env.SUPABASE_DB_URL || env.DATABASE_URL || "").trim();
  if (!url) {
    throw new Error(
      "Missing required env: SUPABASE_DB_URL (Dashboard → Database settings → URI; session/direct port 5432, not the transaction pooler)",
    );
  }
  return url;
}

export function resolveSecretKey(env) {
  const key = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) {
    throw new Error("Missing required env: SUPABASE_SECRET_KEY");
  }
  return key;
}

export function sqlDumpIncludesAuth(sqlText) {
  return /auth\.users\b/i.test(sqlText) || /CREATE SCHEMA\s+(IF NOT EXISTS\s+)?auth\b/i.test(sqlText);
}

export function logSafe(event, fields = {}) {
  const payload = { event, ...fields };
  const line = redactSecrets(JSON.stringify(payload));
  if (fields.ok === false || fields.level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}
