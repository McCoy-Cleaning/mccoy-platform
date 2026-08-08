import { describe, expect, it } from "vitest";
import {
  branchMatchesEnvironment,
  extractSupabaseProjectRef,
  mg5EnvironmentVerifyInputFromEnv,
  parseMccoyEnvironment,
  redactProjectRef,
  toSafeMg5EnvironmentDiagnostics,
  verifyMg5DeploymentTarget,
} from "./mg5-environment";

const STAGING_REF = "abcdefghij1234567890";
const PRODUCTION_REF = "zyxwvutsrq0987654321";

function stagingOk(
  overrides: Partial<Parameters<typeof verifyMg5DeploymentTarget>[0]> = {},
) {
  return verifyMg5DeploymentTarget({
    requestedEnvironment: "staging",
    mccoyEnvironment: "staging",
    gitBranch: "development",
    supabaseUrl: `https://${STAGING_REF}.supabase.co`,
    stagingProjectId: STAGING_REF,
    productionProjectId: PRODUCTION_REF,
    ...overrides,
  });
}

function productionOk(
  overrides: Partial<Parameters<typeof verifyMg5DeploymentTarget>[0]> = {},
) {
  return verifyMg5DeploymentTarget({
    requestedEnvironment: "production",
    mccoyEnvironment: "production",
    gitBranch: "main",
    supabaseUrl: `https://${PRODUCTION_REF}.supabase.co`,
    stagingProjectId: STAGING_REF,
    productionProjectId: PRODUCTION_REF,
    ...overrides,
  });
}

describe("MG5 environment helpers", () => {
  it("extracts and redacts supabase project refs", () => {
    expect(extractSupabaseProjectRef(`https://${STAGING_REF}.supabase.co`)).toBe(
      STAGING_REF,
    );
    expect(extractSupabaseProjectRef("https://example.com")).toBeNull();
    expect(extractSupabaseProjectRef("not-a-url")).toBeNull();
    expect(redactProjectRef(STAGING_REF)).toBe("abcd…7890");
    expect(parseMccoyEnvironment("Staging")).toBe("staging");
    expect(parseMccoyEnvironment("nope")).toBeNull();
    expect(branchMatchesEnvironment("dev", "staging")).toBe(true);
    expect(branchMatchesEnvironment("development", "staging")).toBe(true);
    expect(branchMatchesEnvironment("main", "production")).toBe(true);
    expect(branchMatchesEnvironment("development", "production")).toBe(false);
  });

  it("builds verify input from env map", () => {
    const input = mg5EnvironmentVerifyInputFromEnv({
      requestedEnvironment: "staging",
      gitBranch: "development",
      env: {
        MCCOY_ENVIRONMENT: "staging",
        SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
        MCCOY_STAGING_SUPABASE_PROJECT_ID: STAGING_REF,
        MCCOY_PRODUCTION_SUPABASE_PROJECT_ID: PRODUCTION_REF,
      },
    });
    expect(verifyMg5DeploymentTarget(input).ok).toBe(true);
  });
});

describe("MG5 deployment target verification", () => {
  it("accepts staging on development|dev with distinct allowlisted project", () => {
    const a = stagingOk();
    expect(a.ok).toBe(true);
    expect(a.targetVerified).toBe(true);
    expect(a.environment).toBe("staging");
    expect(a.branch).toBe("development");
    expect(a.supabaseProjectRef).toBe("abcd…7890");

    const b = stagingOk({ gitBranch: "dev" });
    expect(b.ok).toBe(true);
    expect(b.branch).toBe("dev");
  });

  it("accepts production on main with production allowlist", () => {
    const result = productionOk();
    expect(result.ok).toBe(true);
    expect(result.environment).toBe("production");
    expect(result.branch).toBe("main");
    expect(result.supabaseProjectRef).toBe("zyxw…4321");
  });

  it("allows test/local without deploy allowlists", () => {
    for (const requestedEnvironment of ["test", "local"] as const) {
      const result = verifyMg5DeploymentTarget({
        requestedEnvironment,
        mccoyEnvironment: undefined,
        gitBranch: "mg5-fixed-blocks-migration",
      });
      expect(result.ok).toBe(true);
      expect(result.targetVerified).toBe(true);
    }
  });

  it("fails closed when MCCOY_ENVIRONMENT missing or invalid", () => {
    expect(stagingOk({ mccoyEnvironment: null }).code).toBe(
      "mg5.env.missing_mccoy_environment",
    );
    expect(stagingOk({ mccoyEnvironment: "prod" }).code).toBe(
      "mg5.env.invalid_mccoy_environment",
    );
  });

  it("fails closed when MCCOY_ENVIRONMENT=development for deploy ops", () => {
    const result = stagingOk({ mccoyEnvironment: "development" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("mg5.env.development_not_deploy_target");
  });

  it("fails closed when CLI environment mismatches MCCOY_ENVIRONMENT", () => {
    const result = stagingOk({ mccoyEnvironment: "production" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("mg5.env.cli_mismatch");
  });

  it("fails closed on branch mismatches", () => {
    expect(stagingOk({ gitBranch: "main" }).code).toBe("mg5.env.branch_mismatch");
    expect(stagingOk({ gitBranch: "mg5-fixed-blocks-migration" }).code).toBe(
      "mg5.env.branch_mismatch",
    );
    expect(stagingOk({ gitBranch: null }).code).toBe("mg5.env.missing_branch");
    expect(productionOk({ gitBranch: "development" }).code).toBe(
      "mg5.env.branch_mismatch",
    );
    expect(productionOk({ gitBranch: "dev" }).code).toBe("mg5.env.branch_mismatch");
  });

  it("fails closed when allowlist project ids are missing", () => {
    expect(stagingOk({ stagingProjectId: "" }).code).toBe(
      "mg5.env.missing_staging_project_id",
    );
    expect(stagingOk({ productionProjectId: "  " }).code).toBe(
      "mg5.env.missing_production_project_id",
    );
  });

  it("STOPS when staging and production share the same Supabase project", () => {
    const result = stagingOk({
      stagingProjectId: STAGING_REF,
      productionProjectId: STAGING_REF,
    });
    expect(result.ok).toBe(false);
    expect(result.targetVerified).toBe(false);
    expect(result.code).toBe("mg5.env.shared_supabase_project");
    expect(result.reason).toMatch(/separate staging database/i);
  });

  it("fails closed when current project is not on the allowlist", () => {
    const result = stagingOk({
      supabaseUrl: `https://${PRODUCTION_REF}.supabase.co`,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("mg5.env.project_allowlist_mismatch");
  });

  it("fails closed when project ref cannot be derived", () => {
    expect(stagingOk({ supabaseUrl: null }).code).toBe(
      "mg5.env.unresolvable_project_ref",
    );
    expect(stagingOk({ supabaseUrl: "https://db.example.com" }).code).toBe(
      "mg5.env.unresolvable_project_ref",
    );
  });

  it("safe diagnostics omit unredacted internals and never invent force bypass", () => {
    const failed = stagingOk({ gitBranch: "main" });
    const safe = toSafeMg5EnvironmentDiagnostics(failed);
    expect(safe.targetVerified).toBe(false);
    expect(safe.supabaseProjectRef).toBe("abcd…7890");
    expect(JSON.stringify(safe)).not.toMatch(/force|skip|ignore/i);
    expect("projectRef" in safe).toBe(false);
  });
});
