import AxeBuilder from "@axe-core/playwright";
import { test, expect, STOREFRONT_ORIGIN, ADMIN_ORIGIN } from "./fixtures/base";

test.describe("Accessibility (critical surfaces)", () => {
  test("storefront home has no serious axe violations", async ({ page, failureSink }) => {
    void failureSink;
    // The header/hero fade in via Framer Motion (gated on prefers-reduced-motion).
    // Without forcing reduced motion, axe can sample mid-transition opacity and
    // report spurious color-contrast failures unrelated to the settled UI.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${STOREFRONT_ORIGIN}/`);
    await expect(page.locator("body")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("admin website hub has no serious axe violations", async ({ page, failureSink }) => {
    void failureSink;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${ADMIN_ORIGIN}/website`);
    await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
