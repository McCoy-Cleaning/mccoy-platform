/**
 * Deterministic non-production commerce fixtures for Customers module verification.
 * Gated: never runs when VERCEL_ENV=production or NODE_ENV=production unless
 * COMMERCE_FIXTURES_FORCE=true (explicit operator override).
 */

import { normalizeEmail } from "@mccoy/domain";

import {
  addCompanyMember,
  createCompany,
  createOrder,
  ensureGuestPurchaser,
  insertCustomerProfile,
  setCustomerBlocked,
  writeStaffAudit,
} from "./core";
import { createSupabaseServiceClient } from "../supabase";
import { findAuthUserIdByEmail } from "../staff";

const FIXTURE_MARKER = "mccoy-commerce-fixture";

export function commerceFixturesAllowed(): boolean {
  if (process.env.COMMERCE_FIXTURES_FORCE === "true") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

async function ensureFixtureAuthUser(email: string, fullName: string): Promise<string> {
  const supabase = createSupabaseServiceClient();
  const existing = await findAuthUserIdByEmail(email);
  if (existing) return existing;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { account_kind: "customer", [FIXTURE_MARKER]: true, full_name: fullName },
  });
  if (error || !data.user?.id) {
    const raced = await findAuthUserIdByEmail(email);
    if (raced) return raced;
    throw new Error(error?.message || "fixture auth create failed");
  }
  return data.user.id;
}

async function ensureCustomer(
  email: string,
  fullName: string,
  phone: string | null,
  actorUserId: string | null,
): Promise<string> {
  const id = await ensureFixtureAuthUser(email, fullName);
  const supabase = createSupabaseServiceClient();
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    await insertCustomerProfile({
      id,
      email,
      fullName,
      phone,
      status: "active",
      createdBy: actorUserId,
    });
  }
  return id;
}

/**
 * Seeds the required fixture matrix. Idempotent by fixture emails.
 */
export async function seedCommerceFixtures(actorUserId: string | null): Promise<{
  ok: true;
  emails: string[];
}> {
  if (!commerceFixturesAllowed()) {
    throw new Error("Commerce fixtures are disabled in production.");
  }

  const emails: string[] = [];

  // Registered individual (one-person company) with multiple paid orders
  const aEmail = "fixture.customer.a@example.mccoy.test";
  const aId = await ensureCustomer(aEmail, "Fixture Customer A", "+31600000001", actorUserId);
  emails.push(aEmail);
  let aCompany = await createCompany({
    legalName: "Fixture Company A BV",
    displayName: "Fixture A",
    email: aEmail,
    status: "active",
    kvkNumber: "11111111",
  }).catch(async () => {
    // kvk unique — fetch via membership
    const { listCompaniesForUser } = await import("./core");
    const existing = await listCompaniesForUser(aId);
    if (existing[0]) return existing[0];
    return createCompany({
      legalName: "Fixture Company A BV",
      displayName: "Fixture A",
      email: aEmail,
      status: "active",
    });
  });
  await addCompanyMember({ companyId: aCompany.id, userId: aId, role: "owner" });
  for (const [i, subtotal, tax, total] of [
    [1, 10000, 2100, 12100],
    [2, 20000, 4200, 24200],
  ] as const) {
    await createOrder({
      number: `ORD-FIX-A-${i}`,
      companyId: aCompany.id,
      customerUserId: aId,
      purchaserEmail: aEmail,
      purchaserName: "Fixture Customer A",
      currency: "EUR",
      subtotalMinor: subtotal,
      taxMinor: tax,
      totalMinor: total,
      orderStatus: "confirmed",
      paymentStatus: "paid",
      fulfilmentStatus: "fulfilled",
      source: "fixture",
      lines: [
        {
          sku: `FIX-A-${i}`,
          name: `Fixture product A${i}`,
          quantity: 1,
          unitPriceMinor: subtotal,
          taxMinor: tax,
          lineTotalMinor: total,
        },
      ],
    }).catch(() => {
      /* number unique — already seeded */
    });
  }

  // Registered company with one user, minimal history
  const bEmail = "fixture.customer.b@example.mccoy.test";
  const bId = await ensureCustomer(bEmail, "Fixture Customer B", null, actorUserId);
  emails.push(bEmail);
  const bCompany = await createCompany({
    legalName: "Fixture Company B BV",
    email: bEmail,
    status: "active",
    kvkNumber: "22222222",
  }).catch(async () => {
    const { listCompaniesForUser } = await import("./core");
    const existing = await listCompaniesForUser(bId);
    return existing[0] ?? createCompany({ legalName: "Fixture Company B BV", email: bEmail, status: "active" });
  });
  await addCompanyMember({ companyId: bCompany.id, userId: bId, role: "owner" });

  // Company with multiple users
  const c1 = "fixture.multi.owner@example.mccoy.test";
  const c2 = "fixture.multi.member@example.mccoy.test";
  const c1Id = await ensureCustomer(c1, "Fixture Multi Owner", null, actorUserId);
  const c2Id = await ensureCustomer(c2, "Fixture Multi Member", null, actorUserId);
  emails.push(c1, c2);
  const multiCompany = await createCompany({
    legalName: "Fixture Multi User BV",
    email: c1,
    status: "active",
    kvkNumber: "33333333",
  }).catch(async () => {
    const { listCompaniesForUser } = await import("./core");
    const existing = await listCompaniesForUser(c1Id);
    return existing[0] ?? createCompany({ legalName: "Fixture Multi User BV", email: c1, status: "active" });
  });
  await addCompanyMember({ companyId: multiCompany.id, userId: c1Id, role: "owner" });
  await addCompanyMember({ companyId: multiCompany.id, userId: c2Id, role: "member" });

  // Guest with multiple paid orders
  const gA = "fixture.guest.a@example.mccoy.test";
  const guestA = await ensureGuestPurchaser({
    email: gA,
    fullName: "Fixture Guest A",
    companyName: "Guest Co A",
    phone: "+31600000010",
  });
  emails.push(gA);
  for (const [i, subtotal, tax, total] of [
    [1, 4132, 868, 5000],
    [2, 6198, 1302, 7500],
    [3, 10331, 2169, 12500],
  ] as const) {
    await createOrder({
      number: `ORD-FIX-GA-${i}`,
      guestPurchaserId: guestA.id,
      purchaserEmail: gA,
      purchaserName: "Fixture Guest A",
      purchaserCompanyName: "Guest Co A",
      currency: "EUR",
      subtotalMinor: subtotal,
      taxMinor: tax,
      totalMinor: total,
      orderStatus: "confirmed",
      paymentStatus: "paid",
      source: "fixture",
      lines: [
        {
          sku: `FIX-GA-${i}`,
          name: `Guest A item ${i}`,
          quantity: 1,
          unitPriceMinor: subtotal,
          taxMinor: tax,
          lineTotalMinor: total,
        },
      ],
    }).catch(() => undefined);
  }

  // Guest with one unpaid order
  const gB = "fixture.guest.b@example.mccoy.test";
  const guestB = await ensureGuestPurchaser({
    email: gB,
    fullName: "Fixture Guest B",
  });
  emails.push(gB);
  await createOrder({
    number: "ORD-FIX-GB-1",
    guestPurchaserId: guestB.id,
    purchaserEmail: gB,
    purchaserName: "Fixture Guest B",
    currency: "EUR",
    subtotalMinor: 10000,
    taxMinor: 2100,
    totalMinor: 12100,
    orderStatus: "pending",
    paymentStatus: "unpaid",
    source: "fixture",
    lines: [
      {
        sku: "FIX-GB-1",
        name: "Guest B unpaid item",
        quantity: 1,
        unitPriceMinor: 10000,
        taxMinor: 2100,
        lineTotalMinor: 12100,
      },
    ],
  }).catch(() => undefined);

  // Collision: registered customer email matches a separate guest identity
  const collEmail = "fixture.collision@example.mccoy.test";
  const collUserId = await ensureCustomer(collEmail, "Fixture Collision User", null, actorUserId);
  emails.push(collEmail);
  const collCompany = await createCompany({
    legalName: "Fixture Collision BV",
    email: collEmail,
    status: "active",
    kvkNumber: "44444444",
  }).catch(async () => {
    const { listCompaniesForUser } = await import("./core");
    const existing = await listCompaniesForUser(collUserId);
    return existing[0] ?? createCompany({ legalName: "Fixture Collision BV", email: collEmail, status: "active" });
  });
  await addCompanyMember({ companyId: collCompany.id, userId: collUserId, role: "owner" });
  const collGuest = await ensureGuestPurchaser({
    email: collEmail,
    fullName: "Fixture Collision Guest Name",
    companyName: "Pre-registration Guest Co",
  });
  await createOrder({
    number: "ORD-FIX-COLL-1",
    guestPurchaserId: collGuest.id,
    purchaserEmail: collEmail,
    purchaserName: "Fixture Collision Guest Name",
    currency: "EUR",
    subtotalMinor: 8000,
    taxMinor: 1680,
    totalMinor: 9680,
    orderStatus: "confirmed",
    paymentStatus: "paid",
    source: "fixture",
    lines: [
      {
        sku: "FIX-COLL",
        name: "Collision guest order",
        quantity: 1,
        unitPriceMinor: 8000,
        taxMinor: 1680,
        lineTotalMinor: 9680,
      },
    ],
  }).catch(() => undefined);

  // Blocked customer
  const blockedEmail = "fixture.blocked@example.mccoy.test";
  const blockedId = await ensureCustomer(blockedEmail, "Fixture Blocked", null, actorUserId);
  emails.push(blockedEmail);
  await setCustomerBlocked(blockedId, true);

  // Cancelled paid? — cancelled unpaid order for guest B style
  const cancelEmail = "fixture.cancelled@example.mccoy.test";
  const cancelGuest = await ensureGuestPurchaser({ email: cancelEmail, fullName: "Fixture Cancelled" });
  emails.push(cancelEmail);
  await createOrder({
    number: "ORD-FIX-CANCEL-1",
    guestPurchaserId: cancelGuest.id,
    purchaserEmail: cancelEmail,
    purchaserName: "Fixture Cancelled",
    currency: "EUR",
    subtotalMinor: 5000,
    taxMinor: 1050,
    totalMinor: 6050,
    orderStatus: "cancelled",
    paymentStatus: "cancelled",
    source: "fixture",
    lines: [
      {
        sku: "FIX-CANCEL",
        name: "Cancelled item",
        quantity: 1,
        unitPriceMinor: 5000,
        taxMinor: 1050,
        lineTotalMinor: 6050,
      },
    ],
  }).catch(() => undefined);

  await writeStaffAudit({
    actorUserId,
    action: "commerce.fixtures_seeded",
    targetType: "commerce",
    targetId: null,
    after: { emails: emails.map(normalizeEmail) },
  });

  return { ok: true, emails };
}
