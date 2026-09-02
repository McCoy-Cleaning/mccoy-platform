import { expect, test } from "@playwright/test";

import {
  applyCustomerCookies,
  applyStaffCookies,
  CUSTOMER_ACCESS_COOKIE,
  loadE2eFixture,
  loginCustomerViaUi,
  signInCustomerTokens,
  STAFF_ACCESS_COOKIE,
  establishStaffMfaSession,
} from "../helpers/customer-portal-auth";
import {
  postAccountInviteUserCrossOrigin,
  postAccountLoginCrossOrigin,
} from "../helpers/storefront-server-fn";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";
const ADMIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5184";

test.describe("Customer portal security", () => {
  test("staff and customer cookie namespaces coexist", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const staffTokens = await establishStaffMfaSession();
    const customerTokens = await signInCustomerTokens(fixture.adminA.email);

    const context = await browser.newContext();
    await applyStaffCookies(context, ADMIN, staffTokens);
    await applyCustomerCookies(context, STOREFRONT, customerTokens);

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === STAFF_ACCESS_COOKIE)).toBe(true);
    expect(cookies.some((c) => c.name === CUSTOMER_ACCESS_COOKIE)).toBe(true);

    await context.close();
  });

  test("customer logout (accountLogout) clears customer cookie and preserves staff", async ({
    browser,
  }) => {
    const fixture = loadE2eFixture();
    const staffTokens = await establishStaffMfaSession();
    const context = await browser.newContext();
    await applyStaffCookies(context, ADMIN, staffTokens);

    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    await page.goto(`${STOREFRONT}/account`);

    await page.evaluate(async () => {
      const { accountLogout } = await import(
        /* @vite-ignore */ "/src/lib/api/account.functions.ts"
      );
      await accountLogout();
    });

    await page.goto(`${STOREFRONT}/account`);
    await expect(page).toHaveURL(/\/account\/login/, { timeout: 30_000 });

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === STAFF_ACCESS_COOKIE && c.value)).toBe(true);
    expect(cookies.some((c) => c.name === CUSTOMER_ACCESS_COOKIE && c.value)).toBeFalsy();
    await context.close();
  });

  test("Uitloggen button wires to logout and lands on login", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    await page.goto(`${STOREFRONT}/account`);
    await expect(page.getByRole("link", { name: "Uitloggen" })).toBeVisible();
    await page.getByRole("link", { name: "Uitloggen" }).click();
    await page.waitForURL(/\/account\/login/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/account\/login/);
    await context.close();
  });

  test("cross-origin mutation is denied for customer login", async () => {
    const fixture = loadE2eFixture();
    const result = await postAccountLoginCrossOrigin(STOREFRONT, {
      email: fixture.adminA.email,
      password: "wrongpassword1",
      clientKey: `e2e-cross-origin-${Date.now()}`,
    });
    expect(result.status).toBe(403);
    expect(result.denied).toBe(true);
  });

  test("cross-origin mutation is denied for authenticated customer invite", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    const cookies = await context.cookies(STOREFRONT);
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const result = await postAccountInviteUserCrossOrigin(
      STOREFRONT,
      {
        firstName: "Evil",
        lastName: "Origin",
        email: `evil-origin-${fixture.suffix}@qual.mccoy.test`,
        phone: null,
      },
      cookieHeader,
    );
    expect(result.status).toBe(403);
    expect(result.denied).toBe(true);
    await context.close();
  });

  test("account user cannot open company users management route", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const { createSupabaseServiceClient } = await import("@mccoy/database/server");
    await createSupabaseServiceClient()
      .from("company_users")
      .update({ status: "active" })
      .eq("company_id", fixture.companyAId)
      .eq("user_id", fixture.userA.userId);

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.userA.email);
    await page.goto(`${STOREFRONT}/account/company/users`);
    await expect(page).toHaveURL(/\/account\/?$/);
    await context.close();
  });

  test("suspended membership denies protected operation without reauthentication", async ({
    browser,
  }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginCustomerViaUi(page, fixture.userA.email);

      const before = await page.evaluate(async () => {
        const { getAccountDashboard } = await import(
          /* @vite-ignore */ "/src/lib/api/account.functions.ts"
        );
        return getAccountDashboard();
      });
      expect(before.ok).toBe(true);

      const { suspendCompanyMembership } = await import("@mccoy/database/server");
      await suspendCompanyMembership({
        companyId: fixture.companyAId,
        userId: fixture.userA.userId,
        actorUserId: fixture.adminA.userId,
      });

      const after = await page.evaluate(async () => {
        const { getAccountDashboard } = await import(
          /* @vite-ignore */ "/src/lib/api/account.functions.ts"
        );
        return getAccountDashboard();
      });
      expect(after.ok).toBe(false);

      // Browser: JWT still present, but portal navigation must deny access.
      await page.reload();
      await page.goto(`${STOREFRONT}/account/company`);
      await expect(page).toHaveURL(/\/account\/login/, { timeout: 30_000 });
    } finally {
      const { reactivateCompanyMembership } = await import("@mccoy/database/server");
      await reactivateCompanyMembership({
        companyId: fixture.companyAId,
        userId: fixture.userA.userId,
        actorUserId: fixture.adminA.userId,
      });
      await context.close();
    }
  });

  test("customer session cannot access staff admin UI", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const customerTokens = await signInCustomerTokens(fixture.adminA.email);
    const context = await browser.newContext();
    await applyCustomerCookies(context, ADMIN, customerTokens);
    const page = await context.newPage();
    await page.goto(`${ADMIN}/customers`);
    await expect(page.getByRole("heading", { name: "Klanten" })).not.toBeVisible({
      timeout: 10_000,
    });
    await context.close();
  });

  test("blocked company denies portal for active membership (domain)", async () => {
    const fixture = loadE2eFixture();
    const { createSupabaseServiceClient, resolveCustomerMembership } = await import(
      "@mccoy/database/server"
    );
    const supabase = createSupabaseServiceClient();

    try {
      await supabase
        .from("companies")
        .update({ status: "blocked", blocked_at: new Date().toISOString() })
        .eq("id", fixture.companyAId);

      const membership = await resolveCustomerMembership(fixture.adminA.userId);
      expect(membership).toBeNull();
    } finally {
      await supabase
        .from("companies")
        .update({ status: "active", blocked_at: null })
        .eq("id", fixture.companyAId);
    }
  });

  test("blocked company kicks active browser session out of portal", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const { createSupabaseServiceClient } = await import("@mccoy/database/server");
    const supabase = createSupabaseServiceClient();

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginCustomerViaUi(page, fixture.adminA.email);
      await page.goto(`${STOREFRONT}/account`);
      await expect(page).toHaveURL(/\/account\/?$/);

      await supabase
        .from("companies")
        .update({ status: "blocked", blocked_at: new Date().toISOString() })
        .eq("id", fixture.companyAId);

      await page.reload();
      await page.goto(`${STOREFRONT}/account/company`);
      await expect(page).toHaveURL(/\/account\/login/, { timeout: 30_000 });
    } finally {
      await supabase
        .from("companies")
        .update({ status: "active", blocked_at: null })
        .eq("id", fixture.companyAId);
      await context.close();
    }
  });
});
