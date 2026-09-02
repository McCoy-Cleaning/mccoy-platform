import type { CompanyPartyType, CompanyStatus } from "@mccoy/domain";

import { createCompany, updateCompany } from "../commerce/core";
import { writeStaffAudit } from "../staff";
import { createSupabaseServiceClient } from "../supabase";

export type ExistingServiceClientRecord = {
  externalCustomerId: string;
  legalName: string;
  displayName?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPersonName?: string | null;
  addressStreet?: string | null;
  addressHouseNumber?: string | null;
  addressHouseSuffix?: string | null;
  addressPostalCode?: string | null;
  addressCity?: string | null;
  addressCountry?: string | null;
  invoiceAllowed?: boolean;
  companyStatus?: CompanyStatus;
  partyType?: CompanyPartyType;
  sourceUpdatedAt?: string | null;
};

export interface ExistingCustomerProvider {
  listServiceClients(): Promise<ExistingServiceClientRecord[]>;
}

/** Reads authoritative mirror table (operator CSV/XLSX import → mirror). */
export class LegacyMirrorExistingCustomerProvider implements ExistingCustomerProvider {
  async listServiceClients(): Promise<ExistingServiceClientRecord[]> {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("commerce_legacy_service_clients")
      .select("*");
    if (error) throw new Error(`LegacyMirrorExistingCustomerProvider: ${error.message}`);

    return (data ?? []).map((row) => ({
      externalCustomerId: String(row.external_customer_id),
      legalName: String(row.legal_name),
      displayName: (row.display_name as string | null) ?? null,
      kvkNumber: (row.kvk_number as string | null) ?? null,
      vatNumber: (row.vat_number as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      contactPersonName: (row.contact_person_name as string | null) ?? null,
      addressStreet: (row.address_street as string | null) ?? null,
      addressHouseNumber: (row.address_house_number as string | null) ?? null,
      addressHouseSuffix: (row.address_house_suffix as string | null) ?? null,
      addressPostalCode: (row.address_postal_code as string | null) ?? null,
      addressCity: (row.address_city as string | null) ?? null,
      addressCountry: (row.address_country as string | null) ?? null,
      invoiceAllowed: Boolean(row.invoice_allowed),
      companyStatus: row.company_status as CompanyStatus,
      partyType: (row.party_type as CompanyPartyType | null) ?? "company",
      sourceUpdatedAt: (row.source_updated_at as string | null) ?? null,
    }));
  }
}

export type SyncExistingServiceClientsResult = {
  created: number;
  updated: number;
  skipped: number;
};

/**
 * Upsert companies from ExistingCustomerProvider keyed by external_customer_id.
 * Idempotent — safe to retry.
 */
export async function syncExistingServiceClients(input: {
  provider?: ExistingCustomerProvider;
  actorUserId?: string | null;
  /** When set, only sync mirror rows with these external_customer_id values. */
  externalCustomerIds?: string[];
}): Promise<SyncExistingServiceClientsResult> {
  let provider = input.provider ?? new LegacyMirrorExistingCustomerProvider();
  if (input.externalCustomerIds?.length) {
    const allowed = new Set(input.externalCustomerIds.map((id) => id.trim()).filter(Boolean));
    const base = provider;
    provider = {
      listServiceClients: async () => {
        const records = await base.listServiceClients();
        return records.filter((record) => allowed.has(record.externalCustomerId.trim()));
      },
    };
  }
  const records = await provider.listServiceClients();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const supabase = createSupabaseServiceClient();

  for (const record of records) {
    const externalId = record.externalCustomerId.trim();
    if (!externalId) {
      skipped += 1;
      continue;
    }

    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("external_customer_id", externalId)
      .maybeSingle();

    if (existing?.id) {
      await updateCompany(existing.id as string, {
        legalName: record.legalName,
        displayName: record.displayName,
        kvkNumber: record.kvkNumber,
        vatNumber: record.vatNumber,
        email: record.email,
        phone: record.phone,
        contactPersonName: record.contactPersonName,
        addressStreet: record.addressStreet,
        addressHouseNumber: record.addressHouseNumber,
        addressHouseSuffix: record.addressHouseSuffix,
        addressPostalCode: record.addressPostalCode,
        addressCity: record.addressCity,
        addressCountry: record.addressCountry,
        invoiceAllowed: record.invoiceAllowed,
        status: record.companyStatus,
        companyType: "service_client",
        partyType: record.partyType ?? "company",
      });
      updated += 1;
    } else {
      await createCompany({
        legalName: record.legalName,
        displayName: record.displayName,
        email: record.email,
        phone: record.phone,
        kvkNumber: record.kvkNumber,
        vatNumber: record.vatNumber,
        contactPersonName: record.contactPersonName,
        addressStreet: record.addressStreet,
        addressHouseNumber: record.addressHouseNumber,
        addressHouseSuffix: record.addressHouseSuffix,
        addressPostalCode: record.addressPostalCode,
        addressCity: record.addressCity,
        addressCountry: record.addressCountry,
        invoiceAllowed: record.invoiceAllowed ?? false,
        status: record.companyStatus ?? "active",
        companyType: "service_client",
        partyType: record.partyType ?? "company",
        externalCustomerId: externalId,
      });
      created += 1;
    }

    await supabase
      .from("commerce_legacy_service_clients")
      .update({ synced_at: new Date().toISOString() })
      .eq("external_customer_id", externalId);
  }

  if (input.actorUserId && (created > 0 || updated > 0)) {
    await writeStaffAudit({
      actorUserId: input.actorUserId,
      action: "commerce.company_provisioned",
      targetType: "company",
      targetId: null,
      after: { created, updated, skipped },
    });
  }

  return { created, updated, skipped };
}
