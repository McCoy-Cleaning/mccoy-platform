/**
 * Fail-closed Supabase migration target guard.
 *
 * The runtime URL, environment allowlist, Git branch, and local CLI link must
 * all identify the same project before a linked database push can start.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_REF_RE = /^[a-z0-9]{20}$/;

function normalizeProjectRef(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return PROJECT_REF_RE.test(normalized) ? normalized : null;
}

function extractProjectRef(urlValue) {
  try {
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(new URL(urlValue).hostname.toLowerCase());
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function redactProjectRef(value) {
  return value ? `${value.slice(0, 4)}…${value.slice(-4)}` : null;
}

export function verifySupabaseTargetIdentity(input) {
  const environment = input.environment;
  const branch = String(input.branch ?? "").trim() || null;
  const runtimeRef = extractProjectRef(input.supabaseUrl);
  const linkedRef = normalizeProjectRef(input.linkedProjectRef);
  const stagingRef = normalizeProjectRef(input.stagingProjectId);
  const productionRef = normalizeProjectRef(input.productionProjectId);
  const base = {
    environment,
    branch,
    supabaseProjectRef: redactProjectRef(runtimeRef),
    linkedSupabaseProjectRef: redactProjectRef(linkedRef),
    targetVerified: false,
  };
  const fail = (code, reason) => ({ ...base, ok: false, code, reason });

  if (environment !== "staging" && environment !== "production") {
    return fail("supabase.environment_invalid", "--environment must be staging or production.");
  }
  if (input.declaredEnvironment !== environment) {
    return fail(
      "supabase.environment_mismatch",
      "MCCOY_ENVIRONMENT must exactly match the requested migration environment.",
    );
  }
  const allowedBranches = environment === "staging" ? ["development", "dev"] : ["main"];
  if (!branch || !allowedBranches.includes(branch)) {
    return fail(
      "supabase.branch_mismatch",
      `The current Git branch is not allowed for ${environment}.`,
    );
  }
  if (!stagingRef || !productionRef) {
    return fail(
      "supabase.allowlist_missing",
      "Both staging and production Supabase project allowlists are required.",
    );
  }
  if (stagingRef === productionRef) {
    return fail(
      "supabase.shared_project",
      "Staging and production must use different Supabase projects.",
    );
  }
  if (!runtimeRef) {
    return fail(
      "supabase.runtime_project_missing",
      "SUPABASE_URL must identify a Supabase project.",
    );
  }
  const expectedRef = environment === "staging" ? stagingRef : productionRef;
  if (runtimeRef !== expectedRef) {
    return fail(
      "supabase.runtime_allowlist_mismatch",
      "The runtime Supabase project does not match the environment allowlist.",
    );
  }
  if (!linkedRef) {
    return fail("supabase.cli_link_missing", "The Supabase CLI is not linked to a project.");
  }
  if (linkedRef !== runtimeRef) {
    return fail(
      "supabase.cli_link_mismatch",
      "The Supabase CLI link does not match the verified runtime project.",
    );
  }
  return { ...base, ok: true, targetVerified: true };
}

function loadRootEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readGitBranch() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || null
    );
  } catch {
    return null;
  }
}

function readLinkedProjectRef() {
  try {
    return readFileSync(path.join(root, "supabase", ".temp", "project-ref"), "utf8").trim() || null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  let environment = null;
  let push = false;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--environment") {
      environment = argv[index + 1];
      index += 1;
    } else if (arg === "--push") push = true;
    else if (arg === "--dry-run") dryRun = true;
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (environment !== "staging" && environment !== "production") {
    throw new Error("--environment staging|production is required");
  }
  if (dryRun && !push) throw new Error("--dry-run is only valid with --push");
  return { environment, push, dryRun };
}

function main() {
  loadRootEnv();
  const args = parseArgs(process.argv.slice(2));
  const result = verifySupabaseTargetIdentity({
    environment: args.environment,
    declaredEnvironment: process.env.MCCOY_ENVIRONMENT,
    branch: readGitBranch(),
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    stagingProjectId: process.env.MCCOY_STAGING_SUPABASE_PROJECT_ID,
    productionProjectId: process.env.MCCOY_PRODUCTION_SUPABASE_PROJECT_ID,
    linkedProjectRef: readLinkedProjectRef(),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(2);
  if (!args.push) return;

  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const pushArgs = ["exec", "supabase", "--", "db", "push", "--linked"];
  if (args.dryRun) pushArgs.push("--dry-run");
  execFileSync(npmExecutable, pushArgs, { cwd: root, stdio: "inherit", env: process.env });
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Supabase target verification failed");
    process.exit(2);
  }
}
