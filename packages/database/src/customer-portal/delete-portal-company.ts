/**
 * Staff delete of portal service-client companies (admin only).
 * Uses security-definer RPC so FORCE RLS / cascade cannot silently no-op.
 */

import { createSupabaseServiceClient } from "../supabase";
import { writeStaffAudit } from "../staff";
import { getCompanyById } from "../commerce/core";

export type DeletePortalCompanyResult =
  | {
      ok: true;
      companyId: string;
      legalName: string;
      externalCustomerId: string | null;
    }
  | {
      ok: false;
      companyId: string;
      error: string;
      code: "not_found" | "not_service_client" | "has_orders" | "persist";
    };

export type DeletePortalCompaniesSummary = {
  deleted: number;
  failed: number;
  results: DeletePortalCompanyResult[];
};

type RpcResult = {
  ok?: boolean;
  code?: string;
  error?: string;
  companyId?: string;
  legalName?: string;
  externalCustomerId?: string | null;
};

function mapCode(code: string | undefined): "not_found" | "not_service_client" | "has_orders" | "persist" {
  if (code === "not_found" || code === "not_service_client" || code === "has_orders") {
    return code;
  }
  return "persist";
}

export async function deletePortalServiceCompany(input: {
  companyId: string;
  actorUserId: string;
}): Promise<DeletePortalCompanyResult> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc("delete_portal_service_company", {
    p_company_id: input.companyId,
  });

  if (error) {
    // Fallback for environments that have not applied the RPC migration yet.
    return deletePortalServiceCompanyFallback(input, error.message);
  }

  const payload = (data ?? {}) as RpcResult;
  if (!payload.ok) {
    return {
      ok: false,
      companyId: input.companyId,
      error: payload.error || "Verwijderen mislukt.",
      code: mapCode(payload.code),
    };
  }

  const legalName = payload.legalName || "Bedrijf";
  const externalCustomerId =
    payload.externalCustomerId === undefined ? null : payload.externalCustomerId;

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "commerce.portal_company_deleted",
    targetType: "company",
    targetId: input.companyId,
    before: {
      legalName,
      externalCustomerId,
      companyType: "service_client",
    },
  }).catch(() => undefined);

  return {
    ok: true,
    companyId: input.companyId,
    legalName,
    externalCustomerId,
  };
}

async function deletePortalServiceCompanyFallback(
  input: { companyId: string; actorUserId: string },
  rpcError: string,
): Promise<DeletePortalCompanyResult> {
  const company = await getCompanyById(input.companyId);
  if (!company) {
    return {
      ok: false,
      companyId: input.companyId,
      error: "Bedrijf niet gevonden.",
      code: "not_found",
    };
  }
  if (company.companyType !== "service_client") {
    return {
      ok: false,
      companyId: input.companyId,
      error: "Alleen serviceklanten (portaal) kunnen hier worden verwijderd.",
      code: "not_service_client",
    };
  }

  const supabase = createSupabaseServiceClient();
  const { count, error: orderErr } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", input.companyId);
  if (orderErr) {
    return {
      ok: false,
      companyId: input.companyId,
      error: `RPC ontbreekt (${rpcError}). Orders-check mislukt: ${orderErr.message}`,
      code: "persist",
    };
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      companyId: input.companyId,
      error: "Bedrijf heeft orders — verwijderen geblokkeerd om orderhistorie te bewaren.",
      code: "has_orders",
    };
  }

  const externalId = company.externalCustomerId;
  if (externalId) {
    await supabase
      .from("commerce_legacy_service_clients")
      .delete()
      .eq("external_customer_id", externalId);
  }

  await supabase
    .schema("private")
    .from("customer_invitations")
    .delete()
    .eq("company_id", input.companyId);

  await supabase.from("company_users").delete().eq("company_id", input.companyId);

  const { data: deletedRows, error: deleteError } = await supabase
    .from("companies")
    .delete()
    .eq("id", input.companyId)
    .eq("company_type", "service_client")
    .select("id");

  if (deleteError) {
    return {
      ok: false,
      companyId: input.companyId,
      error: `${deleteError.message} (pas migratie 20260830180000 toe voor betrouwbare delete)`,
      code: "persist",
    };
  }
  if (!deletedRows?.length) {
    return {
      ok: false,
      companyId: input.companyId,
      error:
        "Verwijderen mislukt (0 rijen). Pas migratie 20260830180000_delete_portal_service_company_rpc.sql toe.",
      code: "persist",
    };
  }

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "commerce.portal_company_deleted",
    targetType: "company",
    targetId: input.companyId,
    before: {
      legalName: company.legalName,
      externalCustomerId: externalId,
      companyType: company.companyType,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    companyId: input.companyId,
    legalName: company.legalName,
    externalCustomerId: externalId,
  };
}

export async function deletePortalServiceCompanies(input: {
  companyIds: string[];
  actorUserId: string;
}): Promise<DeletePortalCompaniesSummary> {
  const uniqueIds = [...new Set(input.companyIds.map((id) => id.trim()).filter(Boolean))];
  const results: DeletePortalCompanyResult[] = [];
  let deleted = 0;
  let failed = 0;

  for (const companyId of uniqueIds) {
    const result = await deletePortalServiceCompany({
      companyId,
      actorUserId: input.actorUserId,
    });
    results.push(result);
    if (result.ok) deleted += 1;
    else failed += 1;
  }

  return { deleted, failed, results };
}
