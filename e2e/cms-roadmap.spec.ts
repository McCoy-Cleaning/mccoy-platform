import { test } from "@playwright/test";
import { PAGES, runBlockLifecycle } from "./helpers/cms";

test.describe("Roadmap lifecycle", () => {
  test("add → edit → preview gate → publish → reload → discard", async ({ page }) => {
    const stamp = Date.now();
    await runBlockLifecycle(page, {
      pageId: PAGES.home,
      publicPath: "/",
      templateName: "Roadmap",
      titleA: `Roadmap A ${stamp}`,
      titleB: `Roadmap B ${stamp}`,
    });
  });
});
