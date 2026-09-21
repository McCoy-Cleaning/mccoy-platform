import type { CompanyPartyType, CompanyType, CustomerPortalStatus } from "@mccoy/domain";
import { partyTypeLabelNl, portalStatusLabelNl } from "@mccoy/domain";

import { sanitizePostgrestSearchTerm } from "../postgrest-search";
import { createSupabaseServiceClient } from "../supabase";
import { resolveCustomerPortalStatus } from "./portal-status";

export type PortalCompanyListItem = {
  companyId: string;
  legalName: string;
  displayName: string | null;
  companyType: CompanyType;
  partyType: CompanyPartyType;
  partyTypeLabel: string;
  companyStatus: string;
  portalStatus: CustomerPortalStatus;
  portalStatusLabel: string;
  accountAdminName: string | null;
  accountAdminEmail: string | null;
  activeUserCount: number;
  pendingInviteCount: number;
  externalCustomerId: string | null;
};

export type PortalCompanyListQuery = {
  q?: string;
  portalStatus?: CustomerPortalStatus | "all";
  page?: number;
  pageSize?: number;
};

export async function listPortalCompanies(
  query: PortalCompanyListQuery = {},
): Promise<{ items: PortalCompanyListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 25)));
  const portalStatusFilter =
    query.portalStatus && query.portalStatus !== "all" ? query.portalStatus : null;

  const supabase = createSupabaseServiceClient();
  let req = supabase
    .from("companies")
    .select("id, legal_name, display_name, company_type, party_type, status, external_customer_id", {
      count: portalStatusFilter ? undefined : "exact",
    })
    .eq("company_type", "service_client");

  const q = sanitizePostgrestSearchTerm(query.q ?? "");
  if (q) {
    req = req.or(`legal_name.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  let companies: Array<Record<string, unknown>>;
  let total: number;

  if (portalStatusFilter) {
    const { data, error } = await req.order("legal_name");
    if (error) throw new Error(`listPortalCompanies: ${error.message}`);
    const matched: Array<Record<string, unknown>> = [];
    for (const company of data ?? []) {
      const companyId = company.id as string;
      const portalStatus = await resolveCustomerPortalStatus(companyId);
      if (portalStatus === portalStatusFilter) {
        matched.push(company as Record<string, unknown>);
      }
    }
    total = matched.length;
    const from = (page - 1) * pageSize;
    companies = matched.slice(from, from + pageSize);
  } else {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await req.order("legal_name").range(from, to);
    if (error) throw new Error(`listPortalCompanies: ${error.message}`);
    companies = (data ?? []) as Array<Record<string, unknown>>;
    total = count ?? companies.length;
  }

  const items: PortalCompanyListItem[] = [];

  for (const company of companies) {
    const companyId = company.id as string;
    const portalStatus = await resolveCustomerPortalStatus(companyId);

    const { data: admins } = await supabase
      .from("company_users")
      .select("users!inner(full_name, email)")
      .eq("company_id", companyId)
      .eq("role", "account_admin")
      .eq("status", "active")
      .limit(1);

    const adminUsers = admins?.[0]?.users as
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | undefined;
    const adminRow = Array.isArray(adminUsers) ? adminUsers[0] : adminUsers;

    const { count: userCount } = await supabase
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "active");

    const { count: pendingInvites } = await supabase
      .schema("private")
      .from("customer_invitations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "pending");

    items.push({
      companyId,
      legalName: company.legal_name as string,
      displayName: (company.display_name as string | null) ?? null,
      companyType: company.company_type as CompanyType,
      partyType: ((company.party_type as CompanyPartyType | null) ?? "company") as CompanyPartyType,
      partyTypeLabel: partyTypeLabelNl(
        ((company.party_type as CompanyPartyType | null) ?? "company") as CompanyPartyType,
      ),
      companyStatus: company.status as string,
      portalStatus,
      portalStatusLabel: portalStatusLabelNl(portalStatus),
      accountAdminName: adminRow?.full_name ?? null,
      accountAdminEmail: adminRow?.email ?? null,
      activeUserCount: userCount ?? 0,
      pendingInviteCount: pendingInvites ?? 0,
      externalCustomerId: (company.external_customer_id as string | null) ?? null,
    });
  }

  return {
    items,
    total,
    page,
    pageSize,
  };
}
