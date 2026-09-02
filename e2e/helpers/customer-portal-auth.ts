import type { BrowserContext, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { QUAL_PASSWORD } from "@mccoy/database/server";
import { readCustomerPortalE2eFixtureFileSync } from "@mccoy/database/server";

import { totpCode } from "./totp";

export const CUSTOMER_ACCESS_COOKIE = "mccoy_customer_sb_access_token";
export const CUSTOMER_REFRESH_COOKIE = "mccoy_customer_sb_refresh_token";
export const STAFF_ACCESS_COOKIE = "mccoy_sb_access_token";
export const STAFF_REFRESH_COOKIE = "mccoy_sb_refresh_token";

export function loadE2eFixture() {
  return readCustomerPortalE2eFixtureFileSync() as ReturnType<
    typeof readCustomerPortalE2eFixtureFileSync
  > & { staffTotpSecret?: string };
}

export async function loginCustomerViaUi(
  page: Page,
  email: string,
  password = QUAL_PASSWORD,
): Promise<void> {
  const origin = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5183";
  await page.goto(`${origin}/account/login`);
  const emailInput = page.getByLabel(/e-mail/i);
  await emailInput.click();
  await emailInput.pressSequentially(email, { delay: 5 });
  const passwordInput = page.getByLabel(/^wachtwoord/i);
  await passwordInput.click();
  await passwordInput.pressSequentially(password, { delay: 5 });
  await page.getByRole("button", { name: /inloggen/i }).click();

  const navigated = await page
    .waitForURL(/\/account\/?$/, { timeout: 12_000 })
    .then(() => true)
    .catch(() => false);

  if (!navigated) {
    const result = await page.evaluate(
      async (payload: { email: string; password: string; clientKey: string }) => {
        const { accountLogin } = await import(
          /* @vite-ignore */ "/src/lib/api/account.functions.ts"
        );
        return accountLogin({
          data: {
            email: payload.email,
            password: payload.password,
            clientKey: payload.clientKey,
          },
        });
      },
      { email, password, clientKey: `e2e-ui-${Date.now()}` },
    );
    if (!result.ok) {
      throw new Error(result.error ?? "Customer login failed after UI submit.");
    }
    await page.goto(`${origin}/account`);
    await page.waitForURL(/\/account\/?$/);
  }
}

export async function auditBrowserStorage(page: Page): Promise<{
  localStorage: string;
  sessionStorage: string;
  indexedDbKeys: string[];
}> {
  return page.evaluate(async () => {
    const local = JSON.stringify({ ...localStorage }).toLowerCase();
    const session = JSON.stringify({ ...sessionStorage }).toLowerCase();
    const idbKeys: string[] = [];
    if (typeof indexedDB !== "undefined" && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) idbKeys.push(db.name);
      }
    }
    return { localStorage: local, sessionStorage: session, indexedDbKeys: idbKeys };
  });
}

export function assertNoCustomerTokensInStorage(snapshot: {
  localStorage: string;
  sessionStorage: string;
  indexedDbKeys: string[];
}): void {
  const blob = `${snapshot.localStorage} ${snapshot.sessionStorage} ${snapshot.indexedDbKeys.join(" ")}`;
  expectNoTokenLeak(blob);
}

export function expectNoTokenLeak(blob: string): void {
  if (/access_token|refresh_token|mccoy_customer_sb|eyJ[a-z0-9_-]{10,}/i.test(blob)) {
    throw new Error(`Customer auth material found in browser storage: ${blob.slice(0, 200)}`);
  }
}

export async function establishStaffMfaSession(): Promise<{
  accessToken: string;
  refreshToken: string;
  totpSecret: string;
}> {
  const fixture = loadE2eFixture();
  const url = process.env.SUPABASE_URL ?? process.env.QUALIFICATION_SUPABASE_URL ?? "";
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.QUALIFICATION_SUPABASE_PUBLISHABLE_KEY ?? "";
  const email = `staff-qual-${fixture.suffix}@qual.mccoy.test`;

  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error } = await client.auth.signInWithPassword({
    email,
    password: QUAL_PASSWORD,
  });
  if (error || !signIn.session) throw new Error(`staff sign-in failed: ${error?.message}`);

  const { data: factors } = await client.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f) => f.status === "verified");
  let totpSecret: string | undefined = fixture.staffTotpSecret;

  if (!verified) {
    const { data: enroll, error: enrollErr } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `e2e-${fixture.suffix}`,
    });
    if (enrollErr || !enroll?.id || !enroll.totp?.secret) {
      throw new Error(`staff mfa enroll failed: ${enrollErr?.message}`);
    }
    totpSecret = enroll.totp.secret;
    const { data: challenge, error: challengeErr } = await client.auth.mfa.challenge({
      factorId: enroll.id,
    });
    if (challengeErr || !challenge?.id) throw new Error(`mfa challenge: ${challengeErr?.message}`);
    const { error: verifyErr } = await client.auth.mfa.verify({
      factorId: enroll.id,
      challengeId: challenge.id,
      code: totpCode(totpSecret),
    });
    if (verifyErr) throw new Error(`mfa verify: ${verifyErr.message}`);
  }

  const factorId = verified?.id ?? (await client.auth.mfa.listFactors()).data?.totp?.[0]?.id;
  if (!factorId) throw new Error("no totp factor after enroll");

  const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    const { data: challenge, error: challengeErr } = await client.auth.mfa.challenge({ factorId });
    if (challengeErr || !challenge?.id) throw new Error(`aal2 challenge: ${challengeErr?.message}`);
    if (!totpSecret) {
      throw new Error(
        "Cannot complete MFA without enrolled TOTP secret. Re-run customer-portal E2E global setup.",
      );
    }
    const { error: verifyErr } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: totpCode(totpSecret),
    });
    if (verifyErr) throw new Error(`aal2 verify: ${verifyErr.message}`);
  }

  const session = (await client.auth.getSession()).data.session;
  if (!session) throw new Error("no session after mfa");

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    totpSecret: totpSecret ?? "",
  };
}

export async function applyStaffCookies(
  context: BrowserContext,
  adminOrigin: string,
  tokens: { accessToken: string; refreshToken: string },
): Promise<void> {
  const url = new URL(adminOrigin);
  await context.addCookies([
    {
      name: STAFF_ACCESS_COOKIE,
      value: tokens.accessToken,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: STAFF_REFRESH_COOKIE,
      value: tokens.refreshToken,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

export async function applyCustomerCookies(
  context: BrowserContext,
  storefrontOrigin: string,
  tokens: { accessToken: string; refreshToken: string },
): Promise<void> {
  const url = new URL(storefrontOrigin);
  await context.addCookies([
    {
      name: CUSTOMER_ACCESS_COOKIE,
      value: tokens.accessToken,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
    {
      name: CUSTOMER_REFRESH_COOKIE,
      value: tokens.refreshToken,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

export async function signInCustomerTokens(email: string, password = QUAL_PASSWORD) {
  const url = process.env.SUPABASE_URL ?? "";
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) throw new Error(`customer sign-in: ${error?.message}`);
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}
