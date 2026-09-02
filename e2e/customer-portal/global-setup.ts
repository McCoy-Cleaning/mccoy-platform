import { join } from "node:path";

import {
  applyQualificationEnv,
  isQualificationDbReachable,
} from "@mccoy/database/server";
import {
  seedCustomerPortalE2eFixtures,
  writeCustomerPortalE2eFixtureFile,
} from "@mccoy/database/server";
import { resetRateLimits } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

import {
  assertQualificationSupabaseUrl,
  qualificationMailpitSmtpEnv,
} from "../helpers/customer-portal-qual-env";
import { enrollStaffQualTotpSecret } from "../helpers/staff-qual-mfa";

export default async function customerPortalGlobalSetup(): Promise<void> {
  ensureMonorepoEnvLoaded();
  process.env.QUALIFICATION_SUPABASE_URL =
    process.env.QUALIFICATION_SUPABASE_URL ?? "http://127.0.0.1:54321";
  // Keys come from monorepo env / `supabase status` — never hardcode.

  // Outbox processing runs in this Playwright process — use Mailpit SMTP, not Graph/dev-skip.
  Object.assign(process.env, qualificationMailpitSmtpEnv());
  process.env.E2E_CUSTOMER_PORTAL_QUAL = "1";
  process.env.STOREFRONT_ORIGIN =
    process.env.E2E_STOREFRONT_ORIGIN ?? process.env.STOREFRONT_ORIGIN ?? "http://localhost:5183";

  const config = applyQualificationEnv();
  assertQualificationSupabaseUrl(config.url);

  const reachable = await isQualificationDbReachable();
  if (!reachable) {
    throw new Error(
      "Local qualification Supabase is not reachable at " +
        config.url +
        ". Start with: supabase start",
    );
  }

  const fixture = await seedCustomerPortalE2eFixtures(config);
  const staffEmail = `staff-qual-${fixture.suffix}@qual.mccoy.test`;
  let staffTotpSecret: string | undefined;
  try {
    staffTotpSecret = await enrollStaffQualTotpSecret({
      supabaseUrl: config.url,
      publishableKey: config.publishableKey,
      staffEmail,
      suffix: fixture.suffix,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already enrolled")) {
      console.warn(`[customer-portal global-setup] staff MFA skip: ${message}`);
    } else {
      throw error;
    }
  }

  writeCustomerPortalE2eFixtureFile(
    { ...fixture, staffTotpSecret },
    join(process.cwd(), "e2e", ".customer-portal-qual.json"),
  );
  resetRateLimits();
}
