/**
 * MG5 operator CLI — fixed→blocks migration.
 *
 * Dry-run never writes CMS records.
 * Apply is fail-closed: requires qualified dry-run, backup, CAS revision, post-write verify.
 * Production apply additionally requires --confirm-production "MIGRATE PRODUCTION CMS".
 * Staging/production ops require verified MCCOY_ENVIRONMENT + git branch + Supabase allowlist.
 * There is no --force / --skip / --ignore bypass.
 *
 * Usage:
 *   npm run cms:migrate-fixed-blocks -- --verify-environment --environment staging
 *   npm run cms:migrate-fixed-blocks -- --dry-run
 *   npm run cms:migrate-fixed-blocks -- --dry-run --page-key products --environment staging
 *   npm run cms:migrate-fixed-blocks -- --apply --environment staging --qualified-run <id>
 *   npm run cms:migrate-fixed-blocks -- --rollback --qualified-run <id> --environment staging
 *
 * Never invoked from application startup, CI apply, or preview builds.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CMS_SCHEMA_VERSION,
  MG5_EVENTS,
  MG5_MIGRATION_VERSION,
  MG5_PRODUCTION_CONFIRM_PHRASE,
  assertApplyGates,
  mg5EnvironmentVerifyInputFromEnv,
  runMg5Apply,
  runMg5DryRun,
  runMg5Rollback,
  toSafeMg5EnvironmentDiagnostics,
  verifyMg5DeploymentTarget,
  type BuiltinCmsPage,
  type Mg5BackupArtifact,
  type Mg5BackupPort,
  type Mg5Environment,
  type Mg5OperatorPageRecord,
  type Mg5PersistencePort,
  type Mg5QualificationRecord,
} from "@mccoy/cms-schema";
import {
  DEFAULT_CMS_SITE_ID,
  getCmsStore,
  hasSupabaseServiceConfig,
} from "@mccoy/database/server";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultBackupRoot = path.join(root, ".data", "mg5-backups");

const ALLOWED_ENVIRONMENTS = new Set<Mg5Environment>([
  "local",
  "staging",
  "production",
  "test",
]);

type CliArgs = {
  dryRun: boolean;
  apply: boolean;
  rollback: boolean;
  verifyEnvironment: boolean;
  environment: Mg5Environment;
  pageId?: string;
  pageKey?: string;
  qualifiedRun?: string;
  confirmProduction?: string;
  output?: string;
  backupDir: string;
  migrationMode: "family" | "full";
  fixtureDir?: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    apply: false,
    rollback: false,
    verifyEnvironment: false,
    environment: "local",
    backupDir: defaultBackupRoot,
    migrationMode: "family",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    const next = argv[i + 1];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--apply") args.apply = true;
    else if (a === "--rollback") args.rollback = true;
    else if (a === "--verify-environment") args.verifyEnvironment = true;
    else if (a === "--force" || a === "--skip" || a === "--ignore" || a.startsWith("--force-") || a.startsWith("--skip-") || a.startsWith("--ignore-")) {
      console.error(
        `Rejected unsafe flag "${a}". MG5 has no force/skip/ignore bypass; fix environment identity instead.`,
      );
      process.exit(2);
    } else if (a === "--environment" && next) {
      if (!ALLOWED_ENVIRONMENTS.has(next as Mg5Environment)) {
        console.error(
          `Invalid --environment "${next}". Expected local|staging|production|test.`,
        );
        process.exit(2);
      }
      args.environment = next as Mg5Environment;
      i += 1;
    } else if (a === "--page-id" && next) {
      args.pageId = next;
      i += 1;
    } else if (a === "--page-key" && next) {
      args.pageKey = next;
      i += 1;
    } else if (a === "--qualified-run" && next) {
      args.qualifiedRun = next;
      i += 1;
    } else if (a === "--confirm-production" && next) {
      args.confirmProduction = next;
      i += 1;
    } else if (a === "--output" && next) {
      args.output = next;
      i += 1;
    } else if (a === "--backup-dir" && next) {
      args.backupDir = path.resolve(next);
      i += 1;
    } else if (a === "--mode" && next) {
      args.migrationMode = next === "full" ? "full" : "family";
      i += 1;
    } else if (a === "--fixture-dir" && next) {
      args.fixtureDir = path.resolve(next);
      i += 1;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("-")) {
      console.error(`Unknown flag "${a}".`);
      printHelp();
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`MG5 fixed→blocks migration operator (${MG5_MIGRATION_VERSION})

Modes (exactly one):
  --verify-environment
  --dry-run
  --apply
  --rollback

Options:
  --environment local|staging|production|test
  --page-id <id>
  --page-key <key>
  --qualified-run <dry-run-id>   (required for apply/rollback)
  --confirm-production "${MG5_PRODUCTION_CONFIRM_PHRASE}"
  --mode family|full            (default family)
  --output <report.json>
  --backup-dir <dir>            (default .data/mg5-backups)
  --fixture-dir <dir>           (offline fixture pages; no DB writes)

Deployment identity (staging/production, non-fixture):
  MCCOY_ENVIRONMENT=staging|production|development
  MCCOY_STAGING_SUPABASE_PROJECT_ID=<ref>
  MCCOY_PRODUCTION_SUPABASE_PROJECT_ID=<ref>
  Branch development|dev → staging; branch main → production
  Current project ref derived from SUPABASE_URL / VITE_SUPABASE_URL

Safety:
  Dry-run never writes CMS records.
  Staging/production refuse mismatched env/branch/project allowlist (fail-closed).
  Shared staging=production Supabase project is refused for staging qualification.
  Apply refuses stale qualification / missing backup / unresolved conflicts.
  Production apply requires explicit confirm phrase.
  No --force / --skip / --ignore flags.
  Never run from app startup or CI apply jobs.
`);
}

function readGitBranch(cwd: string): string | null {
  try {
    const out = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function requireDeploymentTarget(args: CliArgs): void {
  // Offline fixtures never bind to live Supabase allowlists.
  if (args.fixtureDir) return;
  if (args.environment !== "staging" && args.environment !== "production") return;

  const verification = verifyMg5DeploymentTarget(
    mg5EnvironmentVerifyInputFromEnv({
      requestedEnvironment: args.environment,
      gitBranch: readGitBranch(root),
    }),
  );
  const safe = toSafeMg5EnvironmentDiagnostics(verification);
  logEvent("mg5.env.verified", safe);
  if (!verification.ok) {
    console.error(
      `MG5 environment verification FAILED (${verification.code ?? "unknown"}): ${verification.reason}`,
    );
    console.error(
      JSON.stringify(
        {
          environment: safe.environment,
          branch: safe.branch,
          supabaseProjectRef: safe.supabaseProjectRef,
          targetVerified: safe.targetVerified,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }
}

function logEvent(name: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event: name, ...fields }));
}

async function createFixturePersistence(fixtureDir: string): Promise<Mg5PersistencePort> {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(fixtureDir)).filter((f) => f.endsWith(".json"));
  const pages = new Map<string, Mg5OperatorPageRecord>();
  for (const file of files) {
    const text = (await readFile(path.join(fixtureDir, file), "utf8")).replace(/^\uFEFF/, "");
    const raw = JSON.parse(text) as {
      draftRevisionNumber?: number;
      payload?: BuiltinCmsPage;
    } & BuiltinCmsPage;
    const payload = (raw.payload ?? raw) as BuiltinCmsPage;
    if (payload.kind !== "builtin" || !payload.pageKey) continue;
    pages.set(payload.id, {
      pageId: payload.id,
      pageKey: payload.pageKey,
      draftRevisionNumber: raw.draftRevisionNumber ?? 1,
      payload,
    });
  }
  return {
    async listBuiltinPages(filter) {
      return [...pages.values()].filter((p) => {
        if (filter?.pageId && p.pageId !== filter.pageId) return false;
        if (filter?.pageKey && p.pageKey !== filter.pageKey) return false;
        return true;
      });
    },
    async saveDraftAtomic() {
      throw new Error("Fixture persistence is read-only. Dry-run only.");
    },
    async readDraft(pageId) {
      return pages.get(pageId) ?? null;
    },
  };
}

async function createStorePersistence(siteId: string): Promise<Mg5PersistencePort> {
  const store = getCmsStore();
  return {
    async listBuiltinPages(filter) {
      const all = await store.listPages(siteId);
      const out: Mg5OperatorPageRecord[] = [];
      for (const row of all) {
        if (filter?.pageId && row.id !== filter.pageId) continue;
        const draft = await store.getDraftPayload(row.id, siteId);
        if (!draft || draft.kind !== "builtin" || !draft.pageKey) continue;
        if (filter?.pageKey && draft.pageKey !== filter.pageKey) continue;
        out.push({
          pageId: row.id,
          pageKey: draft.pageKey,
          draftRevisionNumber: row.draftRevisionNumber,
          payload: draft,
        });
      }
      return out;
    },
    async saveDraftAtomic(input) {
      return store.saveDraft({
        siteId,
        pageId: input.pageId,
        expectedRevisionNumber: input.expectedRevisionNumber,
        payload: input.payload,
        changes: { payload: input.payload },
      });
    },
    async readDraft(pageId) {
      const row = await store.getPage(pageId, siteId);
      if (!row) return null;
      const draft = await store.getDraftPayload(pageId, siteId);
      if (!draft || draft.kind !== "builtin" || !draft.pageKey) return null;
      return {
        pageId,
        pageKey: draft.pageKey,
        draftRevisionNumber: row.draftRevisionNumber,
        payload: draft,
      };
    },
  };
}

function createBackupPort(backupDir: string): Mg5BackupPort {
  return {
    async writeArtifact(artifact) {
      await mkdir(backupDir, { recursive: true });
      const filePath = path.join(backupDir, `${artifact.runId}.backup.json`);
      await writeFile(filePath, JSON.stringify(artifact, null, 2), "utf8");
      // Never commit production backups — .data/ is gitignored.
      return { path: filePath };
    },
    async readArtifact(runId) {
      try {
        const raw = await readFile(path.join(backupDir, `${runId}.backup.json`), "utf8");
        return JSON.parse(raw) as Mg5BackupArtifact;
      } catch {
        return null;
      }
    },
  };
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function main() {
  ensureMonorepoEnvLoaded();
  const args = parseArgs(process.argv.slice(2));
  const modes = [args.verifyEnvironment, args.dryRun, args.apply, args.rollback].filter(
    Boolean,
  ).length;
  if (modes !== 1) {
    console.error(
      "Specify exactly one of --verify-environment | --dry-run | --apply | --rollback",
    );
    printHelp();
    process.exit(2);
  }

  if (args.verifyEnvironment) {
    const verification = verifyMg5DeploymentTarget(
      mg5EnvironmentVerifyInputFromEnv({
        requestedEnvironment: args.environment,
        gitBranch: readGitBranch(root),
      }),
    );
    const safe = toSafeMg5EnvironmentDiagnostics(verification);
    console.log(JSON.stringify(safe, null, 2));
    process.exit(verification.ok ? 0 : 2);
  }

  // Staging/production against a live store require positive identity (fail-closed).
  requireDeploymentTarget(args);

  if (args.apply) {
    const gate = assertApplyGates({
      environment: args.environment,
      mode: "apply",
      qualifiedRunId: args.qualifiedRun,
      confirmProduction: args.confirmProduction,
    });
    if (!gate.ok) {
      console.error(gate.reason);
      process.exit(2);
    }
  }

  const siteId = process.env.CMS_SITE_ID ?? DEFAULT_CMS_SITE_ID;
  const persistence = args.fixtureDir
    ? await createFixturePersistence(args.fixtureDir)
    : await createStorePersistence(siteId);

  if (!args.fixtureDir && args.apply && !hasSupabaseServiceConfig()) {
    console.error("Apply requires Supabase service credentials (or use --fixture-dir for dry-run only).");
    process.exit(2);
  }
  if (args.fixtureDir && (args.apply || args.rollback)) {
    console.error("--fixture-dir supports --dry-run only (read-only).");
    process.exit(2);
  }

  const backupPort = createBackupPort(args.backupDir);
  const qualPath = (runId: string) => path.join(args.backupDir, `${runId}.qualification.json`);

  logEvent(MG5_EVENTS.runStarted, {
    migrationVersion: MG5_MIGRATION_VERSION,
    schemaVersion: CMS_SCHEMA_VERSION,
    environment: args.environment,
    mode: args.dryRun ? "dry-run" : args.apply ? "apply" : "rollback",
    pageId: args.pageId ?? null,
    pageKey: args.pageKey ?? null,
  });

  if (args.dryRun) {
    const { report, qualification } = await runMg5DryRun(persistence, {
      environment: args.environment,
      pageId: args.pageId,
      pageKey: args.pageKey,
      migrationMode: args.migrationMode,
    });
    await mkdir(args.backupDir, { recursive: true });
    await writeJson(qualPath(qualification.runId), qualification);
    const out = args.output ?? path.join(args.backupDir, `${qualification.runId}.report.json`);
    await writeJson(out, report);
    logEvent(MG5_EVENTS.runCompleted, {
      runId: report.runId,
      pagesScanned: report.pagesScanned,
      pagesChanged: report.pagesChanged,
      pagesBlocked: report.pagesBlocked,
      pagesFailed: report.pagesFailed,
      output: out,
      qualification: qualPath(qualification.runId),
    });
    console.log(
      `Dry-run complete. runId=${report.runId} changed=${report.pagesChanged} blocked=${report.pagesBlocked}`,
    );
    process.exit(report.pagesFailed > 0 || report.pagesBlocked > 0 ? 1 : 0);
  }

  if (args.apply) {
    const runId = args.qualifiedRun!;
    const qualRaw = await readFile(qualPath(runId), "utf8");
    const qualification = JSON.parse(qualRaw) as Mg5QualificationRecord;
    const report = await runMg5Apply(persistence, backupPort, qualification, {
      environment: args.environment,
      mode: "apply",
      pageId: args.pageId,
      pageKey: args.pageKey,
      qualifiedRunId: runId,
      confirmProduction: args.confirmProduction,
      migrationMode: args.migrationMode,
    });
    const out = args.output ?? path.join(args.backupDir, `${runId}.apply-report.json`);
    await writeJson(out, report);
    logEvent(MG5_EVENTS.runCompleted, {
      runId: report.runId,
      pagesChanged: report.pagesChanged,
      pagesFailed: report.pagesFailed,
      qualificationStale: report.qualificationStale,
      output: out,
    });
    if (report.qualificationStale || report.pagesFailed > 0) process.exit(1);
    console.log(`Apply complete. changed=${report.pagesChanged} failed=${report.pagesFailed}`);
    process.exit(0);
  }

  // rollback
  const runId = args.qualifiedRun;
  if (!runId) {
    console.error("Rollback requires --qualified-run <id>");
    process.exit(2);
  }
  const artifact = await backupPort.readArtifact(runId);
  if (!artifact) {
    console.error(`Backup artifact not found for ${runId} in ${args.backupDir}`);
    process.exit(2);
  }
  const applyReportPath = path.join(args.backupDir, `${runId}.apply-report.json`);
  let expectedAfterHashes: Record<string, string> | undefined;
  try {
    const applyReport = JSON.parse(await readFile(applyReportPath, "utf8")) as {
      results: Array<{ pageId: string; afterHash: string; applyStatus: string }>;
    };
    expectedAfterHashes = {};
    for (const r of applyReport.results) {
      if (r.applyStatus === "applied") expectedAfterHashes[r.pageId] = r.afterHash;
    }
  } catch {
    // Optional divergence check when apply report absent.
  }
  const report = await runMg5Rollback(persistence, artifact, {
    environment: args.environment,
    expectedAfterHashes,
  });
  const out = args.output ?? path.join(args.backupDir, `${runId}.rollback-report.json`);
  await writeJson(out, report);
  logEvent(MG5_EVENTS.runCompleted, {
    runId: report.runId,
    pagesChanged: report.pagesChanged,
    pagesFailed: report.pagesFailed,
    output: out,
  });
  process.exit(report.pagesFailed > 0 || report.pagesBlocked > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
