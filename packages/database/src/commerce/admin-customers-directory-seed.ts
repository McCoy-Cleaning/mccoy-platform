/**
 * Non-production demo rows for the admin Klanten directory.
 * Gated by commerceFixturesAllowed() — never runs in production unless forced.
 */

import { normalizeEmail } from "@mccoy/domain";

import { generateInvitationToken, hashInvitationToken } from "../customer-portal/tokens";
import { createSupabaseServiceClient } from "../supabase";
import {
  addCompanyMember,
  createCompany,
  createOrder,
  insertCustomerProfile,
  mapCompany,
} from "./core";
import { commerceFixturesAllowed } from "./fixtures";
import { findAuthUserIdByEmail } from "../staff";
import {
  recordAdminCustomerImportRun,
  upsertCompanyDisplaySnapshot,
} from "./admin-customers-directory";
import type { Company, CompanyStatus, CompanyType } from "@mccoy/domain";

const DEMO_MARKER = "mccoy-admin-customers-demo";
const DEMO_IMPORT_FILE = "serviceklanten_2024.csv";

type DemoCompanySpec = {
  externalCustomerId: string;
  legalName: string;
  displayName: string;
  companyType: CompanyType;
  status: CompanyStatus;
  invoiceAllowed: boolean;
  email: string;
  contactPersonName: string;
  kvkNumber: string;
  vatNumber: string | null;
  addressStreet: string;
  addressHouseNumber: string;
  addressPostalCode: string;
  addressCity: string;
  portal: "active" | "invited" | "registration_required" | "blocked";
  outstandingMinor: number;
  lastOrder?: { subtotalMinor: number; taxMinor: number; totalMinor: number };
};

const DEMO_COMPANIES: readonly DemoCompanySpec[] = [
  {
    externalCustomerId: "DEMO-10482",
    legalName: "ABC Facility BV",
    displayName: "ABC Facility",
    companyType: "service_client",
    status: "active",
    invoiceAllowed: true,
    email: "info@abc-facility.mccoy.test",
    contactPersonName: "Jan de Vries",
    kvkNumber: "88000001",
    vatNumber: "NL880000001B01",
    addressStreet: "Hoofdstraat",
    addressHouseNumber: "12",
    addressPostalCode: "1234 AB",
    addressCity: "Amsterdam",
    portal: "active",
    outstandingMinor: 245000,
    lastOrder: { subtotalMinor: 10000, taxMinor: 2100, totalMinor: 12100 },
  },
  {
    externalCustomerId: "DEMO-10490",
    legalName: "Schoonmaakbedrijf EV BV",
    displayName: "Schoonmaakbedrijf EV",
    companyType: "service_client",
    status: "active",
    invoiceAllowed: false,
    email: "contact@ev-schoon.mccoy.test",
    contactPersonName: "Eva Visser",
    kvkNumber: "88000002",
    vatNumber: "NL880000002B01",
    addressStreet: "Industrieweg",
    addressHouseNumber: "8",
    addressPostalCode: "7553 AL",
    addressCity: "Hengelo",
    portal: "invited",
    outstandingMinor: 0,
  },
  {
    externalCustomerId: "DEMO-20011",
    legalName: "Twentse Glasgroothandel BV",
    displayName: "Twentse Glasgroothandel",
    companyType: "product_customer",
    status: "active",
    invoiceAllowed: true,
    email: "inkoop@twentsglas.mccoy.test",
    contactPersonName: "Mark Jansen",
    kvkNumber: "88000003",
    vatNumber: "NL880000003B01",
    addressStreet: "Havenkade",
    addressHouseNumber: "4",
    addressPostalCode: "7511 JM",
    addressCity: "Enschede",
    portal: "active",
    outstandingMinor: 89650,
    lastOrder: { subtotalMinor: 20000, taxMinor: 4200, totalMinor: 24200 },
  },
  {
    externalCustomerId: "DEMO-10491",
    legalName: "Hotel de Broeierd BV",
    displayName: "Hotel de Broeierd",
    companyType: "service_client",
    status: "active",
    invoiceAllowed: false,
    email: "facilitair@broeierd.mccoy.test",
    contactPersonName: "Lisa Hofman",
    kvkNumber: "88000004",
    vatNumber: null,
    addressStreet: "Broeierdlaan",
    addressHouseNumber: "20",
    addressPostalCode: "7523 ZA",
    addressCity: "Enschede",
    portal: "registration_required",
    outstandingMinor: 152000,
  },
  {
    externalCustomerId: "DEMO-10492",
    legalName: "Medisch Centrum Oldenzaal BV",
    displayName: "Medisch Centrum Oldenzaal",
    companyType: "service_client",
    status: "active",
    invoiceAllowed: true,
    email: "inkoop@mco.mccoy.test",
    contactPersonName: "Peter Bakker",
    kvkNumber: "88000005",
    vatNumber: "NL880000005B01",
    addressStreet: "Deurningerstraat",
    addressHouseNumber: "40",
    addressPostalCode: "7572 AC",
    addressCity: "Oldenzaal",
    portal: "active",
    outstandingMinor: 32000,
    lastOrder: { subtotalMinor: 5000, taxMinor: 1050, totalMinor: 6050 },
  },
  {
    externalCustomerId: "DEMO-20012",
    legalName: "Logistiek Hengelo BV",
    displayName: "Logistiek Hengelo",
    companyType: "product_customer",
    status: "active",
    invoiceAllowed: false,
    email: "office@logistiek-hengelo.mccoy.test",
    contactPersonName: "Sanne Mulder",
    kvkNumber: "88000006",
    vatNumber: "NL880000006B01",
    addressStreet: "Transportstraat",
    addressHouseNumber: "3",
    addressPostalCode: "7554 TR",
    addressCity: "Hengelo",
    portal: "invited",
    outstandingMinor: 0,
  },
  {
    externalCustomerId: "DEMO-10493",
    legalName: "CleanTech Services BV",
    displayName: "CleanTech Services",
    companyType: "service_client",
    status: "blocked",
    invoiceAllowed: false,
    email: "admin@cleantech.mccoy.test",
    contactPersonName: "Tom de Boer",
    kvkNumber: "88000007",
    vatNumber: null,
    addressStreet: "Parallelweg",
    addressHouseNumber: "18",
    addressPostalCode: "7602 AB",
    addressCity: "Almelo",
    portal: "blocked",
    outstandingMinor: 178900,
  },
  {
    externalCustomerId: "DEMO-10494",
    legalName: "Facilicom Twente BV",
    displayName: "Facilicom Twente",
    companyType: "service_client",
    status: "active",
    invoiceAllowed: true,
    email: "twente@facilicom.mccoy.test",
    contactPersonName: "Anita Groot",
    kvkNumber: "88000008",
    vatNumber: "NL880000008B01",
    addressStreet: "Bornsestraat",
    addressHouseNumber: "210",
    addressPostalCode: "7601 GJ",
    addressCity: "Almelo",
    portal: "active",
    outstandingMinor: 54000,
    lastOrder: { subtotalMinor: 8000, taxMinor: 1680, totalMinor: 9680 },
  },
];

async function ensureDemoAuthUser(email: string, fullName: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const existing = await findAuthUserIdByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { account_kind: "customer", [DEMO_MARKER]: true, full_name: fullName },
  });
  if (error || !data.user?.id) {
    const raced = await findAuthUserIdByEmail(email);
    if (raced) return raced;
    throw new Error(error?.message || "demo auth create failed");
  }
  return data.user.id;
}

async function ensureDemoCustomer(email: string, fullName: string): Promise<string> {
  const id = await ensureDemoAuthUser(email, fullName);
  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase.from("users").select("id").eq("id", id).maybeSingle();
  if (!existing) {
    await insertCustomerProfile({
      id,
      email,
      fullName,
      phone: null,
      status: "active",
      createdBy: null,
    });
  }
  return id;
}

async function ensureDemoCompany(spec: DemoCompanySpec): Promise<Company> {
  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase
    .from("companies")
    .select("*")
    .eq("external_customer_id", spec.externalCustomerId)
    .maybeSingle();
  if (existing) return mapCompany(existing as Parameters<typeof mapCompany>[0]);

  return createCompany({
    legalName: spec.legalName,
    displayName: spec.displayName,
    companyType: spec.companyType,
    status: spec.status,
    invoiceAllowed: spec.invoiceAllowed,
    email: spec.email,
    contactPersonName: spec.contactPersonName,
    kvkNumber: spec.kvkNumber,
    vatNumber: spec.vatNumber,
    addressStreet: spec.addressStreet,
    addressHouseNumber: spec.addressHouseNumber,
    addressPostalCode: spec.addressPostalCode,
    addressCity: spec.addressCity,
    addressCountry: "NL",
    externalCustomerId: spec.externalCustomerId,
    notes: DEMO_MARKER,
  });
}

async function ensurePendingInvite(companyId: string, email: string, name: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const emailNormalized = normalizeEmail(email);
  const { data: existing } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("id")
    .eq("company_id", companyId)
    .eq("email_normalized", emailNormalized)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return;

  const parts = name.trim().split(/\s+/);
  const { error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .insert({
      company_id: companyId,
      email,
      email_normalized: emailNormalized,
      intended_role: "account_admin",
      token_hash: hashInvitationToken(generateInvitationToken()),
      status: "pending",
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      invited_by_type: "staff",
      invitee_first_name: parts[0] ?? null,
      invitee_last_name: parts.slice(1).join(" ") || null,
    });
  if (error) throw new Error(`ensurePendingInvite: ${error.message}`);
}

async function ensureDemoOrder(
  companyId: string,
  spec: DemoCompanySpec,
  amounts: { subtotalMinor: number; taxMinor: number; totalMinor: number },
): Promise<void> {
  await createOrder({
    number: `ORD-DEMO-${spec.externalCustomerId}`,
    companyId,
    purchaserEmail: spec.email,
    purchaserName: spec.contactPersonName,
    purchaserCompanyName: spec.displayName,
    currency: "EUR",
    subtotalMinor: amounts.subtotalMinor,
    taxMinor: amounts.taxMinor,
    totalMinor: amounts.totalMinor,
    orderStatus: "confirmed",
    paymentStatus: "paid",
    fulfilmentStatus: "fulfilled",
    source: "fixture",
    lines: [
      {
        sku: `DEMO-${spec.externalCustomerId}`,
        name: "Demo bestelling (niet-productie)",
        quantity: 1,
        unitPriceMinor: amounts.subtotalMinor,
        taxMinor: amounts.taxMinor,
        lineTotalMinor: amounts.totalMinor,
      },
    ],
  }).catch(() => undefined);
}

async function ensureDemoImportHistory(): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase
    .schema("private")
    .from("admin_customer_import_runs")
    .select("id")
    .eq("file_name", DEMO_IMPORT_FILE)
    .eq("source", "demo")
    .maybeSingle();
  if (existing) return;
  await recordAdminCustomerImportRun({
    fileName: DEMO_IMPORT_FILE,
    createdCount: 1180,
    updatedCount: 8,
    skippedCount: 0,
    actorUserId: null,
    source: "demo",
  });
}

/**
 * Idempotent demo seed for local/dev Klanten directory. Disabled in production.
 */
export async function seedAdminCustomersDirectoryDemo(): Promise<{
  ok: true;
  companyIds: string[];
}> {
  if (!commerceFixturesAllowed()) {
    throw new Error("Klanten-demogegevens zijn uitgeschakeld in productie.");
  }

  const companyIds: string[] = [];

  for (const spec of DEMO_COMPANIES) {
    const company = await ensureDemoCompany(spec);
    companyIds.push(company.id);
    await upsertCompanyDisplaySnapshot({
      companyId: company.id,
      outstandingMinor: spec.outstandingMinor,
      source: "demo",
    });

    if (spec.portal === "active") {
      const userId = await ensureDemoCustomer(spec.email, spec.contactPersonName);
      await addCompanyMember({
        companyId: company.id,
        userId,
        role: "account_admin",
      }).catch(() => undefined);
    } else if (spec.portal === "invited") {
      await ensurePendingInvite(company.id, spec.email, spec.contactPersonName);
    }

    if (spec.lastOrder) {
      await ensureDemoOrder(company.id, spec, spec.lastOrder);
    }
  }

  await ensureDemoImportHistory();

  return { ok: true, companyIds };
}
