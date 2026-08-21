import { expect, test } from "@playwright/test";

/**
 * Customers shell smoke — requires admin auth setup project.
 * Commerce data may be empty until fixtures are seeded.
 */
test.describe("Admin Klanten", () => {
  test("opens Customers with both population tabs", async ({ page }) => {
    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: "Klanten" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("tab", { name: "Bestaande klanten" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Gasten die hebben gekocht" })).toBeVisible();
    await page.getByRole("tab", { name: "Gasten die hebben gekocht" }).click();
    await expect(page.getByRole("tab", { name: "Gasten die hebben gekocht" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
