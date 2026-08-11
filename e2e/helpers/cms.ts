import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import {
  INVENTORY_PUBLISHABLE_BLOCK_TYPES,
  type BlockType,
} from "@mccoy/cms-schema";

export const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5174";
export const STOREFRONT_ORIGIN = process.env.E2E_STOREFRONT_ORIGIN ?? "http://localhost:5173";

export const PAGES = {
  home: "page_home",
  about: "page_about",
  custom: "page_e2e_custom",
} as const;

/** Dutch picker labels → block type (keep in sync with apps/admin templates.ts). */
export const TEMPLATE_TYPE: Record<string, string> = {
  Hero: "hero",
  "Rich text": "richText",
  "Gecentreerde tekst": "centered",
  "Tekst met afbeelding": "textImage",
  "Tekst + afbeelding": "textImage",
  "Productintro met flyer": "textImage",
  "Tekst kolommen": "columns",
  "Voordelen (checklist)": "benefits",
  "Quote / testimonial": "quote",
  Werkgalerij: "gallery",
  "Foto galerij": "gallery",
  Partners: "partnersMarquee",
  Statistieken: "statsCounters",
  Contactkaarten: "contactInfoCards",
  Offerteformulier: "quoteRequestForm",
  "Juridische artikelen": "legalArticles",
  "Video sectie": "video",
  "Voor & na": "beforeAfter",
  Carrousel: "carousel",
  "Proces / stappen": "steps",
  Vergelijkingstabel: "comparisonTable",
  Kenmerkenraster: "featureGrid",
  "Feature grid": "featureGrid",
  "Assortiment / kenmerken": "featureGrid",
  "Spacer / divider": "spacer",
  "Team grid": "teamGrid",
  "Team profiel": "teamProfile",
  Waarden: "values",
  "Tijdlijn / historie": "timeline",
  Roadmap: "roadmap",
  Pakketten: "plans",
  "Call-to-action banner": "cta",
  "Announcement bar": "announcement",
  Nieuwsbrief: "newsletter",
  "Nieuwsbrief signup": "newsletter",
  Contactformulier: "contactForm",
  "Popup CTA": "popup",
  "Portfolio / projecten": "portfolio",
  Vacatures: "jobs",
  "Uitgelichte artikelen": "latestPosts",
  Aanbiedingen: "offers",
};

/**
 * Canonical Dutch picker label per publishable block type (primary starter).
 * Synced to {@link INVENTORY_PUBLISHABLE_BLOCK_TYPES} below — missing names fail the coverage gate.
 */
export const BLOCK_TYPE_TEMPLATE_NAME: Record<BlockType, string> = {
  hero: "Hero",
  richText: "Rich text",
  centered: "Gecentreerde tekst",
  textImage: "Tekst met afbeelding",
  columns: "Tekst kolommen",
  benefits: "Voordelen (checklist)",
  quote: "Quote / testimonial",
  gallery: "Werkgalerij",
  video: "Video sectie",
  beforeAfter: "Voor & na",
  carousel: "Carrousel",
  steps: "Proces / stappen",
  comparisonTable: "Vergelijkingstabel",
  featureGrid: "Kenmerkenraster",
  spacer: "Spacer / divider",
  teamGrid: "Team grid",
  teamProfile: "Team profiel",
  values: "Waarden",
  timeline: "Tijdlijn / historie",
  roadmap: "Roadmap",
  plans: "Pakketten",
  cta: "Call-to-action banner",
  announcement: "Announcement bar",
  newsletter: "Nieuwsbrief",
  contactForm: "Contactformulier",
  popup: "Popup CTA",
  portfolio: "Portfolio / projecten",
  jobs: "Vacatures",
  latestPosts: "Uitgelichte artikelen",
  partnersMarquee: "Partners",
  statsCounters: "Statistieken",
  contactInfoCards: "Contactkaarten",
  quoteRequestForm: "Offerteformulier",
  legalArticles: "Juridische artikelen",
  offers: "Aanbiedingen",
};

/** Every publishable picker entry — derived from schema registry, not a stale hand list. */
export const ALL_PUBLISHABLE_TEMPLATES: Array<{ template: string; type: BlockType }> =
  INVENTORY_PUBLISHABLE_BLOCK_TYPES.map((type) => ({
    type,
    template: BLOCK_TYPE_TEMPLATE_NAME[type],
  }));

export function editFrame(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="edit"]');
}

export async function openPageEditor(page: Page, pageId: string) {
  // Prefer direct URL — hub listing can race with localStorage ↔ durable reconcile.
  await page.goto(`/admin/website/${pageId}`);
  await expect(page).not.toHaveURL(/\/admin\/website\/?$/);
  await expect(page).not.toHaveURL(/\/admin\/login/);
  await expect(page.locator('iframe[title="edit"]')).toBeVisible({ timeout: 60_000 });
  await expect(editFrame(page).locator("[data-cms-edit-guard='edit']").first()).toBeAttached({
    timeout: 60_000,
  });
}

export async function openSections(page: Page) {
  const layoutDialog = page.getByRole("dialog", { name: "Paginaindeling" });
  if (await layoutDialog.isVisible().catch(() => false)) {
    return;
  }
  const customDialog = page.getByRole("dialog", { name: "Pagina beheren" });
  if (await customDialog.isVisible().catch(() => false)) {
    await customDialog.getByRole("button", { name: /Secties/i }).click();
    return;
  }

  const customFab = page.locator('[data-cms-toolbar="custom-page"]');
  if (await customFab.isVisible().catch(() => false)) {
    if ((await customFab.getAttribute("aria-expanded")) !== "true") {
      await customFab.click();
    }
    await expect(page.getByRole("dialog", { name: "Pagina beheren" })).toBeVisible();
    await page.getByRole("dialog", { name: "Pagina beheren" }).getByRole("button", { name: /Secties/i }).click();
    return;
  }

  const btn = page
    .getByRole("button", { name: "Secties", exact: true })
    .or(page.getByRole("button", { name: /^Secties$/i }));
  await expect(btn.first()).toBeVisible({ timeout: 60_000 });
  if ((await btn.first().getAttribute("aria-expanded")) !== "true") {
    await btn.first().click();
  }
  await expect(layoutDialog).toBeVisible();
}

export async function closeSections(page: Page) {
  const layoutDialog = page.getByRole("dialog", { name: "Paginaindeling" });
  if (await layoutDialog.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Secties sluiten" }).click();
    await expect(layoutDialog).toBeHidden();
    return;
  }
  const customDialog = page.getByRole("dialog", { name: "Pagina beheren" });
  if (await customDialog.isVisible().catch(() => false)) {
    const fab = page.locator('[data-cms-toolbar="custom-page"]');
    if ((await fab.getAttribute("aria-expanded")) === "true") {
      await fab.click();
    }
    await expect(customDialog).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
  }
}

/**
 * Poll until the locator's page bounding box stays within 1px for consecutive samples.
 * Prefer this over sleep after device-mode / drawer transitions.
 */
export async function awaitStableBoundingBox(
  locator: Locator,
  options?: { timeout?: number; stableSamples?: number },
) {
  const timeout = options?.timeout ?? 15_000;
  const stableSamples = options?.stableSamples ?? 3;
  await expect(locator).toBeVisible({ timeout });
  await expect(locator).toBeAttached({ timeout });

  let previous: { x: number; y: number; width: number; height: number } | null = null;
  let stableCount = 0;

  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box || box.width < 2 || box.height < 2) {
          previous = null;
          stableCount = 0;
          return 0;
        }
        if (
          previous &&
          Math.abs(previous.x - box.x) <= 1 &&
          Math.abs(previous.y - box.y) <= 1 &&
          Math.abs(previous.width - box.width) <= 1 &&
          Math.abs(previous.height - box.height) <= 1
        ) {
          stableCount += 1;
        } else {
          stableCount = 0;
        }
        previous = box;
        return stableCount;
      },
      {
        timeout,
        intervals: [50, 100, 150, 250],
        message: "Locator bounding box did not stabilize",
      },
    )
    .toBeGreaterThanOrEqual(stableSamples);
}

/**
 * Switch the admin edit canvas to the fixed 390px DeviceFrame.
 * Keep the Playwright viewport at desktop size — do not also call setViewportSize(mobile).
 * Double-resize (toggle + viewport) reflows admin chrome and races iframe layout.
 */
export async function enableMobileDeviceCanvas(page: Page, canvas: Locator) {
  const mobileBtn = page.getByRole("button", { name: "Mobiel" });
  await expect(mobileBtn).toBeVisible();
  await mobileBtn.click();

  // DeviceFrame locks the edit iframe to 390px; section content is narrower (page padding).
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0, {
      timeout: 15_000,
      message: "Edit canvas did not enter mobile DeviceFrame width",
    })
    .toBeLessThan(520);

  await awaitStableBoundingBox(canvas);
}

/** Prepare a CMS canvas subject for pixel screenshots (fonts, images, settled box). */
export async function prepareCanvasScreenshot(page: Page, subject: Locator) {
  await closeSections(page);
  await subject.scrollIntoViewIfNeeded();
  await expect(subject).toBeVisible();

  await subject.evaluate(async (el) => {
    const doc = el.ownerDocument;
    if (doc.fonts?.ready) await doc.fonts.ready;
    const images = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      images.map(async (img) => {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          });
        }
        // complete can be true before pixels are decoded (0×0 / pending paint).
        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch {
            /* broken image — still settle layout */
          }
        }
      }),
    );
  });

  await expect
    .poll(
      async () =>
        subject.evaluate((el) =>
          Array.from(el.querySelectorAll("img")).every(
            (img) => img.complete && (img.naturalWidth > 0 || img.naturalHeight > 0 || !img.src),
          ),
        ),
      { timeout: 15_000, message: "Images inside screenshot subject did not finish decoding" },
    )
    .toBe(true);

  await awaitStableBoundingBox(subject);
}

export async function addCmsSection(page: Page, templateName: string) {
  await openSections(page);
  // Custom PageEditor renders an add button before and after every block.
  await page.getByRole("button", { name: "Sectie toevoegen" }).first().click();
  await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeVisible();
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  const type = TEMPLATE_TYPE[templateName];
  // Prefer canonical picker label for search so aliases like "Foto galerij" /
  // "Nieuwsbrief signup" still surface the template card.
  const searchTerm =
    type && type in BLOCK_TYPE_TEMPLATE_NAME
      ? BLOCK_TYPE_TEMPLATE_NAME[type as BlockType]
      : templateName;
  await page.getByPlaceholder(/Zoek/).fill(searchTerm);
  if (type) {
    await page.locator(`[data-cms-template="${type}"]`).first().click();
  } else {
    await page.getByRole("button", { name: templateName, exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeHidden({
    timeout: 15_000,
  });
}

export async function setBlockTitle(page: Page, title: string) {
  const dialog = page
    .getByRole("dialog", { name: "Paginaindeling" })
    .or(page.getByRole("dialog", { name: "Pagina beheren" }));
  const titleField = dialog.getByLabel("Titel", { exact: true }).first();
  await expect(titleField).toBeVisible();
  await titleField.click();
  // clear() + fill ensures controlled React inputs see empty (fill("") alone can desync).
  await titleField.clear();
  if (title) {
    await titleField.fill(title);
  } else {
    await titleField.press("ControlOrMeta+A");
    await titleField.press("Backspace");
  }
  await expect(titleField).toHaveValue(title);
}

export async function savePage(page: Page) {
  let alertMessage: string | null = null;
  let handling = true;

  const pumpDialogs = (async () => {
    while (handling) {
      try {
        const dialog = await page.waitForEvent("dialog", { timeout: 2_000 });
        if (dialog.type() === "confirm") {
          await dialog.accept();
        } else {
          alertMessage = dialog.message();
          await dialog.accept();
        }
      } catch {
        // No dialog in this window — keep pumping until save settles.
      }
    }
  })();

  const publishBtn = page
    .getByRole("button", { name: "Opslaan & publiceren" })
    .or(page.getByRole("button", { name: /^Opslaan$/ }))
    .or(page.getByRole("button", { name: /Pagina publiceren/i }));
  await expect(publishBtn.first()).toBeEnabled({ timeout: 30_000 });
  await publishBtn.first().click();
  // Publishing over an outdated preview raises an in-app confirmation dialog
  // (not a native window.confirm), gated on the preview pane being open.
  const outdatedPreviewDialog = page
    .getByRole("alertdialog")
    .filter({ hasText: "Preview is verouderd" });
  try {
    await outdatedPreviewDialog.waitFor({ state: "visible", timeout: 3_000 });
    await outdatedPreviewDialog.getByRole("button", { name: "Toch publiceren" }).click();
  } catch {
    // No outdated-preview confirmation was raised — proceed.
  }
  try {
    await expect
      .poll(
        async () => {
          if (alertMessage) {
            // Content-AI EN auto-translate may warn after a successful save.
            if (/opgeslagen/i.test(alertMessage)) {
              return true;
            }
            throw new Error(`Opslaan rejected: ${alertMessage}`);
          }
          if (await page.getByText(/Opgeslagen/i).first().isVisible().catch(() => false)) {
            return true;
          }
          // Toast can dismiss before the poll samples it; a cleared draft (Opslaan
          // disabled again) is also a successful publish signal.
          const saveAgain = page.getByRole("button", { name: "Opslaan & publiceren" });
          if (await saveAgain.isDisabled().catch(() => false)) {
            return true;
          }
          return false;
        },
        { timeout: 60_000 },
      )
      .toBe(true);
  } finally {
    handling = false;
    await pumpDialogs.catch(() => undefined);
  }
}

export async function discardDraft(page: Page) {
  const verwerpen = page.getByRole("button", { name: "Verwerpen" });
  await expect(verwerpen).toBeEnabled({ timeout: 15_000 });
  await verwerpen.click();
  // Discard is gated behind an in-app confirmation dialog (not a native
  // window.confirm) whose confirm button shares the "Verwerpen"/"Verwijderen"
  // accessible name — scope to the dialog to avoid ambiguity with the toolbar
  // button underneath.
  const confirmDialog = page.getByRole("alertdialog");
  await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
  await confirmDialog.getByRole("button", { name: /^(Verwerpen|Verwijderen)$/ }).click();
  // After discard, the toolbar returns to a clean published state (button disabled).
  await expect(verwerpen).toBeDisabled({ timeout: 30_000 });
}

export async function expectEditCanvasText(page: Page, text: string) {
  await expect(editFrame(page).getByText(text, { exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function expectStorefrontText(page: Page, path: string, text: string) {
  await page.goto(`${STOREFRONT_ORIGIN}${path}`);
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
}

/**
 * Full lifecycle for a block type added via Secties on a builtin page.
 */
export async function runBlockLifecycle(
  page: Page,
  opts: {
    pageId: string;
    publicPath: string;
    templateName: string;
    titleA: string;
    titleB: string;
  },
) {
  await openPageEditor(page, opts.pageId);
  await addCmsSection(page, opts.templateName);
  await setBlockTitle(page, opts.titleA);
  await expectEditCanvasText(page, opts.titleA);

  await setBlockTitle(page, opts.titleB);
  await expectEditCanvasText(page, opts.titleB);

  await savePage(page);
  await expectStorefrontText(page, opts.publicPath, opts.titleB);
  await page.reload();
  await expect(page.getByText(opts.titleB, { exact: false }).first()).toBeVisible();

  await openPageEditor(page, opts.pageId);
  await selectLayoutSection(page, opts.templateName);
  await setBlockTitle(page, "SHOULD_DISCARD");
  await expectEditCanvasText(page, "SHOULD_DISCARD");
  await discardDraft(page);
  await expectEditCanvasText(page, opts.titleB);
  await expect(editFrame(page).getByText("SHOULD_DISCARD")).toHaveCount(0);
}

export async function selectLayoutSection(page: Page, label: string | RegExp) {
  await openSections(page);
  const dialog = page.getByRole("dialog", { name: "Paginaindeling" });
  const row = dialog.locator("[data-cms-layout-row]").filter({ hasText: label }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button").first().click();
}

/** Fill the manual EN draft control for a labelled NL field (Content-AI panel). */
export async function fillManualEnDraft(page: Page, nlLabel: string, enValue: string) {
  const en = page.getByLabel(new RegExp(`^${nlLabel}: Engelse vertaling`, "i"));
  await expect(en.first()).toBeVisible({ timeout: 15_000 });
  await en.first().fill(enValue);
}

/**
 * On custom pages, LocalePublishPanel lives inside the Pagina drawer (Secties tab).
 * Publishes the EN locale (requires localeContent.en — seeded on e2e custom page).
 */
export async function publishEnglishLocale(page: Page) {
  const drawer = page.getByRole("dialog", { name: "Pagina beheren" });
  if (!(await drawer.isVisible().catch(() => false))) {
    const btn = page.locator('[data-cms-toolbar="custom-page"]');
    await btn.click();
    await expect(drawer).toBeVisible();
  }
  await drawer.getByRole("button", { name: /^Secties$/i }).click();
  await drawer.getByRole("button", { name: /^en$/i }).click();
  await drawer.getByRole("button", { name: /Publiceer EN/i }).click();
  await expect(drawer.getByText(/Gepubliceerd \(revisie/i)).toBeVisible({ timeout: 60_000 });
}
