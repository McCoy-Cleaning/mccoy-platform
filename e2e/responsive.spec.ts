import { test, expect, STOREFRONT_ORIGIN, ADMIN_ORIGIN } from "./fixtures/base";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("Responsive shells", () => {
  for (const vp of VIEWPORTS) {
    test(`storefront home @ ${vp.name}`, async ({ page, failureSink }) => {
      void failureSink;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${STOREFRONT_ORIGIN}/`);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 2;
      });
      expect(overflow, "horizontal overflow").toBe(false);
    });

    test(`admin website @ ${vp.name}`, async ({ page, failureSink }) => {
      void failureSink;
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${ADMIN_ORIGIN}/admin/website`);
      await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible({
        timeout: 30_000,
      });
    });
  }
});
