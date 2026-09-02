import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createSupabaseServiceClient } from "../../supabase";
import { syncExistingServiceClients } from "../existing-customer-sync";
import type { QualificationSupabaseConfig } from "./env";
import { type QualificationCompanies, seedQualificationCompanies } from "./seed";

export type CustomerPortalE2eFixture = QualificationCompanies & {
  storefrontOrigin: string;
  /** Base32 TOTP secret for staff MFA (qualification E2E only). */
  staffTotpSecret?: string;
};

/** Deterministic 8-digit KVK for qualification mirror rows (unique per stable key). */
export function qualKvkForKey(key: string): string {
  let hash = 2_166_136_261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  const digits = 10_000_000 + (hash >>> 0) % 89_999_999;
  return String(digits).padStart(8, "0");
}

export type AbcFacilityE2eFixture = {
  suffix: string;
  externalCustomerId: string;
  companyId: string;
  staffActorId: string;
  peterEmail: string;
  sophieEmail: string;
};

const ABC_EXTERNAL_PREFIX = "abc-facility-e2e";

export async function seedCustomerPortalE2eFixtures(
  config: QualificationSupabaseConfig,
): Promise<CustomerPortalE2eFixture> {
  const fixtures = await seedQualificationCompanies(config);
  const storefrontOrigin =
    process.env.STOREFRONT_ORIGIN?.replace(/\/$/, "") || "http://localhost:5183";
  return { ...fixtures, storefrontOrigin };
}

export async function seedAbcFacilityMirrorAndSync(input: {
  suffix: string;
  staffActorId: string;
}): Promise<{ companyId: string; externalCustomerId: string }> {
  const externalCustomerId = `${ABC_EXTERNAL_PREFIX}-${input.suffix}`;
  const supabase = createSupabaseServiceClient();
  const { error: mirrorErr } = await supabase.from("commerce_legacy_service_clients").upsert(
    {
      external_customer_id: externalCustomerId,
      legal_name: "ABC Facility BV",
      display_name: "ABC Facility",
      kvk_number: qualKvkForKey(externalCustomerId),
      email: `abc-${input.suffix}@qual.mccoy.test`,
      invoice_allowed: true,
      company_status: "active",
      source_updated_at: new Date().toISOString(),
    },
    { onConflict: "external_customer_id" },
  );
  if (mirrorErr) throw new Error(`abc mirror: ${mirrorErr.message}`);

  await syncExistingServiceClients({
    actorUserId: input.staffActorId,
    externalCustomerIds: [externalCustomerId],
  });
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("external_customer_id", externalCustomerId)
    .maybeSingle();
  if (!company?.id) throw new Error("ABC Facility company not created after sync");
  return { companyId: String(company.id), externalCustomerId };
}

export async function seedAbcFacilityE2eScenario(
  config: QualificationSupabaseConfig,
  staffActorId: string,
): Promise<AbcFacilityE2eFixture> {
  const suffix = `${Date.now()}`;
  const { companyId, externalCustomerId } = await seedAbcFacilityMirrorAndSync({
    suffix,
    staffActorId,
  });
  return {
    suffix,
    externalCustomerId,
    companyId,
    staffActorId,
    peterEmail: `peter-${suffix}@qual.mccoy.test`,
    sophieEmail: `sophie-${suffix}@qual.mccoy.test`,
  };
}

export const CUSTOMER_PORTAL_E2E_FIXTURE_PATH = join(
  process.cwd(),
  "e2e",
  ".customer-portal-qual.json",
);

export function writeCustomerPortalE2eFixtureFile(
  fixture: CustomerPortalE2eFixture,
  path = CUSTOMER_PORTAL_E2E_FIXTURE_PATH,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(fixture, null, 2), "utf8");
}

export function readCustomerPortalE2eFixtureFileSync(
  path = CUSTOMER_PORTAL_E2E_FIXTURE_PATH,
): CustomerPortalE2eFixture {
  return JSON.parse(readFileSync(path, "utf8")) as CustomerPortalE2eFixture;
}
