/**
 * MG5 deployment-target verification — fail-closed, no bypass flags.
 *
 * Authoritative mapping:
 * - git branch `development` | `dev` → staging
 * - git branch `main` → production
 * - Vercel follows the same branch → environment model
 *
 * Required env (operator / deploy):
 * - MCCOY_ENVIRONMENT=staging|production|development
 * - MCCOY_STAGING_SUPABASE_PROJECT_ID
 * - MCCOY_PRODUCTION_SUPABASE_PROJECT_ID
 * - SUPABASE_URL (or VITE_SUPABASE_URL) for current project ref
 */

import type { Mg5Environment } from "./mg5-operator";

/** Declared deployment / operator environment label. */
export type MccoyEnvironmentName = "staging" | "production" | "development";

export type Mg5EnvironmentVerifyInput = {
  /** Value of MCCOY_ENVIRONMENT. */
  mccoyEnvironment?: string | null;
  /** Current git branch (abbrev-ref). */
  gitBranch?: string | null;
  /** Active Supabase URL (SUPABASE_URL or VITE_SUPABASE_URL). */
  supabaseUrl?: string | null;
  /** Allowlisted staging project ref. */
  stagingProjectId?: string | null;
  /** Allowlisted production project ref. */
  productionProjectId?: string | null;
  /**
   * CLI `--environment` target.
   * `test` / `local` skip deployment binding (offline fixtures / local sandbox).
   * `staging` / `production` require full positive verification.
   */
  requestedEnvironment: Mg5Environment;
};

export type Mg5EnvironmentDiagnostics = {
  environment: MccoyEnvironmentName | null;
  branch: string | null;
  /** Redacted project ref safe for logs (never a secret). */
  supabaseProjectRef: string | null;
  targetVerified: boolean;
};

export type Mg5EnvironmentVerifyResult = Mg5EnvironmentDiagnostics & {
  ok: boolean;
  /** Stable machine-readable failure code when !ok. */
  code?: string;
  /** Human-readable reason (no secrets). */
  reason?: string;
  /** Unredacted ref for internal compare only — omitted from CLI safe logs. */
  projectRef?: string | null;
};

const DECLARED_ENVS = new Set<MccoyEnvironmentName>([
  "staging",
  "production",
  "development",
]);

const STAGING_BRANCHES = new Set(["development", "dev"]);
const PRODUCTION_BRANCHES = new Set(["main"]);

export function normalizeProjectRef(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

/** Extract Supabase project ref from a project URL host. */
export function extractSupabaseProjectRef(
  supabaseUrl: string | null | undefined,
): string | null {
  if (supabaseUrl == null || !supabaseUrl.trim()) return null;
  try {
    const url = new URL(supabaseUrl.trim());
    const host = url.hostname.toLowerCase();
    // https://<ref>.supabase.co
    const m = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    if (m?.[1]) return m[1];
    return null;
  } catch {
    return null;
  }
}

/** Safe diagnostic form: abcd…wxyz (or shorter full if tiny). */
export function redactProjectRef(ref: string | null | undefined): string | null {
  if (ref == null || !ref) return null;
  if (ref.length <= 8) return ref;
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`;
}

export function parseMccoyEnvironment(
  value: string | null | undefined,
): MccoyEnvironmentName | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (DECLARED_ENVS.has(normalized as MccoyEnvironmentName)) {
    return normalized as MccoyEnvironmentName;
  }
  return null;
}

export function expectedBranchesForEnvironment(
  environment: "staging" | "production",
): readonly string[] {
  return environment === "staging" ? ["development", "dev"] : ["main"];
}

export function branchMatchesEnvironment(
  branch: string | null | undefined,
  environment: "staging" | "production",
): boolean {
  if (!branch) return false;
  const name = branch.trim();
  if (environment === "staging") return STAGING_BRANCHES.has(name);
  return PRODUCTION_BRANCHES.has(name);
}

/**
 * Verify CLI target against declared env, branch, and Supabase allowlists.
 * Fail-closed: any mismatch / missing input returns ok:false. No force/skip.
 */
export function verifyMg5DeploymentTarget(
  input: Mg5EnvironmentVerifyInput,
): Mg5EnvironmentVerifyResult {
  const requested = input.requestedEnvironment;

  // Offline / sandbox operator modes — do not bind to deploy allowlists.
  if (requested === "test" || requested === "local") {
    const declared = parseMccoyEnvironment(input.mccoyEnvironment);
    const projectRef = extractSupabaseProjectRef(input.supabaseUrl);
    return {
      ok: true,
      environment: declared,
      branch: input.gitBranch?.trim() || null,
      supabaseProjectRef: redactProjectRef(projectRef),
      projectRef,
      targetVerified: true,
      reason: `Requested environment "${requested}" does not require deployment allowlist binding.`,
    };
  }

  if (requested !== "staging" && requested !== "production") {
    return fail(input, {
      code: "mg5.env.unsupported_requested",
      reason: `Unsupported requested environment "${String(requested)}".`,
    });
  }

  const rawDeclared = input.mccoyEnvironment?.trim() ?? "";
  if (!rawDeclared) {
    return fail(input, {
      code: "mg5.env.missing_mccoy_environment",
      reason:
        "MCCOY_ENVIRONMENT is required (staging|production|development) before staging/production MG5 operations.",
    });
  }

  const declared = parseMccoyEnvironment(rawDeclared);
  if (!declared) {
    return fail(input, {
      code: "mg5.env.invalid_mccoy_environment",
      reason: `MCCOY_ENVIRONMENT="${rawDeclared}" is invalid. Expected staging|production|development.`,
    });
  }

  // development label is for local/dev tooling — never a staging/production migrate target.
  if (declared === "development") {
    return fail(input, {
      code: "mg5.env.development_not_deploy_target",
      reason:
        'MCCOY_ENVIRONMENT=development is not a deploy target. Use staging (branch development|dev) or production (branch main).',
      environment: declared,
    });
  }

  if (declared !== requested) {
    return fail(input, {
      code: "mg5.env.cli_mismatch",
      reason: `CLI --environment=${requested} does not match MCCOY_ENVIRONMENT=${declared}.`,
      environment: declared,
    });
  }

  const branch = input.gitBranch?.trim() || null;
  if (!branch) {
    return fail(input, {
      code: "mg5.env.missing_branch",
      reason: "Current git branch could not be determined.",
      environment: declared,
    });
  }

  if (!branchMatchesEnvironment(branch, requested)) {
    const expected = expectedBranchesForEnvironment(requested).join("|");
    return fail(input, {
      code: "mg5.env.branch_mismatch",
      reason: `Branch "${branch}" is not allowed for ${requested}. Expected ${expected}.`,
      environment: declared,
      branch,
    });
  }

  const stagingId = normalizeProjectRef(input.stagingProjectId);
  const productionId = normalizeProjectRef(input.productionProjectId);

  if (!stagingId) {
    return fail(input, {
      code: "mg5.env.missing_staging_project_id",
      reason: "MCCOY_STAGING_SUPABASE_PROJECT_ID is required and must be a project ref.",
      environment: declared,
      branch,
    });
  }
  if (!productionId) {
    return fail(input, {
      code: "mg5.env.missing_production_project_id",
      reason:
        "MCCOY_PRODUCTION_SUPABASE_PROJECT_ID is required and must be a project ref.",
      environment: declared,
      branch,
    });
  }

  if (stagingId === productionId) {
    return fail(input, {
      code: "mg5.env.shared_supabase_project",
      reason:
        "Staging and production Supabase project IDs are identical. A separate staging database is required; shared production DB cannot be used for staging qualification.",
      environment: declared,
      branch,
      projectRef: extractSupabaseProjectRef(input.supabaseUrl),
    });
  }

  const projectRef = extractSupabaseProjectRef(input.supabaseUrl);
  if (!projectRef) {
    return fail(input, {
      code: "mg5.env.unresolvable_project_ref",
      reason:
        "Could not derive Supabase project ref from SUPABASE_URL (or VITE_SUPABASE_URL).",
      environment: declared,
      branch,
    });
  }

  const expectedId = requested === "staging" ? stagingId : productionId;
  if (projectRef !== expectedId) {
    return fail(input, {
      code: "mg5.env.project_allowlist_mismatch",
      reason: `Current Supabase project ${redactProjectRef(projectRef)} is not the allowlisted ${requested} project ${redactProjectRef(expectedId)}.`,
      environment: declared,
      branch,
      projectRef,
    });
  }

  return {
    ok: true,
    environment: declared,
    branch,
    supabaseProjectRef: redactProjectRef(projectRef),
    projectRef,
    targetVerified: true,
  };
}

function fail(
  input: Mg5EnvironmentVerifyInput,
  parts: {
    code: string;
    reason: string;
    environment?: MccoyEnvironmentName | null;
    branch?: string | null;
    projectRef?: string | null;
  },
): Mg5EnvironmentVerifyResult {
  const projectRef =
    parts.projectRef !== undefined
      ? parts.projectRef
      : extractSupabaseProjectRef(input.supabaseUrl);
  return {
    ok: false,
    code: parts.code,
    reason: parts.reason,
    environment:
      parts.environment !== undefined
        ? parts.environment
        : parseMccoyEnvironment(input.mccoyEnvironment),
    branch:
      parts.branch !== undefined
        ? parts.branch
        : input.gitBranch?.trim() || null,
    supabaseProjectRef: redactProjectRef(projectRef),
    projectRef,
    targetVerified: false,
  };
}

/** Build verify input from process env + resolved branch (CLI helper). */
export function mg5EnvironmentVerifyInputFromEnv(options: {
  requestedEnvironment: Mg5Environment;
  gitBranch: string | null;
  env?: NodeJS.ProcessEnv;
}): Mg5EnvironmentVerifyInput {
  const env = options.env ?? process.env;
  return {
    requestedEnvironment: options.requestedEnvironment,
    gitBranch: options.gitBranch,
    mccoyEnvironment: env.MCCOY_ENVIRONMENT,
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    stagingProjectId: env.MCCOY_STAGING_SUPABASE_PROJECT_ID,
    productionProjectId: env.MCCOY_PRODUCTION_SUPABASE_PROJECT_ID,
  };
}

/** Safe fields for operator logs / reports (no keys, no full secrets). */
export function toSafeMg5EnvironmentDiagnostics(
  result: Mg5EnvironmentVerifyResult,
): Mg5EnvironmentDiagnostics & { ok: boolean; code?: string; reason?: string } {
  return {
    ok: result.ok,
    environment: result.environment,
    branch: result.branch,
    supabaseProjectRef: result.supabaseProjectRef,
    targetVerified: result.targetVerified,
    code: result.code,
    reason: result.reason,
  };
}
