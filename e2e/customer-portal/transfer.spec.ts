import { expect, test } from "@playwright/test";

import { loginCustomerViaUi, loadE2eFixture } from "../helpers/customer-portal-auth";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";
const ADMIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5184";

test.describe("Account Admin transfer (staff browser)", () => {
  test("staff transfers admin to account user; roles swap in portal", async ({ page }) => {
    const fixture = loadE2eFixture();

    // Prior specs may leave userA suspended — transfer UI requires an active account_user.
    const { reactivateCompanyMembership, createSupabaseServiceClient } = await import(
      "@mccoy/database/server"
    );
    await createSupabaseServiceClient()
      .from("company_users")
      .update({ status: "active" })
      .eq("company_id", fixture.companyAId)
      .in("user_id", [fixture.adminA.userId, fixture.userA.userId]);
    await reactivateCompanyMembership({
      companyId: fixture.companyAId,
      userId: fixture.userA.userId,
      actorUserId: fixture.adminA.userId,
    }).catch(() => undefined);

    await page.goto(`${ADMIN}/customers/company/${fixture.companyAId}`);
    await expect(page).toHaveURL(/\/customers\/company\/[^/]+/, { timeout: 60_000 });
    await expect(page.getByText(fixture.adminA.email, { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(fixture.userA.email, { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });

    const transferButton = page.getByRole("button", { name: "Beheer overdragen" });
    await transferButton.scrollIntoViewIfNeeded();
    await expect(transferButton).toBeVisible({ timeout: 30_000 });
    await transferButton.click();

    await page.locator("select").selectOption(fixture.userA.userId);
    await page.getByRole("button", { name: /^overdragen$/i }).click();
    await expect(page.getByText(/overgedragen/i)).toBeVisible({ timeout: 20_000 });

    const peterContext = await page.context().browser()!.newContext();
    const peterPage = await peterContext.newPage();
    await loginCustomerViaUi(peterPage, fixture.adminA.email);
    await peterPage.goto(`${STOREFRONT}/account/company/users`);
    await expect(peterPage).toHaveURL(/\/account\/?$/);

    const sophiePage = await peterContext.browser()!.newPage();
    await loginCustomerViaUi(sophiePage, fixture.userA.email);
    await sophiePage.goto(`${STOREFRONT}/account/company/users`);
    await expect(sophiePage.getByRole("heading", { name: "Gebruikers" })).toBeVisible({
      timeout: 15_000,
    });

    const { transferAccountAdmin } = await import("@mccoy/database/server");
    await transferAccountAdmin({
      companyId: fixture.companyAId,
      newUserId: fixture.adminA.userId,
      actorUserId: fixture.staffActorId,
    });

    await peterContext.close();
  });
});
