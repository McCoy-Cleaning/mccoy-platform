/**
 * Company-shared favourite products.
 * Admin callers must pass actorKind "staff" after requireAdminSession.
 * Portal callers resolve company from authenticated membership — never a client company_id.
 */

import { AdminAuthError } from "@mccoy/security";
import type { CatalogueProduct, CompanyFavouriteProduct, ProductStatus } from "@mccoy/domain";

import { CustomerPortalError } from "../customer-portal/errors";
import { resolveCustomerMembership } from "../customer-portal/customer-auth";
import { clampQueryLimit, sanitizePostgrestSearchTerm } from "../postgrest-search";
import { writeStaffAudit } from "../staff";
import { createSupabaseServiceClient } from "../supabase";
import { getCompanyById } from "./core";

export type FavouriteActorKind = "staff" | "customer" | "anonymous";

export class FavouriteProductsError extends Error {
  readonly code: "PRODUCT_NOT_FOUND" | "PRODUCT_NOT_ACTIVE" | "COMPANY_NOT_FOUND";

  constructor(message: string, code: FavouriteProductsError["code"]) {
    super(message);
    this.name = "FavouriteProductsError";
    this.code = code;
  }
}

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
};

type FavouriteRow = {
  id: string;
  company_id: string;
  product_id: string;
  created_by: string | null;
  created_at: string;
  products:
    | { name: string; sku: string | null; status: ProductStatus }
    | Array<{ name: string; sku: string | null; status: ProductStatus }>
    | null;
};

export function favouriteAdminAccessDecision(
  kind: FavouriteActorKind,
): { allowed: true } | { allowed: false; error: string } {
  if (kind === "staff") return { allowed: true };
  return { allowed: false, error: "Niet geautoriseerd." };
}

export function assertFavouriteAdminAccess(kind: FavouriteActorKind): void {
  const decision = favouriteAdminAccessDecision(kind);
  if (!decision.allowed) {
    throw new AdminAuthError(decision.error);
  }
}

export function isProductEligibleToFavourite(status: ProductStatus): boolean {
  return status === "active";
}

function mapProduct(row: ProductRow): CatalogueProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFavourite(row: FavouriteRow): CompanyFavouriteProduct {
  const productRaw = Array.isArray(row.products) ? row.products[0] : row.products;
  return {
    id: row.id,
    companyId: row.company_id,
    productId: row.product_id,
    productName: productRaw?.name ?? "Onbekend product",
    productSku: productRaw?.sku ?? null,
    productStatus: productRaw?.status ?? "archived",
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Product search is reachable by any authenticated portal member — see postgrest-search.ts. */
const PRODUCT_SEARCH_MAX_LIMIT = 50;

async function requireExistingCompany(companyId: string): Promise<void> {
  const company = await getCompanyById(companyId);
  if (!company) {
    throw new FavouriteProductsError("Bedrijf niet gevonden.", "COMPANY_NOT_FOUND");
  }
}

async function requireActiveProduct(productId: string): Promise<CatalogueProduct> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (error) throw new Error(`requireActiveProduct: ${error.message}`);
  if (!data) {
    throw new FavouriteProductsError("Product niet gevonden.", "PRODUCT_NOT_FOUND");
  }
  const product = mapProduct(data as ProductRow);
  if (!isProductEligibleToFavourite(product.status)) {
    throw new FavouriteProductsError(
      "Alleen actieve producten kunnen als favoriet worden toegevoegd.",
      "PRODUCT_NOT_ACTIVE",
    );
  }
  return product;
}

export async function insertCatalogueProduct(input: {
  name: string;
  sku?: string | null;
  status?: ProductStatus;
}): Promise<CatalogueProduct> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      status: input.status ?? "active",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`insertCatalogueProduct: ${error?.message ?? "insert failed"}`);
  return mapProduct(data as ProductRow);
}

export async function searchActiveProducts(input?: {
  q?: string;
  limit?: number;
}): Promise<CatalogueProduct[]> {
  const supabase = createSupabaseServiceClient();
  const limit = clampQueryLimit(input?.limit, 25, PRODUCT_SEARCH_MAX_LIMIT);
  let query = supabase
    .from("products")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(limit);

  const safe = sanitizePostgrestSearchTerm(input?.q ?? "");
  if (safe) {
    query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`searchActiveProducts: ${error.message}`);
  return ((data ?? []) as ProductRow[]).map(mapProduct);
}

export async function listCompanyFavouriteProducts(companyId: string): Promise<CompanyFavouriteProduct[]> {
  await requireExistingCompany(companyId);
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_favourite_products")
    .select("id, company_id, product_id, created_by, created_at, products(name, sku, status)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCompanyFavouriteProducts: ${error.message}`);
  return ((data ?? []) as FavouriteRow[]).map(mapFavourite);
}

export async function addCompanyFavouriteProduct(input: {
  companyId: string;
  productId: string;
  actorUserId: string | null;
  actorKind: FavouriteActorKind;
}): Promise<CompanyFavouriteProduct> {
  assertFavouriteAdminAccess(input.actorKind);
  await requireExistingCompany(input.companyId);
  const product = await requireActiveProduct(input.productId);

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_favourite_products")
    .insert({
      company_id: input.companyId,
      product_id: input.productId,
      created_by: input.actorUserId,
    })
    .select("id, company_id, product_id, created_by, created_at, products(name, sku, status)")
    .single();

  if (error?.code === "23505") {
    const existing = await supabase
      .from("company_favourite_products")
      .select("id, company_id, product_id, created_by, created_at, products(name, sku, status)")
      .eq("company_id", input.companyId)
      .eq("product_id", input.productId)
      .maybeSingle();
    if (existing.error) throw new Error(`addCompanyFavouriteProduct existing: ${existing.error.message}`);
    if (existing.data) return mapFavourite(existing.data as FavouriteRow);
  }
  if (error || !data) {
    throw new Error(`addCompanyFavouriteProduct: ${error?.message ?? "insert failed"}`);
  }

  const row = mapFavourite(data as FavouriteRow);
  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "company.favourite_product_added",
    targetType: "company",
    targetId: input.companyId,
    after: { productId: product.id, favouriteId: row.id },
  });
  return row;
}

export async function removeCompanyFavouriteProduct(input: {
  companyId: string;
  productId: string;
  actorUserId: string | null;
  actorKind: FavouriteActorKind;
}): Promise<{ removed: boolean }> {
  assertFavouriteAdminAccess(input.actorKind);
  await requireExistingCompany(input.companyId);

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_favourite_products")
    .delete()
    .eq("company_id", input.companyId)
    .eq("product_id", input.productId)
    .select("id");
  if (error) throw new Error(`removeCompanyFavouriteProduct: ${error.message}`);

  const removed = (data ?? []).length > 0;
  if (removed) {
    await writeStaffAudit({
      actorUserId: input.actorUserId,
      action: "company.favourite_product_removed",
      targetType: "company",
      targetId: input.companyId,
      after: { productId: input.productId },
    });
  }
  return { removed };
}

export async function listPortalFavouriteProducts(userId: string): Promise<CompanyFavouriteProduct[]> {
  const membership = await resolveCustomerMembership(userId);
  if (!membership) {
    throw new CustomerPortalError("Geen actieve bedrijfskoppeling.", "CUSTOMER_NOT_AUTHORIZED");
  }
  return listCompanyFavouriteProducts(membership.companyId);
}

export async function addPortalFavouriteProduct(input: {
  userId: string;
  productId: string;
}): Promise<CompanyFavouriteProduct> {
  const membership = await resolveCustomerMembership(input.userId);
  if (!membership) {
    throw new CustomerPortalError("Geen actieve bedrijfskoppeling.", "CUSTOMER_NOT_AUTHORIZED");
  }
  await requireActiveProduct(input.productId);

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_favourite_products")
    .insert({
      company_id: membership.companyId,
      product_id: input.productId,
      created_by: input.userId,
    })
    .select("id, company_id, product_id, created_by, created_at, products(name, sku, status)")
    .single();

  if (error?.code === "23505") {
    const existing = await supabase
      .from("company_favourite_products")
      .select("id, company_id, product_id, created_by, created_at, products(name, sku, status)")
      .eq("company_id", membership.companyId)
      .eq("product_id", input.productId)
      .maybeSingle();
    if (existing.error) throw new Error(`addPortalFavouriteProduct existing: ${existing.error.message}`);
    if (existing.data) return mapFavourite(existing.data as FavouriteRow);
  }
  if (error || !data) {
    throw new Error(`addPortalFavouriteProduct: ${error?.message ?? "insert failed"}`);
  }

  const row = mapFavourite(data as FavouriteRow);
  await writeStaffAudit({
    actorUserId: input.userId,
    action: "company.favourite_product_added",
    targetType: "company",
    targetId: membership.companyId,
    after: { productId: input.productId, favouriteId: row.id, by: "member" },
  });
  return row;
}

export async function removePortalFavouriteProduct(input: {
  userId: string;
  productId: string;
}): Promise<{ removed: boolean }> {
  const membership = await resolveCustomerMembership(input.userId);
  if (!membership) {
    throw new CustomerPortalError("Geen actieve bedrijfskoppeling.", "CUSTOMER_NOT_AUTHORIZED");
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_favourite_products")
    .delete()
    .eq("company_id", membership.companyId)
    .eq("product_id", input.productId)
    .select("id");
  if (error) throw new Error(`removePortalFavouriteProduct: ${error.message}`);

  const removed = (data ?? []).length > 0;
  if (removed) {
    await writeStaffAudit({
      actorUserId: input.userId,
      action: "company.favourite_product_removed",
      targetType: "company",
      targetId: membership.companyId,
      after: { productId: input.productId, by: "member" },
    });
  }
  return { removed };
}
