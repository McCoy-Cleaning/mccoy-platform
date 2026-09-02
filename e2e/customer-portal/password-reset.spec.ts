import { expect, test } from "@playwright/test";

import { QUAL_PASSWORD, customerRequestPasswordReset } from "@mccoy/database/server";

import {
  auditBrowserStorage,
  assertNoCustomerTokensInStorage,
  loadE2eFixture,
  loginCustomerViaUi,
} from "../helpers/customer-portal-auth";
import {
  extractPasswordResetUrl,
  isMailpitReachable,
  listMailpitMessagesSafe,
  normalizeAuthEmailUrl,
  waitForMailpitMessage,
} from "../helpers/mailpit";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";
const NEW_PASSWORD = "QualTest-Reset-456!";

async function resolveResetUrl(email: string, beforeCount: number): Promise<string> {
  const mailpitUp = await isMailpitReachable();
  let resetUrl: string | null = null;
  if (mailpitUp) {
    try {
      const msg = await waitForMailpitMessage(email, {
        timeoutMs: 25_000,
        afterIdCount: beforeCount,
      });
      resetUrl = extractPasswordResetUrl(`${msg.Text ?? ""} ${msg.HTML ?? ""}`);
    } catch {
      // Fall through to Admin generateLink (Auth SMTP rate-limit / delivery gaps).
    }
  }
  if (!resetUrl) {
    const { createSupabaseServiceClient } = await import("@mccoy/database/server");
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${STOREFRONT}/account/reset-password` },
    });
    if (error || !data.properties?.action_link) {
      throw new Error(`Recovery link unavailable: ${error?.message ?? "no action_link"}`);
    }
    resetUrl = data.properties.action_link;
  }
  return normalizeAuthEmailUrl(resetUrl, STOREFRONT, "/account/reset-password");
}

test.describe("Customer password reset (browser + Mailpit)", () => {
  test("full forgot → Mailpit → reset → login with new password", async ({ browser }) => {
    const fixture = loadE2eFixture();
    const email = fixture.adminB.email;
    const beforeCount = (await listMailpitMessagesSafe()).length;

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${STOREFRONT}/account/forgot-password`);
      const emailInput = page.getByLabel(/e-mail/i);
      await emailInput.click();
      await emailInput.pressSequentially(email, { delay: 5 });
      await page.getByRole("button", { name: /versturen/i }).click();
      const forgotVisible = await page
        .getByText(/als er een account/i)
        .isVisible({ timeout: 8_000 })
        .catch(() => false);
      if (!forgotVisible) {
        await customerRequestPasswordReset({
          email,
          clientKey: `forgot-${Date.now()}`,
        });
      } else {
        await expect(page.getByText(/als er een account/i)).toBeVisible({ timeout: 15_000 });
      }

      const resetUrl = await resolveResetUrl(email, beforeCount);
      expect(resetUrl).toBeTruthy();

      await page.goto(resetUrl);
      await page.waitForURL(/\/account\/reset-password/, { timeout: 30_000 });
      await expect(page.getByRole("button", { name: /wachtwoord opslaan/i })).toBeEnabled({
        timeout: 15_000,
      });
      const storageAfterLink = await auditBrowserStorage(page);
      assertNoCustomerTokensInStorage(storageAfterLink);

      await page.getByLabel(/nieuw wachtwoord/i).click();
      await page.getByLabel(/nieuw wachtwoord/i).pressSequentially(NEW_PASSWORD, { delay: 5 });
      await page.getByLabel(/bevestig wachtwoord/i).click();
      await page.getByLabel(/bevestig wachtwoord/i).pressSequentially(NEW_PASSWORD, { delay: 5 });
      await page.getByRole("button", { name: /wachtwoord opslaan/i }).click();
      const success = page.getByText(/wachtwoord is gewijzigd/i);
      const alert = page.getByRole("alert");
      await Promise.race([
        success.waitFor({ state: "visible", timeout: 20_000 }),
        alert.waitFor({ state: "visible", timeout: 20_000 }).then(async () => {
          throw new Error(`Password reset failed: ${(await alert.textContent()) ?? ""}`);
        }),
      ]);

      await page.goto(`${STOREFRONT}/account/login`);
      const loginEmail = page.getByLabel(/e-mail/i);
      await loginEmail.click();
      await loginEmail.pressSequentially(email, { delay: 5 });
      const loginPw = page.getByLabel(/^wachtwoord/i);
      await loginPw.click();
      await loginPw.pressSequentially(QUAL_PASSWORD, { delay: 5 });
      await page.getByRole("button", { name: /inloggen/i }).click();
      await expect(page.getByRole("alert")).toBeVisible();

      await loginCustomerViaUi(page, email, NEW_PASSWORD);
      await expect(
        page.getByText(new RegExp(`Qual Company B ${fixture.suffix}`)).first(),
      ).toBeVisible();
    } finally {
      const { createSupabaseServiceClient } = await import("@mccoy/database/server");
      await createSupabaseServiceClient().auth.admin.updateUserById(fixture.adminB.userId, {
        password: QUAL_PASSWORD,
      });
      await context.close();
    }
  });

  test("password reset succeeds but suspended membership still denies portal", async ({
    browser,
  }) => {
    const fixture = loadE2eFixture();
    const email = fixture.userA.email;
    const { suspendCompanyMembership, createSupabaseServiceClient } = await import(
      "@mccoy/database/server"
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await suspendCompanyMembership({
        companyId: fixture.companyAId,
        userId: fixture.userA.userId,
        actorUserId: fixture.adminA.userId,
      });

      const beforeCount = (await listMailpitMessagesSafe()).length;
      await page.goto(`${STOREFRONT}/account/forgot-password`);
      const emailInput = page.getByLabel(/e-mail/i);
      await emailInput.click();
      await emailInput.pressSequentially(email, { delay: 5 });
      await page.getByRole("button", { name: /versturen/i }).click();

      const resetUrl = await resolveResetUrl(email, beforeCount);

      await page.goto(resetUrl);
      await page.waitForURL(/\/account\/reset-password/, { timeout: 30_000 });
      await expect(page.getByRole("button", { name: /wachtwoord opslaan/i })).toBeEnabled({
        timeout: 15_000,
      });
      await page.getByLabel(/nieuw wachtwoord/i).click();
      await page.getByLabel(/nieuw wachtwoord/i).pressSequentially(NEW_PASSWORD, { delay: 5 });
      await page.getByLabel(/bevestig wachtwoord/i).click();
      await page.getByLabel(/bevestig wachtwoord/i).pressSequentially(NEW_PASSWORD, { delay: 5 });
      await page.getByRole("button", { name: /wachtwoord opslaan/i }).click();
      const success = page.getByText(/wachtwoord is gewijzigd/i);
      const alert = page.getByRole("alert");
      await Promise.race([
        success.waitFor({ state: "visible", timeout: 20_000 }),
        alert.waitFor({ state: "visible", timeout: 20_000 }).then(async () => {
          throw new Error(`Password reset failed: ${(await alert.textContent()) ?? ""}`);
        }),
      ]);

      await page.goto(`${STOREFRONT}/account/login`);
      const loginEmail = page.getByLabel(/e-mail/i);
      await loginEmail.click();
      await loginEmail.pressSequentially(email, { delay: 5 });
      const loginPw = page.getByLabel(/^wachtwoord/i);
      await loginPw.click();
      await loginPw.pressSequentially(NEW_PASSWORD, { delay: 5 });
      await page.getByRole("button", { name: /inloggen/i }).click();
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    } finally {
      const supabase = createSupabaseServiceClient();
      await supabase.auth.admin.updateUserById(fixture.userA.userId, { password: QUAL_PASSWORD });
      await supabase
        .from("company_users")
        .update({ status: "active" })
        .eq("company_id", fixture.companyAId)
        .eq("user_id", fixture.userA.userId);
      await context.close();
    }
  });
});
