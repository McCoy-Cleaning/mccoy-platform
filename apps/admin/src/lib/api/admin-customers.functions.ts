import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AdminAuthError, RateLimitError } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  adminConvertGuestSchema,
  adminCustomerExportSchema,
  adminCustomerIdSchema,
  adminCustomerImportSchema,
  adminExistingCustomerFileImportSchema,
  adminDeletePortalCompaniesSchema,
  adminCustomerListSchema,
  adminGuestIdSchema,
  adminInviteCustomerSchema,
  adminCustomersDirectorySchema,
  adminCustomersDirectoryExportSchema,
  adminCompanyFavouriteListSchema,
  adminCompanyFavouriteMutateSchema,
  adminProductSearchSchema,
  adminSeedCommerceFixturesSchema,
  adminSetCustomerBlockedSchema,
  adminUpdateCompanySchema,
  adminUpdateCustomerSchema,
} from "@mccoy/validation";
import {
  commerceFixturesAllowed,
  commitCustomerImport,
  commitExistingCustomerImport,
  convertGuestPurchaser,
  deletePortalServiceCompanies,
  exportCustomersCsv,
  getCustomerById,
  getGuestById,
  importCustomersPreview,
  inviteRegisteredCustomer,
  listCompaniesForUser,
  listGuestPurchasers,
  listOrderItems,
  listOrdersForCustomer,
  listOrdersForGuest,
  listRegisteredCustomers,
  previewExistingCustomerImport,
  requireAdminSession,
  seedCommerceFixtures,
  setCustomerBlocked,
  updateCompany,
  updateCustomerProfile,
  writeStaffAudit,
  listPortalCompanies,
  listAdminCustomersDirectory,
  exportAdminCustomersDirectoryCsv,
  seedAdminCustomersDirectoryDemo,
  recordAdminCustomerImportRun,
  staffInviteAccountAdmin,
  staffInviteAccountUser,
  getCompanyById,
  listCompanyMemberships,
  listInvitationsForCompany,
  resolveCustomerPortalStatus,
  syncExistingServiceClients,
  processCommerceEmailOutbox,
  processExpiredCustomerInvitations,
  transferAccountAdmin,
  resendPortalInvitation,
  staffSuspendCompanyMembership,
  staffReactivateCompanyMembership,
  assertFavouriteAdminAccess,
  listCompanyFavouriteProducts,
  addCompanyFavouriteProduct,
  removeCompanyFavouriteProduct,
  searchActiveProducts,
  FavouriteProductsError,
  CustomerPortalError,
} from "@mccoy/database/server";

const adminOrderIdSchema = z.object({ orderId: z.string().uuid() });

/**
 * Only deliberate domain messages reach the browser. Data-layer errors wrap raw
 * Postgres / PostgREST / Supabase Auth text (`"<fn> failed: <provider text>"`),
 * which must not be rendered in the admin UI.
 */
function authErrorResult(error: unknown): { ok: false; error: string } {
  if (
    error instanceof AdminAuthError ||
    error instanceof CustomerPortalError ||
    error instanceof FavouriteProductsError ||
    error instanceof RateLimitError
  ) {
    return { ok: false, error: error.message };
  }
  console.error("[admin-customers] unexpected server function error", error);
  return { ok: false, error: "Er ging iets mis. Probeer het opnieuw." };
}

export const listAdminCustomers = createServerFn({ method: "POST" })
  .validator(adminCustomerListSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      if (data.population === "guests") {
        const result = await listGuestPurchasers(data);
        return { ok: true as const, population: "guests" as const, ...result };
      }
      const result = await listRegisteredCustomers(data);
      return { ok: true as const, population: "registered" as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const getAdminCustomerDetail = createServerFn({ method: "POST" })
  .validator(adminCustomerIdSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const customer = await getCustomerById(data.customerId);
      if (!customer) return { ok: false as const, error: "Klant niet gevonden." };
      const companies = await listCompaniesForUser(customer.id);
      const orders = await listOrdersForCustomer(customer.id);
      return { ok: true as const, customer, companies, orders };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const getAdminGuestDetail = createServerFn({ method: "POST" })
  .validator(adminGuestIdSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const guest = await getGuestById(data.guestId);
      if (!guest) return { ok: false as const, error: "Gast niet gevonden." };
      const orders = await listOrdersForGuest(guest.id);
      return { ok: true as const, guest, orders };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const listAdminOrderItems = createServerFn({ method: "POST" })
  .validator(adminOrderIdSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const items = await listOrderItems(data.orderId);
      return { ok: true as const, items };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const updateAdminCustomer = createServerFn({ method: "POST" })
  .validator(adminUpdateCustomerSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      const before = await getCustomerById(data.customerId);
      if (!before) return { ok: false as const, error: "Klant niet gevonden." };
      const customer = await updateCustomerProfile(data.customerId, {
        fullName: data.fullName,
        phone: data.phone,
      });
      await writeStaffAudit({
        actorUserId: session.userId ?? null,
        action: "customer.profile_updated",
        targetType: "user",
        targetId: customer.id,
        before: { fullName: before.fullName, phone: before.phone },
        after: { fullName: customer.fullName, phone: customer.phone },
      });
      return { ok: true as const, customer };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const updateAdminCompany = createServerFn({ method: "POST" })
  .validator(adminUpdateCompanySchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      const { companyId, ...patch } = data;
      const company = await updateCompany(companyId, patch);
      await writeStaffAudit({
        actorUserId: session.userId ?? null,
        action: "customer.company_updated",
        targetType: "company",
        targetId: company.id,
        after: patch as Record<string, unknown>,
      });
      return { ok: true as const, company };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const setAdminCustomerBlocked = createServerFn({ method: "POST" })
  .validator(adminSetCustomerBlockedSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      const customer = await setCustomerBlocked(data.customerId, data.blocked);
      await writeStaffAudit({
        actorUserId: session.userId ?? null,
        action: data.blocked ? "customer.blocked" : "customer.unblocked",
        targetType: "user",
        targetId: customer.id,
        after: { status: customer.status, blockedAt: customer.blockedAt },
      });
      return { ok: true as const, customer };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const inviteAdminCustomer = createServerFn({ method: "POST" })
  .validator(adminInviteCustomerSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      const result = await inviteRegisteredCustomer({
        ...data,
        actorUserId: session.userId,
      });
      return result;
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const convertAdminGuest = createServerFn({ method: "POST" })
  .validator(adminConvertGuestSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      return await convertGuestPurchaser({
        guestId: data.guestId,
        companyLegalName: data.companyLegalName,
        actorUserId: session.userId,
      });
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const exportAdminCustomers = createServerFn({ method: "POST" })
  .validator(adminCustomerExportSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const csv = await exportCustomersCsv({
        population: data.population,
        query: { q: data.q, status: data.status },
      });
      return { ok: true as const, csv };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const importAdminCustomers = createServerFn({ method: "POST" })
  .validator(adminCustomerImportSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!data.commit) {
        const preview = importCustomersPreview(data.csvText);
        return { ok: true as const, mode: "preview" as const, preview };
      }
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      const result = await commitCustomerImport({
        csvText: data.csvText,
        actorUserId: session.userId,
      });
      return { ok: true as const, mode: "commit" as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/** Existing service clients: CSV/XLSX → mirror → sync → auto Account Admin invite for NEW+email. */
export const importAdminExistingServiceClients = createServerFn({ method: "POST" })
  .validator(adminExistingCustomerFileImportSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };

      let bytes: Buffer;
      try {
        bytes = Buffer.from(data.fileBase64, "base64");
      } catch {
        return { ok: false as const, error: "Bestand kon niet worden gelezen." };
      }
      if (!bytes.byteLength) {
        return { ok: false as const, error: "Bestand is leeg." };
      }

      const columnMap = data.columnMap ?? undefined;
      const sheetName = data.sheetName ?? undefined;

      if (!data.commit) {
        const preview = await previewExistingCustomerImport({
          fileName: data.fileName,
          bytes,
          columnMap,
          sheetName: sheetName || undefined,
        });
        if ("ok" in preview && preview.ok === false) {
          return { ok: false as const, error: preview.error };
        }
        const full = preview as Exclude<
          Awaited<ReturnType<typeof previewExistingCustomerImport>>,
          { ok: false }
        >;
        return {
          ok: true as const,
          mode: "preview" as const,
          preview: {
            fileName: full.fileName,
            sheetName: full.sheetName,
            headers: full.headers,
            sheetNames: full.sheetNames,
            totalRows: full.totalRows,
            counts: full.counts,
            inviteCounts: full.inviteCounts,
            importableCount: full.importableCount,
            rows: full.rows.map((r) => ({
              sourceRowNumber: r.sourceRowNumber,
              externalCustomerId: r.externalCustomerId,
              companyName: r.companyName,
              classification: r.classification,
              reason: r.reason,
              autoInvitePlan: r.autoInvitePlan,
            })),
          },
        };
      }

      const result = await commitExistingCustomerImport({
        fileName: data.fileName,
        bytes,
        columnMap,
        sheetName: sheetName || undefined,
        actorUserId: session.userId,
      });
      if ("ok" in result && result.ok === false) {
        return { ok: false as const, error: result.error };
      }
      const committed = result as Exclude<
        Awaited<ReturnType<typeof commitExistingCustomerImport>>,
        { ok: false }
      >;
      await recordAdminCustomerImportRun({
        fileName: committed.fileName,
        createdCount: committed.sync.created,
        updatedCount: committed.sync.updated,
        skippedCount: committed.skippedInvalid + committed.skippedConflict,
        actorUserId: session.userId,
        source: "import",
      }).catch(() => undefined);
      return {
        ok: true as const,
        mode: "commit" as const,
        fileName: committed.fileName,
        mirrored: committed.mirrored,
        unchanged: committed.unchanged,
        skippedInvalid: committed.skippedInvalid,
        skippedConflict: committed.skippedConflict,
        sync: committed.sync,
        invites: {
          sent: committed.invites.sent,
          skipped: committed.invites.skipped,
          failed: committed.invites.failed,
        },
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const seedAdminCommerceFixtures = createServerFn({ method: "POST" })
  .validator(adminSeedCommerceFixturesSchema)
  .handler(async () => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!commerceFixturesAllowed()) {
        return { ok: false as const, error: "Fixtures zijn uitgeschakeld in productie." };
      }
      const result = await seedCommerceFixtures(session.userId ?? null);
      await syncExistingServiceClients({ actorUserId: session.userId ?? null });
      let demoCompanyCount = 0;
      try {
        const demo = await seedAdminCustomersDirectoryDemo();
        demoCompanyCount = demo.companyIds.length;
      } catch {
        demoCompanyCount = 0;
      }
      return { ok: true as const, emails: result.emails, demoCompanyCount };
    } catch (error) {
      return authErrorResult(error);
    }
  });

const portalCompanyListSchema = z.object({
  q: z.string().max(200).optional(),
  portalStatus: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

const portalInviteSchema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().max(120).optional().nullable(),
  lastName: z.string().max(120).optional().nullable(),
});

export const getAdminCustomersDirectory = createServerFn({ method: "POST" })
  .validator(adminCustomersDirectorySchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const portalStatus =
        data.portalStatus && data.portalStatus !== "all"
          ? (data.portalStatus as import("@mccoy/domain").CustomerPortalStatus)
          : "all";
      const result = await listAdminCustomersDirectory({
        q: data.q,
        tab: data.tab,
        portalStatus,
        page: data.page,
        pageSize: data.pageSize,
        companyId: data.companyId,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * Full filtered set, built server-side. The browser never receives the unfiltered
 * directory, and the export honours the same tab/search/portal-status scope and the
 * same staff session check as the list.
 */
export const exportAdminCustomersDirectory = createServerFn({ method: "POST" })
  .validator(adminCustomersDirectoryExportSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const result = await exportAdminCustomersDirectoryCsv({
        q: data.q,
        tab: data.tab,
        portalStatus:
          data.portalStatus && data.portalStatus !== "all"
            ? (data.portalStatus as import("@mccoy/domain").CustomerPortalStatus)
            : "all",
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const listAdminPortalCompanies = createServerFn({ method: "POST" })
  .validator(portalCompanyListSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const portalStatus =
        data.portalStatus && data.portalStatus !== "all"
          ? (data.portalStatus as import("@mccoy/domain").CustomerPortalStatus)
          : "all";
      const result = await listPortalCompanies({
        q: data.q,
        portalStatus,
        page: data.page,
        pageSize: data.pageSize,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const inviteAdminPortalAccountAdmin = createServerFn({ method: "POST" })
  .validator(portalInviteSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      const result = await staffInviteAccountAdmin({
        companyId: data.companyId,
        email: data.email,
        actorUserId: session.userId,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const inviteAdminPortalAccountUser = createServerFn({ method: "POST" })
  .validator(
    portalInviteSchema.extend({
      phone: z.string().trim().max(40).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      const result = await staffInviteAccountUser({
        companyId: data.companyId,
        email: data.email,
        actorUserId: session.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const setAdminPortalMembershipStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyId: z.string().uuid(),
      userId: z.string().uuid(),
      status: z.enum(["active", "suspended"]),
    }),
  )
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      if (data.status === "suspended") {
        await staffSuspendCompanyMembership({
          companyId: data.companyId,
          userId: data.userId,
          actorUserId: session.userId,
        });
      } else {
        await staffReactivateCompanyMembership({
          companyId: data.companyId,
          userId: data.userId,
          actorUserId: session.userId,
        });
      }
      return { ok: true as const };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const getAdminCompanyPortalDetail = createServerFn({ method: "POST" })
  .validator(z.object({ companyId: z.string().uuid() }))
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const company = await getCompanyById(data.companyId);
      if (!company) return { ok: false as const, error: "Bedrijf niet gevonden." };
      const portalStatus = await resolveCustomerPortalStatus(data.companyId);
      const members = await listCompanyMemberships(data.companyId);
      const invitations = await listInvitationsForCompany(data.companyId);
      return { ok: true as const, company, portalStatus, members, invitations };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const syncAdminServiceClients = createServerFn({ method: "POST" }).handler(async () => {
  try {
    ensureMonorepoEnvLoaded();
    const session = await requireAdminSession();
    const result = await syncExistingServiceClients({ actorUserId: session.userId ?? null });
    await processCommerceEmailOutbox(10);
    return { ok: true as const, ...result };
  } catch (error) {
    return authErrorResult(error);
  }
});

export const deleteAdminPortalCompanies = createServerFn({ method: "POST" })
  .validator(adminDeletePortalCompaniesSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      const summary = await deletePortalServiceCompanies({
        companyIds: data.companyIds,
        actorUserId: session.userId,
      });
      return {
        ok: true as const,
        deleted: summary.deleted,
        failed: summary.failed,
        results: summary.results.map((r) =>
          r.ok
            ? { ok: true as const, companyId: r.companyId, legalName: r.legalName }
            : { ok: false as const, companyId: r.companyId, error: r.error, code: r.code },
        ),
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const processAdminCommerceJobs = createServerFn({ method: "POST" }).handler(async () => {
  try {
    ensureMonorepoEnvLoaded();
    await requireAdminSession();
    const reminders = await processExpiredCustomerInvitations(25);
    const emails = await processCommerceEmailOutbox(25);
    return { ok: true as const, reminders, emails };
  } catch (error) {
    return authErrorResult(error);
  }
});

export const resendAdminPortalInvitation = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyId: z.string().uuid(),
      email: z.string().email(),
      intendedRole: z.enum(["account_admin", "account_user"]),
    }),
  )
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      const result = await resendPortalInvitation({
        companyId: data.companyId,
        email: data.email,
        intendedRole: data.intendedRole,
        invitedByType: "staff",
        actorUserId: session.userId,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const transferAdminAccountAdmin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyId: z.string().uuid(),
      newUserId: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      if (!session.userId) return { ok: false as const, error: "Niet geautoriseerd." };
      await transferAccountAdmin({
        companyId: data.companyId,
        newUserId: data.newUserId,
        actorUserId: session.userId,
      });
      return { ok: true as const };
    } catch (error) {
      return authErrorResult(error);
    }
  });

function favouriteErrorResult(error: unknown): { ok: false; error: string } {
  if (error instanceof FavouriteProductsError) {
    return { ok: false, error: error.message };
  }
  return authErrorResult(error);
}

/** Staff: list a company's shared favourite products. */
export const listAdminCompanyFavouriteProducts = createServerFn({ method: "POST" })
  .validator(adminCompanyFavouriteListSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      assertFavouriteAdminAccess("staff");
      const items = await listCompanyFavouriteProducts(data.companyId);
      return { ok: true as const, items };
    } catch (error) {
      return favouriteErrorResult(error);
    }
  });

/** Staff: add an active product to a company's shared favourites. */
export const addAdminCompanyFavouriteProduct = createServerFn({ method: "POST" })
  .validator(adminCompanyFavouriteMutateSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      assertFavouriteAdminAccess("staff");
      const item = await addCompanyFavouriteProduct({
        companyId: data.companyId,
        productId: data.productId,
        actorUserId: session.userId ?? null,
        actorKind: "staff",
      });
      return { ok: true as const, item };
    } catch (error) {
      return favouriteErrorResult(error);
    }
  });

/** Staff: remove a product from a company's shared favourites. */
export const removeAdminCompanyFavouriteProduct = createServerFn({ method: "POST" })
  .validator(adminCompanyFavouriteMutateSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      assertFavouriteAdminAccess("staff");
      const result = await removeCompanyFavouriteProduct({
        companyId: data.companyId,
        productId: data.productId,
        actorUserId: session.userId ?? null,
        actorKind: "staff",
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return favouriteErrorResult(error);
    }
  });

/** Staff: search active catalogue products for the favourite picker. */
export const searchAdminActiveProducts = createServerFn({ method: "POST" })
  .validator(adminProductSearchSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      assertFavouriteAdminAccess("staff");
      const items = await searchActiveProducts({ q: data.q, limit: data.limit });
      return { ok: true as const, items };
    } catch (error) {
      return favouriteErrorResult(error);
    }
  });
