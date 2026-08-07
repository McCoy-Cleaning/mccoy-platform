import { test as base, expect, type Page } from "@playwright/test";

const IGNORED_CONSOLE =
  /Download the React DevTools|\[vite\]|favicon\.ico|third-party cookie|net::ERR_ABORTED|ResizeObserver loop|Failed to load resource: the server responded with a status of (503|404)|Warning:|React does not recognize|validateDOMNesting|Each child in a list|was not wrapped in act|hydrat|notranslate|Server function not resolved|requireAdminSession is not a function|Stop every npm run dev:admin|failed to load published bundle|Failed to fetch|SupabaseConfigError|Missing SUPABASE_URL|\[cms-media\]|Content Security Policy|fonts\.googleapis\.com/i;

type FailureSink = {
  pageErrors: string[];
  consoleErrors: string[];
};

/**
 * Base fixture: fails the test when the page throws or logs console errors
 * (excluding known benign noise). Attach before any navigation.
 */
export const test = base.extend<{ failureSink: FailureSink }>({
  failureSink: async ({ page }, use, testInfo) => {
    const sink: FailureSink = { pageErrors: [], consoleErrors: [] };

    page.on("pageerror", (err) => {
      sink.pageErrors.push(err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED_CONSOLE.test(text)) return;
      sink.consoleErrors.push(text);
    });

    await use(sink);

    const failures = [
      ...sink.pageErrors.map((m) => `pageerror: ${m}`),
      ...sink.consoleErrors.map((m) => `console.error: ${m}`),
    ];
    if (failures.length > 0 && testInfo.status === "passed") {
      throw new Error(
        `Global failure detection caught ${failures.length} issue(s):\n${failures.slice(0, 8).join("\n")}`,
      );
    }
  },
});

export { expect };

export const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5174";
export const STOREFRONT_ORIGIN = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5173";

/** Unique, non-PII-looking marker for form submissions (safe in traces). */
export function e2eMarker(prefix = "e2e"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function gotoAdmin(page: Page, path: string) {
  await page.goto(`${ADMIN_ORIGIN}${path}`);
}

export async function gotoStorefront(page: Page, path: string) {
  await page.goto(`${STOREFRONT_ORIGIN}${path}`);
}
