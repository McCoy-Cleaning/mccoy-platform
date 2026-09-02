import { defineConfig, devices } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

import { qualificationMailpitSmtpEnv } from "./e2e/helpers/customer-portal-qual-env";

ensureMonorepoEnvLoaded();
Object.assign(process.env, qualificationMailpitSmtpEnv());
process.env.E2E_CUSTOMER_PORTAL_QUAL ??= "1";
process.env.STOREFRONT_ORIGIN ??=
  process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";

const STOREFRONT_ORIGIN = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";
const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5184";
const STOREFRONT_PORT = Number(new URL(STOREFRONT_ORIGIN).port || 5183);
const ADMIN_PORT = Number(new URL(ADMIN_ORIGIN).port || 5184);

const AUTH_DIR = join(process.cwd(), "e2e", ".auth");
const STAFF_AUTH_FILE = join(AUTH_DIR, "staff-qual.json");

if (!existsSync(AUTH_DIR)) mkdirSync(AUTH_DIR, { recursive: true });

const LOCAL_SUPABASE_URL = process.env.QUALIFICATION_SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_PUBLISHABLE =
  process.env.QUALIFICATION_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "";
const LOCAL_SECRET =
  process.env.QUALIFICATION_SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  "";

function customerPortalServerEnv(): Record<string, string> {
  if (!LOCAL_PUBLISHABLE || !LOCAL_SECRET) {
    throw new Error(
      "Missing QUALIFICATION_SUPABASE_PUBLISHABLE_KEY / QUALIFICATION_SUPABASE_SECRET_KEY " +
        "(or SUPABASE_*). Load monorepo env or export keys from `supabase status -o env`.",
    );
  }
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.QUALIFICATION_SUPABASE_URL = LOCAL_SUPABASE_URL;
  env.QUALIFICATION_SUPABASE_PUBLISHABLE_KEY = LOCAL_PUBLISHABLE;
  env.QUALIFICATION_SUPABASE_SECRET_KEY = LOCAL_SECRET;
  env.SUPABASE_URL = LOCAL_SUPABASE_URL;
  env.SUPABASE_PUBLISHABLE_KEY = LOCAL_PUBLISHABLE;
  env.SUPABASE_SECRET_KEY = LOCAL_SECRET;
  env.VITE_SUPABASE_URL = LOCAL_SUPABASE_URL;
  env.VITE_SUPABASE_PUBLISHABLE_KEY = LOCAL_PUBLISHABLE;
  env.STOREFRONT_ORIGIN = STOREFRONT_ORIGIN;
  env.VITE_STOREFRONT_ORIGIN = STOREFRONT_ORIGIN;
  env.VITE_ADMIN_ORIGIN = ADMIN_ORIGIN;
  env.E2E_STOREFRONT_ORIGIN = STOREFRONT_ORIGIN;
  env.E2E_ADMIN_ORIGIN = ADMIN_ORIGIN;
  env.E2E_CUSTOMER_PORTAL_QUAL = "1";
  env.MCCOY_E2E = "1";
  env.HOST_ENFORCE = "auto";
  env.ADMIN_LEGACY_AUTH = "false";
  env.COMMERCE_CRON_SECRET =
    process.env.COMMERCE_CRON_SECRET ?? "qual-commerce-cron-secret-not-production";
  Object.assign(env, qualificationMailpitSmtpEnv());
  return env;
}

const sharedEnv = customerPortalServerEnv();
const useDevServers = process.env.E2E_USE_DEV !== "0";
const buildScript = process.env.E2E_BUILD_MODE === "development" ? "build:dev" : "build";
const usePreview = !useDevServers;
const reuse = process.env.E2E_REUSE_SERVER === "1";

function cleanDistCommand(distPath: string): string {
  return `node -e "require('fs').rmSync('${distPath}',{recursive:true,force:true})"`;
}

export default defineConfig({
  testDir: "./e2e/customer-portal",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-customer-portal" }]],
  timeout: 180_000,
  use: {
    baseURL: STOREFRONT_ORIGIN,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
    locale: "nl-NL",
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },
  globalSetup: "./e2e/customer-portal/global-setup.ts",
  projects: [
    {
      name: "customer-portal-setup",
      testDir: "./e2e/customer-portal",
      testMatch: /customer-portal\.setup\.ts/,
    },
    {
      name: "customer-portal-staff",
      dependencies: ["customer-portal-setup"],
      testMatch: /(abc|transfer)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: STAFF_AUTH_FILE,
      },
    },
    {
      name: "customer-portal",
      testMatch: /\.spec\.ts/,
      testIgnore: [/customer-portal\.setup\.ts/, /abc\.spec\.ts/, /transfer\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
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
      url: `${ADMIN_ORIGIN}/login`,
      reuseExistingServer: reuse,
      timeout: 600_000,
      env: sharedEnv,
    },
  ],
});
