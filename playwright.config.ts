import { defineConfig, devices } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

ensureMonorepoEnvLoaded();

const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5174";
const STOREFRONT_ORIGIN = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5173";

function originPort(origin: string, fallback: number): number {
  try {
    const port = Number(new URL(origin).port);
    return Number.isFinite(port) && port > 0 ? port : fallback;
  } catch {
    return fallback;
  }
}

const STOREFRONT_PORT = originPort(STOREFRONT_ORIGIN, 5173);
const ADMIN_PORT = originPort(ADMIN_ORIGIN, 5174);
const E2E_DATA_DIR = process.env.E2E_MCCOY_DATA_DIR ?? join(process.cwd(), ".data", "e2e-cms");
const AUTH_DIR = join(process.cwd(), "e2e", ".auth");
const AUTH_FILE = join(AUTH_DIR, "admin.json");

if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });
if (!existsSync(E2E_DATA_DIR)) mkdirSync(E2E_DATA_DIR, { recursive: true });

process.env.MCCOY_DATA_DIR = E2E_DATA_DIR;
process.env.VITE_ADMIN_ORIGIN = ADMIN_ORIGIN;
process.env.VITE_STOREFRONT_ORIGIN = STOREFRONT_ORIGIN;
process.env.ADMIN_LEGACY_AUTH = "true";

/**
 * E2E web servers must use legacy admin auth (no MFA) and an isolated CMS data dir.
 * Clear Supabase vars so Vite/.env cannot force the staff email+MFA UI.
 */
function e2eServerEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (
      key === "SUPABASE_URL" ||
      key === "SUPABASE_PUBLISHABLE_KEY" ||
      key === "SUPABASE_SECRET_KEY" ||
      key === "VITE_SUPABASE_URL" ||
      key === "VITE_SUPABASE_PUBLISHABLE_KEY"
    ) {
      continue;
    }
    env[key] = value;
  }
  env.MCCOY_DATA_DIR = E2E_DATA_DIR;
  env.VITE_ADMIN_ORIGIN = ADMIN_ORIGIN;
  env.VITE_STOREFRONT_ORIGIN = STOREFRONT_ORIGIN;
  env.ADMIN_LEGACY_AUTH = "true";
  env.MCCOY_E2E = "1";
  env.VITE_E2E_CMS = "1";
  env.HOST_ENFORCE = "auto";
  // Deterministic legacy credentials for CMS E2E (never production).
  env.ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || "admin";
  env.ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "mccoy2026";
  env.ADMIN_SESSION_SECRET =
    process.env.E2E_ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "mccoy-e2e-admin-session-secret-32b";
  // Explicit empties so load-monorepo-env won't refill from root .env when MCCOY_E2E=1
  env.SUPABASE_URL = "";
  env.SUPABASE_PUBLISHABLE_KEY = "";
  env.SUPABASE_SECRET_KEY = "";
  env.VITE_SUPABASE_URL = "";
  env.VITE_SUPABASE_PUBLISHABLE_KEY = "";
  // Prevent accidental real mailbox traffic during standard E2E.
  env.SMTP_HOST = "";
  env.SMTP_USER = "";
  env.SMTP_PASS = "";
  env.SMTP_PASSWORD = "";
  env.FORM_INBOX_USER = "";
  env.FORM_INBOX_PASS = "";
  env.TENANT_ID = "";
  env.CLIENT_ID = "";
  env.CLIENT_SECRET = "";
  env.MICROSOFT_GRAPH_TENANT_ID = "";
  env.MICROSOFT_GRAPH_CLIENT_ID = "";
  env.MICROSOFT_GRAPH_CLIENT_SECRET = "";
  // Avoid Content-AI / Groq side-effects and rate limits during CMS publish E2E.
  env.GROQ_API_KEY = "";
  env.CONTENT_AI_API_KEY = "";
  env.VITE_CONTENT_AI = "";
  return env;
}

const sharedEnv = e2eServerEnv();
/**
 * Prefer Vite preview after a production build. Set E2E_USE_DEV=1 for vite
 * `dev` servers when client production bundling of TanStack Start is broken.
 * Set E2E_BUILD_MODE=development to use `vite build --mode development` + preview
 * (production-like serving without full prod client minify constraints).
 */
const useDevServers = process.env.E2E_USE_DEV === "1";
const buildScript =
  process.env.E2E_BUILD_MODE === "development" ? "build:dev" : "build";
const usePreview = !useDevServers;
/** Never reuse by default — E2E requires MCCOY_E2E / legacy auth env on both servers. */
const reuse = process.env.E2E_REUSE_SERVER === "1";
const bravePath = process.env.BRAVE_PATH || process.env.PLAYWRIGHT_BRAVE_PATH;

/**
 * Vite's multi-environment (client + ssr) build for these apps does not
 * reliably empty `dist/` between runs (Vite treats a shared outDir across
 * environments as ambiguous and skips auto-cleaning it). Leftover chunks from
 * an earlier build/mode can then coexist with a fresh build's entry file,
 * which can reference a stale `server-*.js` chunk whose embedded
 * server-function manifest no longer matches the ids the fresh client bundle
 * calls (surfaces as "Server function info not found for ..."). Force a
 * clean `dist` before every E2E build so each run is self-consistent.
 */
function cleanDistCommand(distPath: string): string {
  return `node -e "require('fs').rmSync('${distPath}',{recursive:true,force:true})"`;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 120_000,
  // Platform-agnostic baselines so Windows local and Linux CI share the same files.
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: ADMIN_ORIGIN,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Keep video only when a failure needs a timeline; discard on pass.
    video: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    locale: "nl-NL",
    reducedMotion: "reduce",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  globalSetup: "./e2e/global-setup.ts",
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_FILE,
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ["--force-prefers-reduced-motion"],
        },
      },
      testIgnore: /auth\.setup\.ts|brave\.smoke\.ts|real-inbox\.integration\.ts/,
    },
    ...(bravePath
      ? [
          {
            name: "brave-smoke",
            dependencies: ["setup"],
            testMatch: /brave\.smoke\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              storageState: AUTH_FILE,
              launchOptions: {
                executablePath: bravePath,
                args: ["--force-prefers-reduced-motion"],
              },
            },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: usePreview
        ? `${cleanDistCommand("apps/storefront/dist")} && npm run ${buildScript} -w @mccoy/storefront && npm run preview -w @mccoy/storefront -- --host localhost --port ${STOREFRONT_PORT} --strictPort`
        : `npm run dev -w @mccoy/storefront -- --host localhost --port ${STOREFRONT_PORT} --strictPort`,
      url: STOREFRONT_ORIGIN,
      reuseExistingServer: reuse,
      timeout: 600_000,
      env: sharedEnv,
    },
    {
      command: usePreview
        ? `${cleanDistCommand("apps/admin/dist")} && npm run ${buildScript} -w @mccoy/admin && npm run preview -w @mccoy/admin -- --host localhost --port ${ADMIN_PORT} --strictPort`
        : `npm run dev -w @mccoy/admin -- --host localhost --port ${ADMIN_PORT} --strictPort`,
      url: `${ADMIN_ORIGIN}/admin/login`,
      reuseExistingServer: reuse,
      timeout: 600_000,
      env: sharedEnv,
    },
  ],
});
