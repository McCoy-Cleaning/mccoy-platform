import { expect, test } from "@playwright/test";

const ADMIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5184";
const SECRET = process.env.COMMERCE_CRON_SECRET ?? "qual-commerce-cron-secret-not-production";

test.describe("Commerce portal cron (local)", () => {
  test("denies missing and wrong bearer", async ({ request }) => {
    const noAuth = await request.get(`${ADMIN}/api/commerce-portal-jobs`, { failOnStatusCode: false });
    expect(noAuth.status()).toBe(401);

    const wrong = await request.get(`${ADMIN}/api/commerce-portal-jobs`, {
      headers: { Authorization: "Bearer wrong-secret" },
      failOnStatusCode: false,
    });
    expect(wrong.status()).toBe(401);
  });

  test("accepts correct bearer and returns job metrics", async ({ request }) => {
    const res = await request.get(`${ADMIN}/api/commerce-portal-jobs`, {
      headers: { Authorization: `Bearer ${SECRET}` },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.emails).toBeTruthy();
    expect(body.reminders).toBeTruthy();
  });
});
