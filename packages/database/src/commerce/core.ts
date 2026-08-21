/**
 * Commerce Foundation Phase 1 — server data access (service role).
 * Never import from browser bundles.
 */

import {
  normalizeEmail,
  type AddressSnapshot,
  type Company,
  type CompanyMemberRole,
  type CompanyStatus,
  type CompanyType,
  type FulfilmentStatus,
  type GuestPurchaser,
  type OrderSource,
  type OrderStatus,
  type PaymentStatus,
  type UserStatus,
} from "@mccoy/domain";

import { createSupabaseServiceClient } from "../supabase";
import { writeStaffAudit } from "../staff";

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type CompanyRow = {
  id: string;
  legal_name: string;
  display_name: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  company_type: CompanyType;
  status: CompanyStatus;
  invoice_allowed: boolean;
  email: string | null;
  phone: string | null;
  blocked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type GuestRow = {
  id: string;
  email_normalized: string;
  email_display: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  converted_user_id: string | null;
  converted_company_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  number: string;
  company_id: string | null;
  customer_user_id: string | null;
  guest_purchaser_id: string | null;
  purchaser_email: string;
  purchaser_email_normalized: string;
  purchaser_name: string | null;
  purchaser_phone: string | null;
  purchaser_company_name: string | null;
  billing_address: AddressSnapshot;
  shipping_address: AddressSnapshot;
  currency: string;
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  fulfilment_status: FulfilmentStatus;
  source: OrderSource;
  payment_provider: string | null;
  payment_provider_ref: string | null;
  notes_internal: string | null;
  placed_at: string;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  line_number: number;
  product_id: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unit_price_minor: number;
  tax_rate_bps: number;
  tax_minor: number;
  line_total_minor: number;
  created_at: string;
};

type CustomerUserRow = {
  id: string;
  account_kind: "customer";
  staff_role: null;
  status: UserStatus;
  email: string;
  full_name: string | null;
  phone: string | null;
  blocked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    legalName: row.legal_name,
    displayName: row.display_name,
    kvkNumber: row.kvk_number,
    vatNumber: row.vat_number,
    companyType: row.company_type,
    status: row.status,
    invoiceAllowed: row.invoice_allowed,
    email: row.email,
    phone: row.phone,
    blockedAt: row.blocked_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapGuest(row: GuestRow): GuestPurchaser {
  return {
    id: row.id,
    emailNormalized: row.email_normalized,
    emailDisplay: row.email_display,
    fullName: row.full_name,
    companyName: row.company_name,
    phone: row.phone,
    convertedUserId: row.converted_user_id,
    convertedCompanyId: row.converted_company_id,
    convertedAt: row.converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CommerceOrder = {
  id: string;
  number: string;
  companyId: string | null;
  customerUserId: string | null;
  guestPurchaserId: string | null;
  purchaserEmail: string;
  purchaserEmailNormalized: string;
  purchaserName: string | null;
  purchaserPhone: string | null;
  purchaserCompanyName: string | null;
  billingAddress: AddressSnapshot;
  shippingAddress: AddressSnapshot;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  source: OrderSource;
  paymentProvider: string | null;
  paymentProviderRef: string | null;
  notesInternal: string | null;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CommerceOrderItem = {
  id: string;
  orderId: string;
  lineNumber: number;
  productId: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  taxRateBps: number;
  taxMinor: number;
  lineTotalMinor: number;
  createdAt: string;
};

export type CustomerProfile = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  status: UserStatus;
  blockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapOrder(row: OrderRow): CommerceOrder {
  return {
    id: row.id,
    number: row.number,
    companyId: row.company_id,
    customerUserId: row.customer_user_id,
    guestPurchaserId: row.guest_purchaser_id,
    purchaserEmail: row.purchaser_email,
    purchaserEmailNormalized: row.purchaser_email_normalized,
    purchaserName: row.purchaser_name,
    purchaserPhone: row.purchaser_phone,
    purchaserCompanyName: row.purchaser_company_name,
    billingAddress: (row.billing_address ?? {}) as AddressSnapshot,
    shippingAddress: (row.shipping_address ?? {}) as AddressSnapshot,
    currency: row.currency,
    subtotalMinor: Number(row.subtotal_minor),
    taxMinor: Number(row.tax_minor),
    totalMinor: Number(row.total_minor),
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    fulfilmentStatus: row.fulfilment_status,
    source: row.source,
    paymentProvider: row.payment_provider,
    paymentProviderRef: row.payment_provider_ref,
    notesInternal: row.notes_internal,
    placedAt: row.placed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrderItem(row: OrderItemRow): CommerceOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    lineNumber: row.line_number,
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    quantity: row.quantity,
    unitPriceMinor: Number(row.unit_price_minor),
    taxRateBps: row.tax_rate_bps,
    taxMinor: Number(row.tax_minor),
    lineTotalMinor: Number(row.line_total_minor),
    createdAt: row.created_at,
  };
}

function mapCustomer(row: CustomerUserRow): CustomerProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    status: row.status,
    blockedAt: row.blocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function createCompany(input: {
  legalName: string;
  displayName?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  companyType?: CompanyType;
  status?: CompanyStatus;
  invoiceAllowed?: boolean;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<Company> {
  const supabase = createSupabaseServiceClient();
  const status = input.status ?? "pending";
  const { data, error } = await supabase
    .from("companies")
    .insert({
      legal_name: input.legalName.trim(),
      display_name: input.displayName?.trim() || null,
      kvk_number: input.kvkNumber?.trim() || null,
      vat_number: input.vatNumber?.trim() || null,
      company_type: input.companyType ?? "product_customer",
      status,
      invoice_allowed: input.invoiceAllowed ?? false,
      email: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      blocked_at: status === "blocked" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createCompany failed: ${error.message}`);
  return mapCompany(data as CompanyRow);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getCompanyById failed: ${error.message}`);
  return data ? mapCompany(data as CompanyRow) : null;
}

export async function updateCompany(
  id: string,
  patch: Partial<{
    legalName: string;
    displayName: string | null;
    kvkNumber: string | null;
    vatNumber: string | null;
    companyType: CompanyType;
    status: CompanyStatus;
    invoiceAllowed: boolean;
    email: string | null;
    phone: string | null;
    notes: string | null;
  }>,
): Promise<Company> {
  const supabase = createSupabaseServiceClient();
  const row: Record<string, unknown> = {};
  if (patch.legalName !== undefined) row.legal_name = patch.legalName.trim();
  if (patch.displayName !== undefined) row.display_name = patch.displayName?.trim() || null;
  if (patch.kvkNumber !== undefined) row.kvk_number = patch.kvkNumber?.trim() || null;
  if (patch.vatNumber !== undefined) row.vat_number = patch.vatNumber?.trim() || null;
  if (patch.companyType !== undefined) row.company_type = patch.companyType;
  if (patch.invoiceAllowed !== undefined) row.invoice_allowed = patch.invoiceAllowed;
  if (patch.email !== undefined) row.email = patch.email ? normalizeEmail(patch.email) : null;
  if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null;
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() || null;
  if (patch.status !== undefined) {
    row.status = patch.status;
    row.blocked_at = patch.status === "blocked" ? new Date().toISOString() : null;
  }
  const { data, error } = await supabase.from("companies").update(row).eq("id", id).select("*").single();
  if (error) throw new Error(`updateCompany failed: ${error.message}`);
  return mapCompany(data as CompanyRow);
}

export async function addCompanyMember(input: {
  companyId: string;
  userId: string;
  role?: CompanyMemberRole;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("company_users").upsert(
    {
      company_id: input.companyId,
      user_id: input.userId,
      role: input.role ?? "owner",
    },
    { onConflict: "company_id,user_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`addCompanyMember failed: ${error.message}`);
}

export async function listCompaniesForUser(userId: string): Promise<Company[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_users")
    .select("companies(*)")
    .eq("user_id", userId);
  if (error) throw new Error(`listCompaniesForUser failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ companies: CompanyRow | CompanyRow[] | null }>;
  const companies: Company[] = [];
  for (const row of rows) {
    const c = row.companies;
    if (!c) continue;
    if (Array.isArray(c)) {
      for (const item of c) companies.push(mapCompany(item));
    } else {
      companies.push(mapCompany(c));
    }
  }
  return companies;
}

// ---------------------------------------------------------------------------
// Customer profiles (public.users account_kind=customer)
// ---------------------------------------------------------------------------

export async function getCustomerById(id: string): Promise<CustomerProfile | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .eq("account_kind", "customer")
    .maybeSingle();
  if (error) throw new Error(`getCustomerById failed: ${error.message}`);
  return data ? mapCustomer(data as CustomerUserRow) : null;
}

export async function getUserByNormalizedEmail(email: string): Promise<{
  id: string;
  accountKind: "staff" | "customer";
  status: UserStatus;
  email: string;
  fullName: string | null;
} | null> {
  const supabase = createSupabaseServiceClient();
  const target = normalizeEmail(email);
  const { data, error } = await supabase
    .from("users")
    .select("id, account_kind, status, email, full_name")
    .ilike("email", target)
    .limit(5);
  if (error) throw new Error(`getUserByNormalizedEmail failed: ${error.message}`);
  const match = (data ?? []).find((r) => normalizeEmail(String(r.email)) === target);
  if (!match) return null;
  return {
    id: match.id as string,
    accountKind: match.account_kind as "staff" | "customer",
    status: match.status as UserStatus,
    email: match.email as string,
    fullName: (match.full_name as string | null) ?? null,
  };
}

export async function insertCustomerProfile(input: {
  id: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  status?: UserStatus;
  createdBy?: string | null;
}): Promise<CustomerProfile> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: input.id,
      account_kind: "customer",
      staff_role: null,
      status: input.status ?? "invited",
      email: normalizeEmail(input.email),
      full_name: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertCustomerProfile failed: ${error.message}`);
  return mapCustomer(data as CustomerUserRow);
}

export async function updateCustomerProfile(
  id: string,
  patch: Partial<{ fullName: string | null; phone: string | null }>,
): Promise<CustomerProfile> {
  const supabase = createSupabaseServiceClient();
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName?.trim() || null;
  if (patch.phone !== undefined) row.phone = patch.phone?.trim() || null;
  const { data, error } = await supabase
    .from("users")
    .update(row)
    .eq("id", id)
    .eq("account_kind", "customer")
    .select("*")
    .single();
  if (error) throw new Error(`updateCustomerProfile failed: ${error.message}`);
  return mapCustomer(data as CustomerUserRow);
}

export async function setCustomerBlocked(id: string, blocked: boolean): Promise<CustomerProfile> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .update(
      blocked
        ? { status: "blocked", blocked_at: new Date().toISOString() }
        : { status: "active", blocked_at: null },
    )
    .eq("id", id)
    .eq("account_kind", "customer")
    .select("*")
    .single();
  if (error) throw new Error(`setCustomerBlocked failed: ${error.message}`);
  if (blocked) {
    try {
      await supabase.auth.admin.signOut(id, "global");
    } catch {
      /* best-effort session revoke */
    }
  }
  return mapCustomer(data as CustomerUserRow);
}

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export async function ensureGuestPurchaser(input: {
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  phone?: string | null;
}): Promise<GuestPurchaser> {
  const supabase = createSupabaseServiceClient();
  const emailNormalized = normalizeEmail(input.email);
  const emailDisplay = input.email.trim();

  const { data: existing, error: findError } = await supabase
    .from("guest_purchasers")
    .select("*")
    .eq("email_normalized", emailNormalized)
    .maybeSingle();
  if (findError) throw new Error(`ensureGuestPurchaser find failed: ${findError.message}`);
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (input.fullName && !existing.full_name) patch.full_name = input.fullName.trim();
    if (input.companyName && !existing.company_name) patch.company_name = input.companyName.trim();
    if (input.phone && !existing.phone) patch.phone = input.phone.trim();
    if (Object.keys(patch).length === 0) return mapGuest(existing as GuestRow);
    const { data: updated, error: updError } = await supabase
      .from("guest_purchasers")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updError) throw new Error(`ensureGuestPurchaser update failed: ${updError.message}`);
    return mapGuest(updated as GuestRow);
  }

  const { data, error } = await supabase
    .from("guest_purchasers")
    .insert({
      email_normalized: emailNormalized,
      email_display: emailDisplay,
      full_name: input.fullName?.trim() || null,
      company_name: input.companyName?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .select("*")
    .single();
  if (error) {
    // race: unique email
    if (/duplicate|unique/i.test(error.message)) {
      const { data: raced } = await supabase
        .from("guest_purchasers")
        .select("*")
        .eq("email_normalized", emailNormalized)
        .single();
      if (raced) return mapGuest(raced as GuestRow);
    }
    throw new Error(`ensureGuestPurchaser insert failed: ${error.message}`);
  }
  return mapGuest(data as GuestRow);
}

export async function getGuestById(id: string): Promise<GuestPurchaser | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("guest_purchasers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getGuestById failed: ${error.message}`);
  return data ? mapGuest(data as GuestRow) : null;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type CreateOrderLineInput = {
  productId?: string | null;
  sku?: string | null;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  taxRateBps?: number;
  taxMinor: number;
  lineTotalMinor: number;
};

export type CreateOrderInput = {
  number?: string;
  companyId?: string | null;
  customerUserId?: string | null;
  guestPurchaserId?: string | null;
  purchaserEmail: string;
  purchaserName?: string | null;
  purchaserPhone?: string | null;
  purchaserCompanyName?: string | null;
  billingAddress?: AddressSnapshot;
  shippingAddress?: AddressSnapshot;
  currency?: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfilmentStatus?: FulfilmentStatus;
  source?: OrderSource;
  placedAt?: string;
  lines: CreateOrderLineInput[];
};

export async function createOrder(input: CreateOrderInput): Promise<CommerceOrder> {
  if (!input.lines.length) throw new Error("createOrder requires at least one line");
  if (!input.guestPurchaserId && !input.customerUserId && !input.companyId) {
    throw new Error("createOrder requires guest, customer, or company identity");
  }

  const supabase = createSupabaseServiceClient();
  const placedAt = input.placedAt ?? new Date().toISOString();
  let number = input.number?.trim();
  if (!number) {
    const { data: numData, error: numError } = await supabase
      .schema("private")
      .rpc("next_order_number", { p_placed_at: placedAt });
    if (numError || !numData) {
      number = `ORD-${Date.now()}`;
    } else {
      number = String(numData);
    }
  }

  const emailNorm = normalizeEmail(input.purchaserEmail);
  const { data, error } = await supabase
    .from("orders")
    .insert({
      number,
      company_id: input.companyId ?? null,
      customer_user_id: input.customerUserId ?? null,
      guest_purchaser_id: input.guestPurchaserId ?? null,
      purchaser_email: input.purchaserEmail.trim(),
      purchaser_email_normalized: emailNorm,
      purchaser_name: input.purchaserName?.trim() || null,
      purchaser_phone: input.purchaserPhone?.trim() || null,
      purchaser_company_name: input.purchaserCompanyName?.trim() || null,
      billing_address: input.billingAddress ?? {},
      shipping_address: input.shippingAddress ?? {},
      currency: (input.currency ?? "EUR").toUpperCase(),
      subtotal_minor: input.subtotalMinor,
      tax_minor: input.taxMinor,
      total_minor: input.totalMinor,
      order_status: input.orderStatus ?? "pending",
      payment_status: input.paymentStatus ?? "unpaid",
      fulfilment_status: input.fulfilmentStatus ?? "unfulfilled",
      source: input.source ?? "storefront",
      placed_at: placedAt,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createOrder failed: ${error.message}`);

  const order = mapOrder(data as OrderRow);
  const itemRows = input.lines.map((line, index) => ({
    order_id: order.id,
    line_number: index + 1,
    product_id: line.productId ?? null,
    sku: line.sku ?? null,
    name: line.name.trim(),
    quantity: line.quantity,
    unit_price_minor: line.unitPriceMinor,
    tax_rate_bps: line.taxRateBps ?? 2100,
    tax_minor: line.taxMinor,
    line_total_minor: line.lineTotalMinor,
  }));
  const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
  if (itemsError) throw new Error(`createOrder items failed: ${itemsError.message}`);
  return order;
}

export async function listOrdersForCustomer(userId: string): Promise<CommerceOrder[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_user_id", userId)
    .order("placed_at", { ascending: false });
  if (error) throw new Error(`listOrdersForCustomer failed: ${error.message}`);
  return (data as OrderRow[]).map(mapOrder);
}

export async function listOrdersForGuest(guestId: string): Promise<CommerceOrder[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("guest_purchaser_id", guestId)
    .order("placed_at", { ascending: false });
  if (error) throw new Error(`listOrdersForGuest failed: ${error.message}`);
  return (data as OrderRow[]).map(mapOrder);
}

export async function listOrderItems(orderId: string): Promise<CommerceOrderItem[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("line_number", { ascending: true });
  if (error) throw new Error(`listOrderItems failed: ${error.message}`);
  return (data as OrderItemRow[]).map(mapOrderItem);
}

export async function linkOrdersToCustomer(input: {
  guestPurchaserId: string;
  customerUserId: string;
  companyId: string | null;
}): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      customer_user_id: input.customerUserId,
      company_id: input.companyId,
    })
    .eq("guest_purchaser_id", input.guestPurchaserId)
    .is("customer_user_id", null)
    .select("id");
  if (error) throw new Error(`linkOrdersToCustomer failed: ${error.message}`);
  return data?.length ?? 0;
}

export async function markGuestConverted(input: {
  guestId: string;
  userId: string;
  companyId: string | null;
}): Promise<GuestPurchaser> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("guest_purchasers")
    .update({
      converted_user_id: input.userId,
      converted_company_id: input.companyId,
      converted_at: new Date().toISOString(),
    })
    .eq("id", input.guestId)
    .is("converted_user_id", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`markGuestConverted failed: ${error.message}`);
  if (data) return mapGuest(data as GuestRow);
  const existing = await getGuestById(input.guestId);
  if (!existing) throw new Error("Guest not found");
  return existing;
}

// ---------------------------------------------------------------------------
// Admin list read models
// ---------------------------------------------------------------------------

export type RegisteredCustomerListItem = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  status: UserStatus;
  companyId: string | null;
  companyName: string | null;
  orderCount: number;
  totalSpendMinor: number;
  lastOrderAt: string | null;
  createdAt: string;
};

export type GuestCustomerListItem = {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  phone: string | null;
  orderCount: number;
  totalSpendMinor: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  conversionStatus: "eligible" | "converted";
  collidingCustomerId: string | null;
};

export type CustomerListQuery = {
  q?: string;
  status?: UserStatus | "all";
  sort?: "name" | "created" | "last_order" | "order_count" | "total_spend";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

function pageBounds(page = 1, pageSize = 25): { from: number; to: number; page: number; pageSize: number } {
  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));
  const from = (safePage - 1) * safeSize;
  return { from, to: from + safeSize - 1, page: safePage, pageSize: safeSize };
}

export async function listRegisteredCustomers(
  query: CustomerListQuery = {},
): Promise<{ items: RegisteredCustomerListItem[]; total: number; page: number; pageSize: number }> {
  const supabase = createSupabaseServiceClient();
  const { from, to, page, pageSize } = pageBounds(query.page, query.pageSize);
  const q = query.q?.trim() ?? "";

  let req = supabase
    .from("users")
    .select("id, email, full_name, phone, status, created_at", { count: "exact" })
    .eq("account_kind", "customer");

  if (query.status && query.status !== "all") {
    req = req.eq("status", query.status);
  }
  if (q) {
    req = req.or(
      `email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }

  const sort = query.sort ?? "created";
  const ascending = (query.order ?? "desc") === "asc";
  if (sort === "name") req = req.order("full_name", { ascending, nullsFirst: false });
  else req = req.order("created_at", { ascending });

  const { data, error, count } = await req.range(from, to);
  if (error) throw new Error(`listRegisteredCustomers failed: ${error.message}`);

  const users = (data ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    status: UserStatus;
    created_at: string;
  }>;
  const ids = users.map((u) => u.id);

  const membershipsByUser = new Map<string, { companyId: string; companyName: string }>();
  const statsByUser = new Map<
    string,
    { orderCount: number; totalSpendMinor: number; lastOrderAt: string | null }
  >();

  if (ids.length) {
    const { data: memberships, error: mErr } = await supabase
      .from("company_users")
      .select("user_id, company_id, companies(legal_name, display_name)")
      .in("user_id", ids);
    if (mErr) throw new Error(`listRegisteredCustomers memberships failed: ${mErr.message}`);
    for (const m of memberships ?? []) {
      const uid = m.user_id as string;
      if (membershipsByUser.has(uid)) continue;
      const co = m.companies as
        | { legal_name: string; display_name: string | null }
        | { legal_name: string; display_name: string | null }[]
        | null;
      const company = Array.isArray(co) ? co[0] : co;
      membershipsByUser.set(uid, {
        companyId: m.company_id as string,
        companyName: company?.display_name || company?.legal_name || null,
      } as { companyId: string; companyName: string });
    }

    const { data: stats, error: sErr } = await supabase
      .schema("private")
      .rpc("admin_order_stats_for_users", { p_user_ids: ids });
    if (sErr) throw new Error(`listRegisteredCustomers stats failed: ${sErr.message}`);
    for (const s of stats ?? []) {
      statsByUser.set(s.customer_user_id as string, {
        orderCount: Number(s.order_count ?? 0),
        totalSpendMinor: Number(s.total_spend_minor ?? 0),
        lastOrderAt: (s.last_order_at as string | null) ?? null,
      });
    }
  }

  let items: RegisteredCustomerListItem[] = users.map((u) => {
    const m = membershipsByUser.get(u.id);
    const s = statsByUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      phone: u.phone,
      status: u.status,
      companyId: m?.companyId ?? null,
      companyName: m?.companyName ?? null,
      orderCount: s?.orderCount ?? 0,
      totalSpendMinor: s?.totalSpendMinor ?? 0,
      lastOrderAt: s?.lastOrderAt ?? null,
      createdAt: u.created_at,
    };
  });

  // In-memory sort for aggregate fields (page already filtered)
  if (sort === "last_order" || sort === "order_count" || sort === "total_spend") {
    const dir = ascending ? 1 : -1;
    items = [...items].sort((a, b) => {
      if (sort === "order_count") return (a.orderCount - b.orderCount) * dir;
      if (sort === "total_spend") return (a.totalSpendMinor - b.totalSpendMinor) * dir;
      const at = a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0;
      const bt = b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0;
      return (at - bt) * dir;
    });
  }

  return { items, total: count ?? items.length, page, pageSize };
}

export async function listGuestPurchasers(
  query: CustomerListQuery = {},
): Promise<{ items: GuestCustomerListItem[]; total: number; page: number; pageSize: number }> {
  const supabase = createSupabaseServiceClient();
  const { from, to, page, pageSize } = pageBounds(query.page, query.pageSize);
  const q = query.q?.trim() ?? "";

  let req = supabase
    .from("guest_purchasers")
    .select("*", { count: "exact" })
    .is("converted_user_id", null);

  if (q) {
    req = req.or(
      `email_display.ilike.%${q}%,email_normalized.ilike.%${q}%,full_name.ilike.%${q}%,company_name.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }

  const ascending = (query.order ?? "desc") === "asc";
  req = req.order("created_at", { ascending });

  const { data, error, count } = await req.range(from, to);
  if (error) throw new Error(`listGuestPurchasers failed: ${error.message}`);
  const guests = (data ?? []) as GuestRow[];
  const ids = guests.map((g) => g.id);

  const statsByGuest = new Map<
    string,
    {
      orderCount: number;
      totalSpendMinor: number;
      firstOrderAt: string | null;
      lastOrderAt: string | null;
    }
  >();
  const collisions = new Map<string, string>();

  if (ids.length) {
    const { data: stats, error: sErr } = await supabase
      .schema("private")
      .rpc("admin_order_stats_for_guests", { p_guest_ids: ids });
    if (sErr) throw new Error(`listGuestPurchasers stats failed: ${sErr.message}`);
    for (const s of stats ?? []) {
      statsByGuest.set(s.guest_purchaser_id as string, {
        orderCount: Number(s.order_count ?? 0),
        totalSpendMinor: Number(s.total_spend_minor ?? 0),
        firstOrderAt: (s.first_order_at as string | null) ?? null,
        lastOrderAt: (s.last_order_at as string | null) ?? null,
      });
    }

    const emails = guests.map((g) => g.email_normalized);
    const { data: users } = await supabase
      .from("users")
      .select("id, email, account_kind")
      .eq("account_kind", "customer")
      .in("email", emails);
    for (const u of users ?? []) {
      collisions.set(normalizeEmail(String(u.email)), u.id as string);
    }
  }

  let items: GuestCustomerListItem[] = guests.map((g) => {
    const s = statsByGuest.get(g.id);
    return {
      id: g.id,
      email: g.email_display,
      fullName: g.full_name,
      companyName: g.company_name,
      phone: g.phone,
      orderCount: s?.orderCount ?? 0,
      totalSpendMinor: s?.totalSpendMinor ?? 0,
      firstOrderAt: s?.firstOrderAt ?? null,
      lastOrderAt: s?.lastOrderAt ?? null,
      conversionStatus: g.converted_user_id ? "converted" : "eligible",
      collidingCustomerId: collisions.get(g.email_normalized) ?? null,
    };
  });

  const sort = query.sort ?? "created";
  if (sort === "last_order" || sort === "order_count" || sort === "total_spend" || sort === "name") {
    const dir = ascending ? 1 : -1;
    items = [...items].sort((a, b) => {
      if (sort === "name") {
        return (a.fullName || a.email).localeCompare(b.fullName || b.email, "nl") * dir;
      }
      if (sort === "order_count") return (a.orderCount - b.orderCount) * dir;
      if (sort === "total_spend") return (a.totalSpendMinor - b.totalSpendMinor) * dir;
      const at = a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0;
      const bt = b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0;
      return (at - bt) * dir;
    });
  }

  return { items, total: count ?? items.length, page, pageSize };
}

export { writeStaffAudit };
