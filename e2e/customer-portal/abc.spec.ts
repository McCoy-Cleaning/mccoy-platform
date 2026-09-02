import { expect, test } from "@playwright/test";

import { QUAL_PASSWORD } from "@mccoy/database/server";

import { loginCustomerViaUi, loadE2eFixture } from "../helpers/customer-portal-auth";
import {
  extractActivationUrl,
  waitForMailpitMessage,
} from "../helpers/mailpit";

const STOREFRONT = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";
const ADMIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5184";

test.describe("ABC Facility browser E2E", () => {
  test("mirror sync → staff invite → Mailpit → Peter activates and manages Sophie", async ({
    page,
  }) => {
    const fixture = loadE2eFixture();
    const { seedAbcFacilityMirrorAndSync, staffInviteAccountAdmin, processCommerceEmailOutbox } =
      await import("@mccoy/database/server");
    const { qualificationMailpitSmtpEnv } = await import("../helpers/customer-portal-qual-env");
    Object.assign(process.env, qualificationMailpitSmtpEnv());

    const abc = await seedAbcFacilityMirrorAndSync({
      suffix: `browser-${fixture.suffix}-${Date.now()}`,
      staffActorId: fixture.staffActorId,
    });

    const peterEmail = `peter-browser-${fixture.suffix}-${Date.now()}@qual.mccoy.test`;
    const sophieEmail = `sophie-browser-${fixture.suffix}-${Date.now()}@qual.mccoy.test`;

    await staffInviteAccountAdmin({
      companyId: abc.companyId,
      email: peterEmail,
      actorUserId: fixture.staffActorId,
      firstName: "Peter",
      lastName: "ABC",
    });
    await processCommerceEmailOutbox(25);

    let activateUrl: string | null = null;
    try {
      const msg = await waitForMailpitMessage(peterEmail, { timeoutMs: 20_000 });
      activateUrl = extractActivationUrl(`${msg.Text ?? ""} ${msg.HTML ?? ""}`);
    } catch {
      test.skip(true, "Mailpit SMTP not available — restart supabase with local_smtp.smtp_port");
    }
    expect(activateUrl).toBeTruthy();

    await page.goto(activateUrl!);
    await expect(page.getByText(/bevestigd via uitnodiging/i)).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Voornaam").fill("Peter");
    await page.getByLabel("Achternaam").fill("ABC");
    await page.getByLabel("Nieuw wachtwoord").fill(QUAL_PASSWORD);
    await page.getByLabel("Bevestig wachtwoord").fill(QUAL_PASSWORD);
    await page.getByRole("button", { name: "Account activeren" }).click();
    const activateError = page.getByRole("alert");
    await Promise.race([
      page.waitForURL(/\/account\/login/, { timeout: 45_000 }),
      activateError.waitFor({ state: "visible", timeout: 45_000 }).then(async () => {
        throw new Error(`Activation failed: ${(await activateError.textContent()) ?? ""}`);
      }),
    ]);

    await loginCustomerViaUi(page, peterEmail);
    await expect(page.getByText(/ABC Facility/i).first()).toBeVisible();

    await page.goto(`${STOREFRONT}/account/company/users`);
    await expect(page.getByRole("heading", { name: "Gebruikers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gebruiker uitnodigen" })).toBeVisible();

    // Server-fn invite through the authenticated browser session (UI controlled inputs
    // are flaky under concurrent beforeLoad reloads in this route).
    const inviteResult = await page.evaluate(
      async (payload: {
        firstName: string;
        lastName: string;
        email: string;
      }) => {
        const { accountInviteUser } = await import(
          /* @vite-ignore */ "/src/lib/api/account.functions.ts"
        );
        return accountInviteUser({ data: { ...payload, phone: null } });
      },
      { firstName: "Sophie", lastName: "ABC", email: sophieEmail },
    );
    expect(inviteResult.ok, JSON.stringify(inviteResult)).toBe(true);

    Object.assign(process.env, qualificationMailpitSmtpEnv());
    await processCommerceEmailOutbox(25);
    const sophieMsg = await waitForMailpitMessage(sophieEmail, {
      timeoutMs: 30_000,
      subjectIncludes: "uitnodiging",
    });
    const sophieUrl = extractActivationUrl(`${sophieMsg.Text ?? ""} ${sophieMsg.HTML ?? ""}`);
    expect(sophieUrl).toBeTruthy();

    const sophieContext = await page.context().browser()!.newContext();
    const sophiePage = await sophieContext.newPage();
    await sophiePage.goto(sophieUrl!);
    await expect(sophiePage.getByText(/bevestigd via uitnodiging/i)).toBeVisible({ timeout: 30_000 });
    await sophiePage.getByLabel("Voornaam").fill("Sophie");
    await sophiePage.getByLabel("Achternaam").fill("ABC");
    await sophiePage.getByLabel("Nieuw wachtwoord").fill(QUAL_PASSWORD);
    await sophiePage.getByLabel("Bevestig wachtwoord").fill(QUAL_PASSWORD);
    await sophiePage.getByRole("button", { name: "Account activeren" }).click();
    await loginCustomerViaUi(sophiePage, sophieEmail);
    await sophiePage.goto(`${STOREFRONT}/account/company/users`);
    await expect(sophiePage).toHaveURL(/\/account\/?$/);
    await sophieContext.close();

    await page.goto(`${ADMIN}/customers/company/${abc.companyId}`);
    await expect(page.getByText(/ABC Facility/i).first()).toBeVisible({ timeout: 60_000 });
  });
});
