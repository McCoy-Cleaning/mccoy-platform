import { expect, type Page } from "@playwright/test";
import { STOREFRONT_ORIGIN, e2eMarker } from "./base";

/** NL + EN success copy — avoid matching field labels like "Uw bericht". */
const FORM_SUCCESS_TEXT = /bedankt|thank you|ontvangen|received|we nemen|we will be in touch/i;

async function expectFormSuccess(page: Page) {
  const byTestId = page.getByTestId("site-form-success");
  const byStatus = page.getByRole("status").filter({ hasText: FORM_SUCCESS_TEXT });
  await expect(byTestId.or(byStatus).first()).toBeVisible({ timeout: 30_000 });
  expect(page.url()).not.toMatch(/[?&]name=/);
}

export type ContactFormInput = {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
};

/**
 * Submit the contact form on /contact. Uses web-first assertions.
 * Returns the marker embedded in the message for Aanvragen lookup.
 */
export async function submitContactForm(
  page: Page,
  overrides?: Partial<ContactFormInput>,
): Promise<{ marker: string; email: string; name: string }> {
  const marker = e2eMarker("contact");
  const name = overrides?.name ?? `E2E Contact ${marker}`;
  const email = overrides?.email ?? `e2e.${marker}@example.test`;
  const message = overrides?.message ?? `Playwright contact submission ${marker}`;

  await page.goto(`${STOREFRONT_ORIGIN}/contact`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Wait until React listeners are mounted — otherwise native GET navigates with query params.
  const submit = page.getByRole("button", { name: /verstuur/i });
  await expect(page.getByTestId("site-form-ready")).toBeVisible({ timeout: 30_000 });
  await expect(submit).toBeEnabled({ timeout: 30_000 });

  // Prefer role+exact name — /naam/i also matches "Bedrijfsnaam".
  await page.getByRole("textbox", { name: /^Naam/i }).fill(name);
  await page.getByRole("textbox", { name: /^E-?mail/i }).fill(email);
  if (overrides?.phone !== undefined) {
    await page.getByRole("textbox", { name: /^Telefoon/i }).fill(overrides.phone);
  } else {
    await page.getByRole("textbox", { name: /^Telefoon/i }).fill("0612345678");
  }
  if (overrides?.company) {
    await page.getByRole("textbox", { name: /^Bedrijfsnaam/i }).fill(overrides.company);
  }
  await page.getByRole("textbox", { name: /bericht|message/i }).fill(message);

  await expect(page.getByRole("textbox", { name: /^Naam/i })).toHaveValue(name);
  await submit.click();
  await expectFormSuccess(page);

  return { marker, email, name };
}

export async function submitOfferteGlassForm(page: Page): Promise<{ marker: string; email: string }> {
  const marker = e2eMarker("glass");
  const email = `e2e.${marker}@example.test`;
  const name = `E2E Glass ${marker}`;

  await page.goto(`${STOREFRONT_ORIGIN}/offerte`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
    timeout: 30_000,
  });

  const glassTab = page.getByRole("button", { name: /glasbewassing/i });
  await expect(glassTab.first()).toBeVisible();
  await glassTab.first().click();

  const submit = page.getByRole("button", { name: /verstuur aanvraag/i });
  await expect(page.getByTestId("site-form-ready")).toBeVisible({ timeout: 30_000 });
  await expect(submit).toBeEnabled({ timeout: 30_000 });

  await page.getByRole("textbox", { name: /^Naam/i }).fill(name);
  await page.getByRole("textbox", { name: /^E-?mail/i }).fill(email);
  await page.getByRole("textbox", { name: /^Telefoon/i }).fill("0612345678");
  const message = page.getByRole("textbox", { name: /bericht|message|opmerk/i });
  if (await message.first().isVisible().catch(() => false)) {
    await message.first().fill(`Playwright glass offerte ${marker}`);
  }

  await submit.click();
  await expectFormSuccess(page);

  return { marker, email };
}

/**
 * Open Admin → Aanvragen and assert a submission containing `marker` is listed.
 */
export async function expectAanvraagListed(
  page: Page,
  marker: string,
  options?: { kindLabel?: RegExp },
) {
  await page.goto("/inquiries");
  await expect(page.getByRole("heading", { name: /Aanvragen/i })).toBeVisible({
    timeout: 30_000,
  });

  // Should not show mailbox-not-configured when MCCOY_E2E adapter is active
  await expect(page.getByText(/Mailbox niet geconfigureerd/i)).toHaveCount(0);

  if (options?.kindLabel) {
    const filter = page.getByRole("tab", { name: options.kindLabel });
    if (await filter.first().isVisible().catch(() => false)) {
      await filter.first().click();
    }
  }

  const search = page.getByLabel(/Zoek aanvragen/i);
  await expect(search).toBeVisible();
  await search.fill(marker);
  await page.getByRole("button", { name: /^Zoeken$/i }).click();

  await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });
}
