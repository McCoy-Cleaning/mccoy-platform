import { expect, test } from "@playwright/test";

/**
 * Customers shell smoke — requires admin auth setup project.
 * Commerce data may be empty until fixtures are seeded.
 */
test.describe("Admin Klanten", () => {
  test("opens Customers with portal and guests tabs", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: "Klanten" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("tab", { name: "Serviceklanten (portaal)" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Gasten die hebben gekocht" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bestaande klanten" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Gasten die hebben gekocht" }).click();
    await expect(page.getByRole("tab", { name: "Gasten die hebben gekocht" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
