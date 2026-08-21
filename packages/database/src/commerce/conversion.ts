/**
 * Guest → registered conversion (server-only, service role).
 */

import { normalizeEmail } from "@mccoy/domain";
import { AdminAuthError } from "@mccoy/security";

import {
  addCompanyMember,
  createCompany,
  ensureGuestPurchaser,
  getGuestById,
  getUserByNormalizedEmail,
  insertCustomerProfile,
  linkOrdersToCustomer,
  markGuestConverted,
  writeStaffAudit,
} from "./core";
import { createSupabaseServiceClient, getSupabasePublicConfig } from "../supabase";
import { findAuthUserIdByEmail } from "../staff";

export type ConvertGuestResult =
  | {
      ok: true;
      mode: "linked_existing" | "invited" | "already_converted";
      userId: string;
      companyId: string | null;
      ordersLinked: number;
    }
  | { ok: false; error: string; code: "validation" | "collision_staff" | "not_found" | "config" };

function inviteRedirectUrl(): string {
  const { url } = getSupabasePublicConfig();
  // Customer invite landing — storefront account onboarding will use this later.
  // Admin app origin is fine as a safe redirect host already allow-listed for Auth.
  const site = process.env.STOREFRONT_ORIGIN?.replace(/\/$/, "") || "https://www.mccoy.nl";
  return `${site}/account/invite`;
}

/**
 * Convert or link a guest purchaser to a registered customer.
 * Idempotent. Never creates passwords. Never creates duplicate Auth users.
 */
export async function convertGuestPurchaser(input: {
  guestId: string;
  actorUserId: string;
  companyLegalName?: string | null;
}): Promise<ConvertGuestResult> {
  const guest = await getGuestById(input.guestId);
  if (!guest) return { ok: false, error: "Gast niet gevonden.", code: "not_found" };

  if (guest.convertedUserId) {
    return {
      ok: true,
      mode: "already_converted",
      userId: guest.convertedUserId,
      companyId: guest.convertedCompanyId,
      ordersLinked: 0,
    };
  }

  const email = guest.emailNormalized;
  if (!email) return { ok: false, error: "Gast heeft geen e-mailadres.", code: "validation" };

  const existing = await getUserByNormalizedEmail(email);
  if (existing?.accountKind === "staff") {
    return {
      ok: false,
      error: "Dit e-mailadres hoort bij een medewerkeraccount en kan niet worden geconverteerd.",
      code: "collision_staff",
    };
  }

  let userId: string;
  let mode: "linked_existing" | "invited";

  if (existing?.accountKind === "customer") {
    userId = existing.id;
    mode = "linked_existing";
  } else {
    const supabase = createSupabaseServiceClient();
    let authUserId = await findAuthUserIdByEmail(email);
    if (!authUserId) {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: inviteRedirectUrl(),
        data: {
          account_kind: "customer",
          full_name: guest.fullName ?? undefined,
        },
      });
      if (error) {
        // invite may fail if user exists in Auth without public.users
        authUserId = await findAuthUserIdByEmail(email);
        if (!authUserId) {
          return {
            ok: false,
            error: error.message || "Uitnodiging versturen mislukt.",
            code: "config",
          };
        }
      } else if (data.user?.id) {
        authUserId = data.user.id;
      } else {
        authUserId = await findAuthUserIdByEmail(email);
      }
    }
    if (!authUserId) {
      return { ok: false, error: "Auth-gebruiker kon niet worden aangemaakt.", code: "config" };
    }

    const profile = await insertCustomerProfile({
      id: authUserId,
      email,
      fullName: guest.fullName,
      phone: guest.phone,
      status: "invited",
      createdBy: input.actorUserId,
    }).catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      if (/duplicate|unique/i.test(message)) {
        const raced = await getUserByNormalizedEmail(email);
        if (raced?.accountKind === "customer") return null;
      }
      throw err;
    });
    userId = profile?.id ?? authUserId;
    // ensure profile exists
    const ensured = await getUserByNormalizedEmail(email);
    if (!ensured || ensured.accountKind !== "customer") {
      if (!profile) {
        await insertCustomerProfile({
          id: authUserId,
          email,
          fullName: guest.fullName,
          phone: guest.phone,
          status: "invited",
          createdBy: input.actorUserId,
        });
      }
    }
    mode = "invited";
  }

  const legalName =
    input.companyLegalName?.trim() ||
    guest.companyName?.trim() ||
    guest.fullName?.trim() ||
    email;

  // Prefer existing company membership; otherwise create a one-person company.
  const { listCompaniesForUser } = await import("./core");
  let companies = await listCompaniesForUser(userId);
  let companyId = companies[0]?.id ?? null;
  if (!companyId) {
    const company = await createCompany({
      legalName,
      displayName: guest.companyName || guest.fullName || null,
      email,
      phone: guest.phone,
      status: "active",
      companyType: "product_customer",
    });
    companyId = company.id;
    await addCompanyMember({ companyId, userId, role: "owner" });
  }

  const ordersLinked = await linkOrdersToCustomer({
    guestPurchaserId: guest.id,
    customerUserId: userId,
    companyId,
  });

  await markGuestConverted({
    guestId: guest.id,
    userId,
    companyId,
  });

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: mode === "invited" ? "guest.conversion_invited" : "guest.linked_existing",
    targetType: "guest_purchaser",
    targetId: guest.id,
    after: {
      userId,
      companyId,
      ordersLinked,
      email,
      mode,
    },
  });

  return { ok: true, mode, userId, companyId, ordersLinked };
}

/** Invite a new registered customer (no prior guest). Uses Auth invite — no password. */
export async function inviteRegisteredCustomer(input: {
  email: string;
  fullName?: string | null;
  phone?: string | null;
  companyLegalName: string;
  actorUserId: string;
}): Promise<ConvertGuestResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "E-mailadres is verplicht.", code: "validation" };

  const existing = await getUserByNormalizedEmail(email);
  if (existing?.accountKind === "staff") {
    return { ok: false, error: "E-mailadres is al in gebruik door een medewerker.", code: "collision_staff" };
  }
  if (existing?.accountKind === "customer") {
    return {
      ok: true,
      mode: "linked_existing",
      userId: existing.id,
      companyId: null,
      ordersLinked: 0,
    };
  }

  // Ensure guest row is not required — create Auth + profile + company directly.
  const supabase = createSupabaseServiceClient();
  let authUserId = await findAuthUserIdByEmail(email);
  if (!authUserId) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirectUrl(),
      data: { account_kind: "customer", full_name: input.fullName ?? undefined },
    });
    if (error) {
      authUserId = await findAuthUserIdByEmail(email);
      if (!authUserId) {
        return { ok: false, error: error.message || "Uitnodiging mislukt.", code: "config" };
      }
    } else {
      authUserId = data.user?.id ?? (await findAuthUserIdByEmail(email));
    }
  }
  if (!authUserId) return { ok: false, error: "Auth-gebruiker ontbreekt.", code: "config" };

  await insertCustomerProfile({
    id: authUserId,
    email,
    fullName: input.fullName,
    phone: input.phone,
    status: "invited",
    createdBy: input.actorUserId,
  }).catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    if (!/duplicate|unique/i.test(message)) throw err;
  });

  const company = await createCompany({
    legalName: input.companyLegalName.trim(),
    email,
    phone: input.phone,
    status: "active",
  });
  await addCompanyMember({ companyId: company.id, userId: authUserId, role: "owner" });

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "customer.invited",
    targetType: "user",
    targetId: authUserId,
    after: { email, companyId: company.id },
  });

  return {
    ok: true,
    mode: "invited",
    userId: authUserId,
    companyId: company.id,
    ordersLinked: 0,
  };
}

export function assertAdminActor(userId: string | null | undefined): asserts userId is string {
  if (!userId) throw new AdminAuthError("Niet geautoriseerd.");
}

// Re-export ensure for fixtures
export { ensureGuestPurchaser };
