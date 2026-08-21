import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AdminAuthError } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  adminConvertGuestSchema,
  adminCustomerExportSchema,
  adminCustomerIdSchema,
  adminCustomerImportSchema,
  adminCustomerListSchema,
  adminGuestIdSchema,
  adminInviteCustomerSchema,
  adminSeedCommerceFixturesSchema,
  adminSetCustomerBlockedSchema,
  adminUpdateCompanySchema,
  adminUpdateCustomerSchema,
} from "@mccoy/validation";
import {
  commerceFixturesAllowed,
  commitCustomerImport,
  convertGuestPurchaser,
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
  requireAdminSession,
  seedCommerceFixtures,
  setCustomerBlocked,
  updateCompany,
  updateCustomerProfile,
  writeStaffAudit,
} from "@mccoy/database/server";

const adminOrderIdSchema = z.object({ orderId: z.string().uuid() });

function authErrorResult(error: unknown): { ok: false; error: string } {
  if (error instanceof AdminAuthError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, error: error.message };
  }
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
      return { ok: true as const, emails: result.emails };
    } catch (error) {
      return authErrorResult(error);
    }
  });
