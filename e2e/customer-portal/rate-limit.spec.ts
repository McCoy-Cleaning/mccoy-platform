import { expect, test } from "@playwright/test";

import { CUSTOMER_INVITE_RATE, CUSTOMER_LOGIN_RATE } from "@mccoy/security";

import { loadE2eFixture, loginCustomerViaUi } from "../helpers/customer-portal-auth";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";

test.describe("Customer portal rate limits (running app)", () => {
  test("login rate limit eventually blocks brute force", async ({ page }) => {
    const fixture = loadE2eFixture();
    const email = `rate-login-${fixture.suffix}@qual.mccoy.test`;
    await page.goto(`${STOREFRONT}/account/login`);
    await expect(page.getByRole("heading", { name: /inloggen/i })).toBeVisible();

    let lastError = "";
    for (let i = 0; i < CUSTOMER_LOGIN_RATE.maxAttempts + 2; i++) {
      const result = await page.evaluate(
        async (payload: { email: string; clientKey: string }) => {
          const { accountLogin } = await import(
            /* @vite-ignore */ "/src/lib/api/account.functions.ts"
          );
          return accountLogin({
            data: {
              email: payload.email,
              password: "wrong-password-qual",
              clientKey: payload.clientKey,
            },
          });
        },
        { email, clientKey: email },
      );
      expect(result.ok).toBe(false);
      lastError = result.error ?? "";
    }

    expect(lastError).toMatch(/te veel inlogpogingen/i);
  });

  test("forgot-password returns generic message under repeated requests", async ({ page }) => {
    const fixture = loadE2eFixture();
    const email = `rate-forgot-${fixture.suffix}@qual.mccoy.test`;
    await page.goto(`${STOREFRONT}/account/forgot-password`);
    await expect(page.getByRole("heading", { name: /wachtwoord vergeten/i })).toBeVisible();

    let lastMessage = "";
    for (let i = 0; i < 8; i++) {
      const result = await page.evaluate(
        async (payload: { email: string; clientKey: string }) => {
          const { accountForgotPassword } = await import(
            /* @vite-ignore */ "/src/lib/api/account.functions.ts"
          );
          return accountForgotPassword({
            data: { email: payload.email, clientKey: payload.clientKey },
          });
        },
        { email, clientKey: email },
      );
      expect(result.ok).toBe(true);
      lastMessage = result.message ?? "";
    }
    expect(lastMessage).toMatch(/als er een account/i);
    expect(lastMessage).not.toMatch(/service_role|exists|gevonden voor/i);
  });

  test("account admin invite rate limit prevents mass-email relay", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginCustomerViaUi(page, fixture.adminA.email);
    await page.goto(`${STOREFRONT}/account/company/users`);
    await expect(page.getByRole("heading", { name: "Gebruikers" })).toBeVisible();

    let limited = false;
    for (let i = 0; i < CUSTOMER_INVITE_RATE.maxAttempts + 3; i++) {
      const result = await page.evaluate(
        async (payload: { index: number; suffix: string }) => {
          const { accountInviteUser } = await import(
            /* @vite-ignore */ "/src/lib/api/account.functions.ts"
          );
          return accountInviteUser({
            data: {
              firstName: "Rate",
              lastName: `User${payload.index}`,
              email: `rate-invite-${payload.suffix}-${payload.index}@qual.mccoy.test`,
              phone: null,
            },
          });
        },
        { index: i, suffix: fixture.suffix },
      );
      if (!result.ok && /te veel uitnodigingen|CUSTOMER_INVITE_RATE_LIMITED/i.test(
        `${result.error ?? ""} ${result.code ?? ""}`,
      )) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
    await context.close();
  });
});
