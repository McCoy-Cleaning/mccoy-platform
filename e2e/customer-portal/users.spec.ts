import { expect, test } from "@playwright/test";

import { QUAL_PASSWORD } from "@mccoy/database/server";

import { loginCustomerViaUi, loadE2eFixture } from "../helpers/customer-portal-auth";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";

test.describe("Account Admin vs Account User (browser)", () => {
  test("account admin can open users page and invite form", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    await page.goto(`${STOREFRONT}/account/company/users`);
    await expect(page).toHaveURL(/\/account\/company\/users/);
    await expect(page.getByRole("heading", { name: "Gebruikers" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByPlaceholder("E-mailadres")).toBeVisible();
    await context.close();
  });

  test("account user is redirected away from users management", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.userA.email);
    await page.goto(`${STOREFRONT}/account/company/users`);
    await expect(page).toHaveURL(/\/account\/?$/);
    await context.close();
  });

  test("account user invite API returns CUSTOMER_ADMIN_REQUIRED", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.userA.email);
    const result = await page.evaluate(async () => {
      const { accountInviteUser } = await import(
        /* @vite-ignore */ "/src/lib/api/account.functions.ts"
      );
      return accountInviteUser({
        data: {
          firstName: "Eve",
          lastName: "Qual",
          email: "eve-qual@qual.mccoy.test",
          phone: null,
        },
      });
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CUSTOMER_ADMIN_REQUIRED");
    await context.close();
  });

  test("account admin cannot suspend company B user via tampered userId", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    const result = await page.evaluate(async (userBId: string) => {
      const { accountSuspendUser } = await import(
        /* @vite-ignore */ "/src/lib/api/account.functions.ts"
      );
      return accountSuspendUser({ data: { userId: userBId } });
    }, fixture.userB.userId);
    expect(result.ok).toBe(false);
    await context.close();
  });
});
