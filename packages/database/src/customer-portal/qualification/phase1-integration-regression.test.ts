/**
 * Phase 1 commerce runtime regression against the qualification DB
 * *after* Phase 2 migrations are applied.
 *
 * Proves Phase 1 Customers / guest / order / money / status operations still
 * work on the post–Phase-2 schema — without adding Phase 2 portal features.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  createOrder,
  ensureGuestPurchaser,
  getCompanyById,
  getCustomerById,
  getGuestById,
  listGuestPurchasers,
  listOrderItems,
  listOrdersForCustomer,
  listOrdersForGuest,
  listRegisteredCustomers,
  setCustomerBlocked,
  updateCompany,
  updateCustomerProfile,
} from "../../commerce/core";
import { convertGuestPurchaser } from "../../commerce/conversion";
import {
  exportCustomersCsv,
  importCustomersPreview,
} from "../../commerce/import-export";
import { createSupabaseServiceClient } from "../../supabase";
import { applyQualificationEnv, isQualificationDbReachable } from "./env";
import { seedQualificationCompanies, type QualificationCompanies } from "./seed";

const qualAvailable = await isQualificationDbReachable();

describe.skipIf(!qualAvailable)("Phase 1 commerce integration regression (qual DB)", () => {
  let fixture: QualificationCompanies;
  let guestId: string;
  let guestOrderId: string;
  let customerOrderId: string;

  beforeAll(async () => {
    const config = applyQualificationEnv();
    fixture = await seedQualificationCompanies(config);

    const guest = await ensureGuestPurchaser({
      email: `guest-p1-reg-${fixture.suffix}@qual.mccoy.test`,
      fullName: "Phase1 Guest",
      companyName: "Guest Co",
      phone: "+31600009999",
    });
    guestId = guest.id;

    const guestOrder = await createOrder({
      guestPurchaserId: guest.id,
      purchaserEmail: guest.emailDisplay,
      purchaserName: guest.fullName,
      purchaserCompanyName: guest.companyName,
      currency: "EUR",
      subtotalMinor: 10000,
      taxMinor: 2100,
      totalMinor: 12100,
      orderStatus: "completed",
      paymentStatus: "paid",
      fulfilmentStatus: "fulfilled",
      source: "storefront",
      lines: [
        {
          name: "P1 Regression Guest Line",
          sku: "P1-GUEST-1",
          quantity: 1,
          unitPriceMinor: 10000,
          taxMinor: 2100,
          lineTotalMinor: 12100,
        },
      ],
    });
    guestOrderId = guestOrder.id;

    const customerOrder = await createOrder({
      companyId: fixture.companyAId,
      customerUserId: fixture.adminA.userId,
      purchaserEmail: fixture.adminA.email,
      purchaserName: "Admin A",
      currency: "EUR",
      subtotalMinor: 5000,
      taxMinor: 1050,
      totalMinor: 6050,
      orderStatus: "confirmed",
      paymentStatus: "paid",
      fulfilmentStatus: "unfulfilled",
      source: "storefront",
      lines: [
        {
          name: "P1 Regression Customer Line",
          sku: "P1-CUST-1",
          quantity: 2,
          unitPriceMinor: 2500,
          taxMinor: 1050,
          lineTotalMinor: 6050,
        },
      ],
    });
    customerOrderId = customerOrder.id;

    const supabase = createSupabaseServiceClient();
    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: customerOrderId,
      provider: "mollie",
      provider_payment_id: `qual-pay-${fixture.suffix}`,
      status: "paid",
      amount_minor: 6050,
      currency: "EUR",
    });
    if (paymentError) {
      throw new Error(`payments insert failed: ${paymentError.message}`);
    }
  }, 180_000);

  it("lists registered customers and loads registered detail", async () => {
    const listed = await listRegisteredCustomers({ page: 1, pageSize: 25 });
    expect(listed.items.length).toBeGreaterThan(0);
    expect(listed.total).toBeGreaterThan(0);

    const match = listed.items.find((i) => i.id === fixture.adminA.userId);
    expect(match?.email.toLowerCase()).toBe(fixture.adminA.email.toLowerCase());

    const detail = await getCustomerById(fixture.adminA.userId);
    expect(detail).not.toBeNull();
    expect(detail!.email.toLowerCase()).toBe(fixture.adminA.email.toLowerCase());
    expect(detail!.status).toBe("active");

    const company = await getCompanyById(fixture.companyAId);
    expect(company).not.toBeNull();
    expect(company!.legalName).toContain("Qual Company A");
  });

  it("lists guest purchasers and loads guest detail", async () => {
    const listed = await listGuestPurchasers({ page: 1, pageSize: 25 });
    expect(listed.items.some((g) => g.id === guestId)).toBe(true);

    const detail = await getGuestById(guestId);
    expect(detail).not.toBeNull();
    expect(detail!.emailNormalized).toContain("guest-p1-reg-");
    expect(detail!.fullName).toBe("Phase1 Guest");
  });

  it("updates customer profile and company fields", async () => {
    const updatedProfile = await updateCustomerProfile(fixture.userA.userId, {
      fullName: `User A Updated ${fixture.suffix}`,
      phone: "+31611112222",
    });
    expect(updatedProfile.fullName).toContain("Updated");
    expect(updatedProfile.phone).toBe("+31611112222");

    const updatedCompany = await updateCompany(fixture.companyBId, {
      displayName: `Company B Display ${fixture.suffix}`,
      notes: "phase1-regression",
    });
    expect(updatedCompany.displayName).toContain("Display");
    expect(updatedCompany.notes).toBe("phase1-regression");
  });

  it("blocks and unblocks a customer user", async () => {
    const blocked = await setCustomerBlocked(fixture.userB.userId, true);
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockedAt).toBeTruthy();

    const active = await setCustomerBlocked(fixture.userB.userId, false);
    expect(active.status).toBe("active");
    expect(active.blockedAt).toBeNull();
  });

  it("blocks and unblocks a company", async () => {
    const blocked = await updateCompany(fixture.companyBId, { status: "blocked" });
    expect(blocked.status).toBe("blocked");
    expect(blocked.blockedAt).toBeTruthy();

    const active = await updateCompany(fixture.companyBId, { status: "active" });
    expect(active.status).toBe("active");
  });

  it("converts guest → registered (invite or link) without inventing money", async () => {
    const result = await convertGuestPurchaser({
      guestId,
      actorUserId: fixture.staffActorId,
      companyLegalName: `Converted Guest Co ${fixture.suffix}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(["invited", "linked_existing", "already_converted"]).toContain(result.mode);
    expect(result.userId).toBeTruthy();

    const guestAfter = await getGuestById(guestId);
    expect(guestAfter?.convertedUserId).toBeTruthy();
  });

  it("exports registered and guest CSV and previews import", async () => {
    const registeredCsv = await exportCustomersCsv({ population: "registered" });
    expect(registeredCsv).toContain("email");
    expect(registeredCsv.toLowerCase()).toContain("@");

    const guestCsv = await exportCustomersCsv({ population: "guests" });
    expect(guestCsv).toContain("conversion_status");

    const preview = importCustomersPreview(
      [
        "email,full_name,phone,company_legal_name",
        `import-p1-${fixture.suffix}@qual.mccoy.test,Import User,+31600000000,Import Co ${fixture.suffix}`,
      ].join("\n"),
    );
    expect(preview.validCount).toBeGreaterThanOrEqual(1);
    expect(preview.errorCount).toBe(0);
  });

  it("retrieves orders/order_items with integer minor units and separate statuses", async () => {
    const customerOrders = await listOrdersForCustomer(fixture.adminA.userId);
    const customerOrder = customerOrders.find((o) => o.id === customerOrderId);
    expect(customerOrder).toBeTruthy();
    expect(Number.isInteger(customerOrder!.totalMinor)).toBe(true);
    expect(customerOrder!.totalMinor).toBe(6050);
    expect(customerOrder!.orderStatus).toBe("confirmed");
    expect(customerOrder!.paymentStatus).toBe("paid");
    expect(customerOrder!.fulfilmentStatus).toBe("unfulfilled");
    // Statuses remain independent fields (not a single overloaded status).
    expect(customerOrder!.orderStatus).not.toBe(customerOrder!.paymentStatus);

    const lines = await listOrderItems(customerOrderId);
    expect(lines.length).toBeGreaterThan(0);
    expect(Number.isInteger(lines[0]!.unitPriceMinor)).toBe(true);
    expect(Number.isInteger(lines[0]!.lineTotalMinor)).toBe(true);
    expect(lines[0]!.unitPriceMinor).toBe(2500);

    const guestOrders = await listOrdersForGuest(guestId);
    const guestOrder = guestOrders.find((o) => o.id === guestOrderId);
    expect(guestOrder).toBeTruthy();
    expect(Number.isInteger(guestOrder!.totalMinor)).toBe(true);
    expect(guestOrder!.paymentStatus).toBe("paid");
    expect(guestOrder!.fulfilmentStatus).toBe("fulfilled");
  });

  it("retrieves payment rows linked to orders (minor units)", async () => {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("payments")
      .select("id, order_id, status, amount_minor, currency, provider")
      .eq("order_id", customerOrderId);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    const payment = data![0]!;
    expect(Number.isInteger(payment.amount_minor)).toBe(true);
    expect(payment.amount_minor).toBe(6050);
    expect(payment.currency).toBe("EUR");
    expect(payment.status).toBe("paid");
  });
});
