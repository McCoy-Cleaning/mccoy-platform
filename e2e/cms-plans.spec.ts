import { test } from "@playwright/test";
import { PAGES, runBlockLifecycle } from "./helpers/cms";

test.describe("Plans lifecycle", () => {
  test("add → edit → preview gate → publish → reload → discard", async ({ page }) => {
    const stamp = Date.now();
    await runBlockLifecycle(page, {
      pageId: PAGES.home,
      publicPath: "/",
      templateName: "Pakketten",
      titleA: `Plans A ${stamp}`,
      titleB: `Plans B ${stamp}`,
    });
  });
});
