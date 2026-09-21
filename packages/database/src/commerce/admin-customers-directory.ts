/**
 * Staff admin Klanten directory — list, KPIs, selected detail, import history.
 * Outstanding saldo is a demo snapshot (integer minor units), not a legal ledger.
 */

import { buildCsvRow } from "@mccoy/domain";
import type { Company, CompanyStatus, CompanyType, CustomerPortalStatus } from "@mccoy/domain";
import { AdminAuthError } from "@mccoy/security";

import { createSupabaseServiceClient } from "../supabase";
import { resolveCustomerPortalStatus } from "../customer-portal/portal-status";
import { listInvitationsForCompany } from "../customer-portal/invitations";
import { listCompanyMemberships } from "../customer-portal/membership";
import { getCompanyById } from "./core";

export const ADMIN_CUSTOMERS_DIRECTORY_TABS = ["all", "service", "enrolled", "awaiting"] as const;

export type AdminCustomersDirectoryTab = (typeof ADMIN_CUSTOMERS_DIRECTORY_TABS)[number];

export type DirectoryActorKind = "staff" | "customer" | "anonymous";

export type DirectoryTypeBadge = {
  id: "service" | "portal";
  label: "Service" | "Portaal";
};

export type DirectoryPortalPill = {
  id: "active" | "invited" | "registration_required" | "blocked";
  label: "Actief" | "Uitnodiging verzonden" | "Registratie vereist" | "Geblokkeerd";
  tone: "active" | "invited" | "required" | "blocked";
};

export type AdminCustomersDirectoryItem = {
  companyId: string;
  legalName: string;
  displayName: string | null;
  companyType: CompanyType;
  typeBadge: DirectoryTypeBadge;
  customerNumber: string | null;
  contactPersonName: string | null;
  email: string | null;
  invoiceAllowed: boolean;
  kvkNumber: string | null;
  vatNumber: string | null;
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  invitedUserCount: number;
  pendingInviteEmail: string | null;
  portalStatus: CustomerPortalStatus;
  portalPill: DirectoryPortalPill;
  lastOrderAt: string | null;
  /** Display-only demo minor units. Never a legal payable. */
  outstandingMinor: number;
  outstandingSource: "demo" | "seed" | "none";
  companyStatus: CompanyStatus;
};

export type AdminCustomersDirectoryKpis = {
  totalCustomers: number;
  serviceClients: number;
  registrationRequired: number;
  activePortals: number;
  totalCreatedLast7Days: number;
  totalCreatedPrevious7Days: number;
};

export type AdminCustomersDirectoryDetail = {
  company: Company;
  portalStatus: CustomerPortalStatus;
  portalPill: DirectoryPortalPill;
  typeBadge: DirectoryTypeBadge;
  authorizedUserCount: number;
  pendingInviteEmail: string | null;
  outstandingMinor: number;
  outstandingSource: "demo" | "seed" | "none";
  lastOrderAt: string | null;
};

export type AdminCustomerImportRun = {
  id: string;
  fileName: string;
  importedAt: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  source: "import" | "demo";
};

export type AdminCustomersDirectoryQuery = {
  q?: string;
  tab?: AdminCustomersDirectoryTab | "portal" | "guests" | "registered";
  portalStatus?: CustomerPortalStatus | "all";
  page?: number;
  pageSize?: number;
  companyId?: string | null;
};

export type AdminCustomersDirectoryPage = {
  items: AdminCustomersDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  kpis: AdminCustomersDirectoryKpis;
  importHistory: AdminCustomerImportRun[];
  selected: AdminCustomersDirectoryDetail | null;
};

const DIRECTORY_TABS = new Set<string>(ADMIN_CUSTOMERS_DIRECTORY_TABS);

export function normalizeDirectoryTab(raw: unknown): AdminCustomersDirectoryTab {
  if (raw === "service" || raw === "portal") return "service";
  if (raw === "enrolled") return "enrolled";
  if (raw === "awaiting") return "awaiting";
  if (raw === "all" || raw === "guests") return "all";
  // Legacy "registered" / "bestaande klanten" URLs land on Serviceklanten.
  if (raw === "registered") return "service";
  if (typeof raw === "string" && DIRECTORY_TABS.has(raw)) {
    return raw as AdminCustomersDirectoryTab;
  }
  return "all";
}

export function directoryAccessDecision(
  kind: DirectoryActorKind,
): { allowed: true } | { allowed: false; error: string } {
  if (kind === "staff") return { allowed: true };
  return { allowed: false, error: "Niet geautoriseerd." };
}

export function assertDirectoryStaffAccess(kind: DirectoryActorKind): void {
  const decision = directoryAccessDecision(kind);
  if (!decision.allowed) {
    throw new AdminAuthError(decision.error);
  }
}

export function companyTypeBadge(companyType: CompanyType): DirectoryTypeBadge {
  if (companyType === "service_client") {
    return { id: "service", label: "Service" };
  }
  return { id: "portal", label: "Portaal" };
}

export function directoryPortalPill(
  portalStatus: CustomerPortalStatus,
  companyStatus: CompanyStatus,
): DirectoryPortalPill {
  if (companyStatus === "blocked" || portalStatus === "suspended") {
    return { id: "blocked", label: "Geblokkeerd", tone: "blocked" };
  }
  if (portalStatus === "active") {
    return { id: "active", label: "Actief", tone: "active" };
  }
  if (portalStatus === "invited" || portalStatus === "reminder_sent") {
    return { id: "invited", label: "Uitnodiging verzonden", tone: "invited" };
  }
  return { id: "registration_required", label: "Registratie vereist", tone: "required" };
}

export function matchesDirectoryTab(
  tab: AdminCustomersDirectoryTab,
  input: { companyType: CompanyType; portalPill: DirectoryPortalPill },
): boolean {
  if (tab === "all") return true;
  if (tab === "service") return input.companyType === "service_client";
  if (tab === "enrolled") return input.companyType === "product_customer";
  return input.portalPill.id === "invited" || input.portalPill.id === "registration_required";
}

export function companyInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0 && !/^(bv|b\.v\.|nv|vof|cv)$/i.test(p));
  if (parts.length === 0) return "?";
  const first = parts[0]!;
  if (first.length >= 2 && first.length <= 4 && /^[A-Za-z]+$/.test(first) && first === first.toUpperCase()) {
    return first;
  }
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function computeDirectoryKpis(
  rows: Array<{
    companyType: CompanyType;
    portalPill: DirectoryPortalPill;
    createdAt: string;
  }>,
): AdminCustomersDirectoryKpis {
  const now = Date.now();
  const day = 86_400_000;
  let totalCreatedLast7Days = 0;
  let totalCreatedPrevious7Days = 0;
  let serviceClients = 0;
  let registrationRequired = 0;
  let activePortals = 0;
  for (const row of rows) {
    if (row.companyType === "service_client") serviceClients += 1;
    if (row.portalPill.id === "registration_required") registrationRequired += 1;
    if (row.portalPill.id === "active") activePortals += 1;
    const created = Date.parse(row.createdAt);
    if (!Number.isFinite(created)) continue;
    const age = now - created;
    if (age <= 7 * day) totalCreatedLast7Days += 1;
    else if (age <= 14 * day) totalCreatedPrevious7Days += 1;
  }
  return {
    totalCustomers: rows.length,
    serviceClients,
    registrationRequired,
    activePortals,
    totalCreatedLast7Days,
    totalCreatedPrevious7Days,
  };
}

function sanitizeIlike(q: string): string {
  return q
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function pageBounds(
  page = 1,
  pageSize = 25,
): {
  from: number;
  to: number;
  page: number;
  pageSize: number;
} {
  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1, page: safePage, pageSize: safeSize };
}

function daysAgoIso(days: number, now = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

type CompanyListRow = {
  id: string;
  legal_name: string;
  display_name: string | null;
  company_type: CompanyType;
  status: CompanyStatus;
  email: string | null;
  contact_person_name: string | null;
  external_customer_id: string | null;
  created_at: string;
  invoice_allowed: boolean;
  kvk_number: string | null;
  vat_number: string | null;
  address_street: string | null;
  address_house_number: string | null;
  address_house_suffix: string | null;
  address_postal_code: string | null;
  address_city: string | null;
};

async function loadKpis(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<AdminCustomersDirectoryKpis> {
  const now = new Date();
  const last7 = daysAgoIso(7, now);
  const prev7 = daysAgoIso(14, now);

  const [totalRes, serviceRes, last7Res, prev7Res, activeMemberRes] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("company_type", "service_client"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last7),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prev7)
      .lt("created_at", last7),
    supabase.from("company_users").select("company_id").eq("status", "active"),
  ]);

  const activeCompanyIds = new Set((activeMemberRes.data ?? []).map((r) => r.company_id as string));

  const { data: pendingInvites } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("company_id")
    .eq("status", "pending");
  const pendingCompanyIds = new Set(
    (pendingInvites ?? []).map((r) => r.company_id as string),
  );

  const { data: activeCompanies } = await supabase
    .from("companies")
    .select("id, status")
    .eq("status", "active");

  let activePortals = 0;
  let registrationRequired = 0;
  for (const row of activeCompanies ?? []) {
    const id = row.id as string;
    if (activeCompanyIds.has(id)) {
      activePortals += 1;
      continue;
    }
    if (!pendingCompanyIds.has(id)) registrationRequired += 1;
  }

  return {
    totalCustomers: totalRes.count ?? 0,
    serviceClients: serviceRes.count ?? 0,
    registrationRequired,
    activePortals,
    totalCreatedLast7Days: last7Res.count ?? 0,
    totalCreatedPrevious7Days: prev7Res.count ?? 0,
  };
}

async function listAwaitingCompanyIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<string[]> {
  const { data: activeMembers, error: mErr } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("status", "active");
  if (mErr) throw new Error(`listAwaitingCompanyIds members: ${mErr.message}`);
  const activeIds = new Set((activeMembers ?? []).map((r) => r.company_id as string));

  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id, status")
    .eq("status", "active");
  if (cErr) throw new Error(`listAwaitingCompanyIds companies: ${cErr.message}`);

  return (companies ?? []).map((c) => c.id as string).filter((id) => !activeIds.has(id));
}

type DirectoryRowsQuery = {
  tab: AdminCustomersDirectoryTab;
  q: string;
  portalStatusFilter: CustomerPortalStatus | null;
  from: number;
  size: number;
};

/**
 * One slice of the filtered directory. Shared by the paged list and the CSV export so
 * the export can never apply a different filter, scope, or ordering than the screen.
 */
async function loadDirectoryRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  query: DirectoryRowsQuery,
): Promise<{ items: AdminCustomersDirectoryItem[]; total: number }> {
  const { tab, q, portalStatusFilter, from, size } = query;
  const to = from + size - 1;

  let req = supabase
    .from("companies")
    .select(
      "id, legal_name, display_name, company_type, status, email, contact_person_name, external_customer_id, created_at, invoice_allowed, kvk_number, vat_number, address_street, address_house_number, address_house_suffix, address_postal_code, address_city",
      { count: portalStatusFilter ? undefined : "exact" },
    );

  if (tab === "service") req = req.eq("company_type", "service_client");
  if (tab === "enrolled") req = req.eq("company_type", "product_customer");
  if (tab === "awaiting") {
    const awaitingIds = await listAwaitingCompanyIds(supabase);
    if (awaitingIds.length === 0) return { items: [], total: 0 };
    req = req.in("id", awaitingIds);
  }

  if (q) {
    req = req.or(
      `legal_name.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%,external_customer_id.ilike.%${q}%,contact_person_name.ilike.%${q}%`,
    );
  }

  let companies: CompanyListRow[];
  let total: number;
  const portalStatusById = new Map<string, CustomerPortalStatus>();

  if (portalStatusFilter) {
    const { data, error } = await req.order("legal_name");
    if (error) throw new Error(`listAdminCustomersDirectory: ${error.message}`);
    const matched: CompanyListRow[] = [];
    for (const company of (data ?? []) as CompanyListRow[]) {
      const portalStatus = await resolveCustomerPortalStatus(company.id);
      if (portalStatus !== portalStatusFilter) continue;
      portalStatusById.set(company.id, portalStatus);
      matched.push(company);
    }
    total = matched.length;
    companies = matched.slice(from, from + size);
  } else {
    const { data, error, count } = await req.order("legal_name").range(from, to);
    if (error) throw new Error(`listAdminCustomersDirectory: ${error.message}`);
    companies = (data ?? []) as CompanyListRow[];
    total = count ?? companies.length;
  }

  const ids = companies.map((c) => c.id);

  const lastOrderById = new Map<string, string>();
  const outstandingById = new Map<string, { outstandingMinor: number; source: "demo" | "seed" }>();
  const authorizedCountById = new Map<string, number>();
  const pendingInviteCountById = new Map<string, number>();
  const pendingInviteEmailById = new Map<string, string>();

  if (ids.length) {
    const { data: stats } = await supabase
      .schema("private")
      .rpc("admin_order_stats_for_companies", { p_company_ids: ids });
    for (const s of stats ?? []) {
      if (s.last_order_at) lastOrderById.set(s.company_id as string, String(s.last_order_at));
    }

    const { data: snaps } = await supabase
      .schema("private")
      .from("admin_company_display_snapshot")
      .select("company_id, outstanding_minor, source")
      .in("company_id", ids);
    for (const snap of snaps ?? []) {
      const source = snap.source === "seed" ? "seed" : "demo";
      outstandingById.set(snap.company_id as string, {
        outstandingMinor: Math.max(0, Math.trunc(Number(snap.outstanding_minor) || 0)),
        source,
      });
    }

    const { data: members } = await supabase
      .from("company_users")
      .select("company_id, status")
      .in("company_id", ids)
      .eq("status", "active");
    for (const member of members ?? []) {
      const companyId = member.company_id as string;
      authorizedCountById.set(companyId, (authorizedCountById.get(companyId) ?? 0) + 1);
    }

    const { data: invites } = await supabase
      .schema("private")
      .from("customer_invitations")
      .select("company_id, email, status")
      .in("company_id", ids)
      .eq("status", "pending");
    for (const invite of invites ?? []) {
      const companyId = invite.company_id as string;
      pendingInviteCountById.set(companyId, (pendingInviteCountById.get(companyId) ?? 0) + 1);
      if (!pendingInviteEmailById.has(companyId) && invite.email) {
        pendingInviteEmailById.set(companyId, String(invite.email));
      }
    }
  }

  const items: AdminCustomersDirectoryItem[] = [];
  for (const company of companies) {
    const portalStatus =
      portalStatusById.get(company.id) ?? (await resolveCustomerPortalStatus(company.id));
    const portalPill = directoryPortalPill(portalStatus, company.status);
    const snap = outstandingById.get(company.id);
    const authorizedCount = authorizedCountById.get(company.id) ?? 0;
    const pendingInviteCount = pendingInviteCountById.get(company.id) ?? 0;
    items.push({
      companyId: company.id,
      legalName: company.legal_name,
      displayName: company.display_name,
      companyType: company.company_type,
      typeBadge: companyTypeBadge(company.company_type),
      customerNumber: company.external_customer_id,
      contactPersonName: company.contact_person_name,
      email: company.email,
      invoiceAllowed: Boolean(company.invoice_allowed),
      kvkNumber: company.kvk_number,
      vatNumber: company.vat_number,
      addressStreet: company.address_street,
      addressHouseNumber: company.address_house_number,
      addressHouseSuffix: company.address_house_suffix,
      addressPostalCode: company.address_postal_code,
      addressCity: company.address_city,
      invitedUserCount: authorizedCount + pendingInviteCount,
      pendingInviteEmail: pendingInviteEmailById.get(company.id) ?? null,
      portalStatus,
      portalPill,
      lastOrderAt: lastOrderById.get(company.id) ?? null,
      outstandingMinor: snap?.outstandingMinor ?? 0,
      outstandingSource: snap?.source ?? "none",
      companyStatus: company.status,
    });
  }

  return { items, total };
}

export async function listAdminCustomersDirectory(
  query: AdminCustomersDirectoryQuery = {},
): Promise<AdminCustomersDirectoryPage> {
  const { from, page, pageSize } = pageBounds(query.page, query.pageSize);
  const supabase = createSupabaseServiceClient();

  const { items, total } = await loadDirectoryRows(supabase, {
    tab: normalizeDirectoryTab(query.tab),
    q: sanitizeIlike(query.q ?? ""),
    // Portal status is derived in application code, so it cannot be pushed into SQL.
    // It must still be applied before slicing, otherwise pages and `total` are wrong.
    portalStatusFilter:
      query.portalStatus && query.portalStatus !== "all" ? query.portalStatus : null,
    from,
    size: pageSize,
  });

  const [kpis, importHistory] = await Promise.all([
    loadKpis(supabase),
    listAdminCustomerImportRuns(),
  ]);

  let selected: AdminCustomersDirectoryDetail | null = null;
  const selectedId = query.companyId?.trim() || items[0]?.companyId || null;
  if (selectedId) {
    selected = await getAdminCustomersDirectoryDetail(selectedId);
  }

  return {
    items,
    total,
    page,
    pageSize,
    kpis,
    importHistory,
    selected,
  };
}

/**
 * Hard ceiling for one export. Bounded so a runaway dataset cannot exhaust memory or
 * silently time out; when it bites, the caller is told rather than handed a short file
 * that looks complete.
 */
export const ADMIN_CUSTOMERS_EXPORT_MAX_ROWS = 10_000;
const ADMIN_CUSTOMERS_EXPORT_BATCH = 200;

export const ADMIN_CUSTOMERS_EXPORT_HEADER = [
  "bedrijf",
  "klantnummer",
  "contactpersoon",
  "email",
  "type",
  "portalstatus",
  "laatste_bestelling",
  "openstaand_saldo_minor",
] as const;

export type AdminCustomersDirectoryExport = {
  csv: string;
  /** Rows actually written, excluding the header. */
  rowCount: number;
  /** Rows the current filter matches in the database. */
  total: number;
  truncated: boolean;
  maxRows: number;
};

export function adminCustomersExportRow(item: AdminCustomersDirectoryItem): string {
  // Company and contact fields are customer-controlled, so buildCsvRow's shared escaper
  // (quoting + spreadsheet formula neutralisation) must stay the only formatter here.
  return buildCsvRow([
    item.displayName || item.legalName,
    item.customerNumber ?? "",
    item.contactPersonName ?? "",
    item.email ?? "",
    item.typeBadge.label,
    item.portalPill.label,
    item.lastOrderAt ?? "",
    item.outstandingMinor,
  ]);
}

/**
 * Exports every row the current filter matches, not just the page on screen, and does
 * it server-side so the same tab, search, portal-status scope, and staff authorization
 * apply as for the list itself.
 */
export async function exportAdminCustomersDirectoryCsv(
  query: AdminCustomersDirectoryQuery = {},
  actor: DirectoryActorKind = "staff",
): Promise<AdminCustomersDirectoryExport> {
  assertDirectoryStaffAccess(actor);
  const supabase = createSupabaseServiceClient();
  const rowsQuery = {
    tab: normalizeDirectoryTab(query.tab),
    q: sanitizeIlike(query.q ?? ""),
    portalStatusFilter:
      query.portalStatus && query.portalStatus !== "all" ? query.portalStatus : null,
  };

  const lines: string[] = [buildCsvRow([...ADMIN_CUSTOMERS_EXPORT_HEADER])];
  let offset = 0;
  let total = 0;
  let rowCount = 0;

  for (;;) {
    const size = Math.min(
      ADMIN_CUSTOMERS_EXPORT_BATCH,
      ADMIN_CUSTOMERS_EXPORT_MAX_ROWS - rowCount,
    );
    if (size <= 0) break;
    const batch = await loadDirectoryRows(supabase, { ...rowsQuery, from: offset, size });
    total = batch.total;
    for (const item of batch.items) lines.push(adminCustomersExportRow(item));
    rowCount += batch.items.length;
    offset += batch.items.length;
    if (batch.items.length < size || rowCount >= total) break;
  }

  return {
    csv: `\uFEFF${lines.join("\n")}\n`,
    rowCount,
    total,
    truncated: rowCount < total,
    maxRows: ADMIN_CUSTOMERS_EXPORT_MAX_ROWS,
  };
}

export async function getAdminCustomersDirectoryDetail(
  companyId: string,
): Promise<AdminCustomersDirectoryDetail | null> {
  const company = await getCompanyById(companyId);
  if (!company) return null;
  const supabase = createSupabaseServiceClient();
  const [portalStatus, members, invitations] = await Promise.all([
    resolveCustomerPortalStatus(companyId),
    listCompanyMemberships(companyId),
    listInvitationsForCompany(companyId),
  ]);

  const { data: snap } = await supabase
    .schema("private")
    .from("admin_company_display_snapshot")
    .select("outstanding_minor, source")
    .eq("company_id", companyId)
    .maybeSingle();

  const { data: stats } = await supabase
    .schema("private")
    .rpc("admin_order_stats_for_companies", { p_company_ids: [companyId] });

  const pending = invitations.find((i) => i.status === "pending");
  const snapSource = snap?.source === "seed" ? "seed" : snap ? "demo" : "none";

  return {
    company,
    portalStatus,
    portalPill: directoryPortalPill(portalStatus, company.status),
    typeBadge: companyTypeBadge(company.companyType),
    authorizedUserCount: members.filter((m) => m.membershipStatus === "active").length,
    pendingInviteEmail: pending?.email ?? null,
    outstandingMinor: Math.max(0, Math.trunc(Number(snap?.outstanding_minor) || 0)),
    outstandingSource: snapSource,
    lastOrderAt: stats?.[0]?.last_order_at ? String(stats[0].last_order_at) : null,
  };
}

export async function listAdminCustomerImportRuns(limit = 5): Promise<AdminCustomerImportRun[]> {
  const supabase = createSupabaseServiceClient();
  const safeLimit = Math.min(20, Math.max(1, Math.trunc(limit)));
  const { data, error } = await supabase
    .schema("private")
    .from("admin_customer_import_runs")
    .select("id, file_name, imported_at, created_count, updated_count, skipped_count, source")
    .order("imported_at", { ascending: false })
    .limit(safeLimit);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id as string,
    fileName: String(row.file_name),
    importedAt: String(row.imported_at),
    createdCount: Number(row.created_count ?? 0),
    updatedCount: Number(row.updated_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    source: row.source === "demo" ? "demo" : "import",
  }));
}

export async function recordAdminCustomerImportRun(input: {
  fileName: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  actorUserId: string | null;
  source?: "import" | "demo";
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .schema("private")
    .from("admin_customer_import_runs")
    .insert({
      file_name: input.fileName.trim().slice(0, 240),
      created_count: Math.max(0, Math.trunc(input.createdCount)),
      updated_count: Math.max(0, Math.trunc(input.updatedCount)),
      skipped_count: Math.max(0, Math.trunc(input.skippedCount)),
      actor_user_id: input.actorUserId,
      source: input.source ?? "import",
    });
  if (error) throw new Error(`recordAdminCustomerImportRun: ${error.message}`);
}

export async function upsertCompanyDisplaySnapshot(input: {
  companyId: string;
  outstandingMinor: number;
  source?: "demo" | "seed";
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .schema("private")
    .from("admin_company_display_snapshot")
    .upsert({
      company_id: input.companyId,
      outstanding_minor: Math.max(0, Math.trunc(input.outstandingMinor)),
      source: input.source ?? "demo",
      currency: "EUR",
    });
  if (error) throw new Error(`upsertCompanyDisplaySnapshot: ${error.message}`);
}
