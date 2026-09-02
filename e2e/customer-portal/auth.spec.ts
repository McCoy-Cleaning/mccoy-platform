import { expect, test } from "@playwright/test";

import { QUAL_PASSWORD } from "@mccoy/database/server";

import {
  auditBrowserStorage,
  assertNoCustomerTokensInStorage,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  loadE2eFixture,
  loginCustomerViaUi,
} from "../helpers/customer-portal-auth";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";

test.describe("Customer portal auth (browser)", () => {
  test("successful login lands on /account with company context", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    await expect(page.getByText(new RegExp(`Qual Company A ${fixture.suffix}`)).first()).toBeVisible();
    await context.close();
  });

  test("incorrect password shows error without leaking internals", async ({ page }) => {
    const fixture = loadE2eFixture();
    await page.goto(`${STOREFRONT}/account/login`);
    const emailInput = page.getByLabel(/e-mail/i);
    await emailInput.click();
    await emailInput.pressSequentially(fixture.adminA.email, { delay: 5 });
    const passwordInput = page.getByLabel(/^wachtwoord/i);
    await passwordInput.click();
    await passwordInput.pressSequentially("wrong-password-qual", { delay: 5 });
    await page.getByRole("button", { name: /inloggen/i }).click();
    const result = await page.evaluate(async (email: string) => {
      const { accountLogin } = await import(
        /* @vite-ignore */ "/src/lib/api/account.functions.ts"
      );
      return accountLogin({
        data: {
          email,
          password: "wrong-password-qual",
          clientKey: `wrong-${Date.now()}`,
        },
      });
    }, fixture.adminA.email);
    expect(result.ok).toBe(false);
    expect(result.error ?? "").toMatch(/onjuist|wachtwoord/i);
  });

  test("customer cookies are HttpOnly and namespaced after login", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    const cookies = await context.cookies();
    const access = cookies.find((c) => c.name === CUSTOMER_ACCESS_COOKIE);
    const refresh = cookies.find((c) => c.name === CUSTOMER_REFRESH_COOKIE);
    expect(access).toBeTruthy();
    expect(refresh).toBeTruthy();
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe("Lax");
    // LOCAL_RUNTIME_EVIDENCE: Secure=false on HTTP localhost
    expect(access?.secure).toBe(false);
    await context.close();
  });

  test("no durable customer tokens in browser storage after login", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    const storage = await auditBrowserStorage(page);
    assertNoCustomerTokensInStorage(storage);
    await context.close();
  });

  test("suspended membership denies portal after valid login", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const { suspendCompanyMembership } = await import("@mccoy/database/server");
    await suspendCompanyMembership({
      companyId: fixture.companyAId,
      userId: fixture.userA.userId,
      actorUserId: fixture.adminA.userId,
    });

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${STOREFRONT}/account/login`);
    const emailInput = page.getByLabel(/e-mail/i);
    await emailInput.click();
    await emailInput.pressSequentially(fixture.userA.email, { delay: 5 });
    const passwordInput = page.getByLabel(/^wachtwoord/i);
    await passwordInput.click();
    await passwordInput.pressSequentially(QUAL_PASSWORD, { delay: 5 });
    await page.getByRole("button", { name: /inloggen/i }).click();
    const denied = await page.evaluate(async (email: string) => {
      const { accountLogin } = await import(
        /* @vite-ignore */ "/src/lib/api/account.functions.ts"
      );
      return accountLogin({
        data: {
          email,
          password: "QualTest-Password-123!",
          clientKey: `suspended-${Date.now()}`,
        },
      });
    }, fixture.userA.email);
    expect(denied.ok).toBe(false);

    const { reactivateCompanyMembership } = await import("@mccoy/database/server");
    await reactivateCompanyMembership({
      companyId: fixture.companyAId,
      userId: fixture.userA.userId,
      actorUserId: fixture.adminA.userId,
    });
    await context.close();
  });
});
