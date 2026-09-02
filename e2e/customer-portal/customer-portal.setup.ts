import { test as setup, expect } from "@playwright/test";
import { join } from "node:path";

import { establishStaffMfaSession, applyStaffCookies } from "../helpers/customer-portal-auth";

const AUTH_FILE = join(process.cwd(), "e2e", ".auth", "staff-qual.json");
const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5184";

setup("authenticate staff (Supabase + MFA)", async ({ browser }) => {
  const tokens = await establishStaffMfaSession();
  const context = await browser.newContext();
  await applyStaffCookies(context, ADMIN_ORIGIN, tokens);
  const page = await context.newPage();
  await page.goto(`${ADMIN_ORIGIN}/customers`);
  await expect(page).toHaveURL(/\/customers/, { timeout: 60_000 });
  // Staff session proof: page chrome is present. Avoid toBeVisible on the H1 —
  // headless sometimes reports the display H1 as "hidden" while the route is authenticated.
  await expect(page.getByRole("button", { name: /Uitnodigen|Serviceklanten sync|Exporteren/i }).first()).toBeVisible({
    timeout: 60_000,
  });
  await context.storageState({ path: AUTH_FILE });
  await context.close();
});
