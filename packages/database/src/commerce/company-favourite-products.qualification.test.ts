import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { AdminAuthError } from "@mccoy/security";

import { applyQualificationEnv, isQualificationDbReachable } from "../customer-portal/qualification/env";
import {
  seedQualificationCompanies,
  type QualificationCompanies,
} from "../customer-portal/qualification/seed";
import { createSupabaseServiceClient } from "../supabase";
import {
  addCompanyFavouriteProduct,
  addPortalFavouriteProduct,
  insertCatalogueProduct,
  listCompanyFavouriteProducts,
  listPortalFavouriteProducts,
  removeCompanyFavouriteProduct,
  removePortalFavouriteProduct,
  FavouriteProductsError,
} from "./company-favourite-products";

const qualAvailable = await isQualificationDbReachable();

describe.skipIf(!qualAvailable)("Company favourite products qualification", () => {
  let fixtures: QualificationCompanies;
  let activeProductId: string;
  let otherActiveProductId: string;
  let draftProductId: string;
  let archivedProductId: string;

  beforeAll(async () => {
    applyQualificationEnv();
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("company_favourite_products").select("id").limit(1);
    if (error) {
      throw new Error(
        `company_favourite_products is not available. Apply supabase/migrations/20260918160000_company_favourite_products.sql. ${error.message}`,
      );
    }

    fixtures = await seedQualificationCompanies(applyQualificationEnv());
    const suffix = fixtures.suffix;
    const active = await insertCatalogueProduct({
      name: `Qual mop ${suffix}`,
      sku: `QUAL-MOP-${suffix}`,
      status: "active",
    });
    const other = await insertCatalogueProduct({
      name: `Qual glass ${suffix}`,
      sku: `QUAL-GLS-${suffix}`,
      status: "active",
    });
    const draft = await insertCatalogueProduct({
      name: `Qual draft ${suffix}`,
      sku: `QUAL-DRF-${suffix}`,
      status: "draft",
    });
    const archived = await insertCatalogueProduct({
      name: `Qual archived ${suffix}`,
      sku: `QUAL-ARC-${suffix}`,
      status: "archived",
    });
    activeProductId = active.id;
    otherActiveProductId = other.id;
    draftProductId = draft.id;
    archivedProductId = archived.id;
  }, 120_000);

  function customerClient(accessToken: string) {
    const config = applyQualificationEnv();
    return createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  it("lets a company member mutate their own company list", async () => {
    const added = await addPortalFavouriteProduct({
      userId: fixtures.userA.userId,
      productId: activeProductId,
    });
    expect(added.companyId).toBe(fixtures.companyAId);
    expect(added.productId).toBe(activeProductId);

    const listed = await listPortalFavouriteProducts(fixtures.userA.userId);
    expect(listed.some((item) => item.productId === activeProductId)).toBe(true);

    const removed = await removePortalFavouriteProduct({
      userId: fixtures.userA.userId,
      productId: activeProductId,
    });
    expect(removed.removed).toBe(true);

    const after = await listPortalFavouriteProducts(fixtures.userA.userId);
    expect(after.some((item) => item.productId === activeProductId)).toBe(false);
  });

  it("isolates Company A from Company B", async () => {
    await addPortalFavouriteProduct({
      userId: fixtures.adminB.userId,
      productId: otherActiveProductId,
    });

    const listA = await listPortalFavouriteProducts(fixtures.userA.userId);
    expect(listA.some((item) => item.companyId === fixtures.companyBId)).toBe(false);
    expect(listA.some((item) => item.productId === otherActiveProductId)).toBe(false);

    const clientA = customerClient(fixtures.userA.accessToken);
    const { data: leaked } = await clientA
      .from("company_favourite_products")
      .select("id, company_id")
      .eq("company_id", fixtures.companyBId);
    expect(leaked ?? []).toHaveLength(0);

    const { data: inserted, error: insertError } = await clientA
      .from("company_favourite_products")
      .insert({
        company_id: fixtures.companyBId,
        product_id: activeProductId,
        created_by: fixtures.userA.userId,
      })
      .select("id");
    expect(inserted ?? []).toHaveLength(0);
    expect(insertError).toBeTruthy();
  });

  it("denies a customer invoking admin favourite mutations", async () => {
    await expect(
      addCompanyFavouriteProduct({
        companyId: fixtures.companyBId,
        productId: activeProductId,
        actorUserId: fixtures.userA.userId,
        actorKind: "customer",
      }),
    ).rejects.toBeInstanceOf(AdminAuthError);

    await expect(
      removeCompanyFavouriteProduct({
        companyId: fixtures.companyBId,
        productId: otherActiveProductId,
        actorUserId: fixtures.userA.userId,
        actorKind: "customer",
      }),
    ).rejects.toBeInstanceOf(AdminAuthError);
  });

  it("lets staff add and remove favourites for any company", async () => {
    const added = await addCompanyFavouriteProduct({
      companyId: fixtures.companyBId,
      productId: activeProductId,
      actorUserId: fixtures.staffActorId,
      actorKind: "staff",
    });
    expect(added.companyId).toBe(fixtures.companyBId);
    expect(added.productId).toBe(activeProductId);

    const listed = await listCompanyFavouriteProducts(fixtures.companyBId);
    expect(listed.some((item) => item.productId === activeProductId)).toBe(true);

    const removed = await removeCompanyFavouriteProduct({
      companyId: fixtures.companyBId,
      productId: activeProductId,
      actorUserId: fixtures.staffActorId,
      actorKind: "staff",
    });
    expect(removed.removed).toBe(true);
  });

  it("rejects draft, archived, and unknown product ids", async () => {
    await expect(
      addPortalFavouriteProduct({
        userId: fixtures.userA.userId,
        productId: draftProductId,
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_ACTIVE" } satisfies Partial<FavouriteProductsError>);

    await expect(
      addCompanyFavouriteProduct({
        companyId: fixtures.companyAId,
        productId: archivedProductId,
        actorUserId: fixtures.staffActorId,
        actorKind: "staff",
      }),
    ).rejects.toBeInstanceOf(FavouriteProductsError);

    await expect(
      addPortalFavouriteProduct({
        userId: fixtures.userA.userId,
        productId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });
  });

  it("denies anonymous writes", async () => {
    const config = applyQualificationEnv();
    const anon = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false },
    });
    const { error } = await anon.from("company_favourite_products").insert({
      company_id: fixtures.companyAId,
      product_id: activeProductId,
    });
    expect(error).toBeTruthy();
  });
});
