import { test, expect } from "@playwright/test";
import {
  resetBuiltinPagesToSeed,
  syncBuiltinPagesLocalStorageFromStore,
} from "./helpers/reset-cms-home";
import {
  PARITY_PAGES,
  PARITY_DESKTOP,
  PARITY_MOBILE,
  assertEditorChromeAbsent,
  assertNoHorizontalOverflow,
  assertRectsNearlyEqual,
  assertScreenshotBuffersParity,
  assertViewportParity,
  awaitFontsReady,
  captureParitySubjectPng,
  captureVerticalGeometryChain,
  collectParityDiagnostics,
  diffParityDiagnostics,
  neutralizeEditorInteractionState,
  openEditorParitySubject,
  openStorefrontParityPage,
  prepareParitySubject,
  readRect,
  setEditorInteractionMode,
  writeParityArtifact,
  type CssRect,
  type ParityPageKey,
} from "./helpers/cms-wysiwyg-parity";
import { editFrame, STOREFRONT_ORIGIN, awaitStableBoundingBox } from "./helpers/cms";

const SEED_PAGES = ["page_home", "page_contact", "page_offerte"] as const;

/**
 * E10.1 — WYSIWYG visual parity.
 *
 * Order per scenario: content → viewport → media → fonts → geometry → screenshot.
 * Gate: maxDiffPixelRatio <= 0.02 (do not loosen).
 */
test.describe("E10 CMS WYSIWYG parity", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await resetBuiltinPagesToSeed(SEED_PAGES);
    await page.goto("/website");
    await syncBuiltinPagesLocalStorageFromStore(page, SEED_PAGES);
  });

  for (const key of Object.keys(PARITY_PAGES) as ParityPageKey[]) {
    for (const viewport of ["desktop", "mobile"] as const) {
      test(`${key} ${viewport}: storefront ≈ editor Preview screenshot`, async ({
        page,
        context,
      }) => {
        test.setTimeout(180_000);
        const expectedWidth = viewport === "mobile" ? PARITY_MOBILE.width : PARITY_DESKTOP.width;

        // Keep admin Preview open; capture storefront in a sibling page (no re-open flake).
        const { frame, subject: preview } = await openEditorParitySubject(
          page,
          key,
          viewport,
          "preview",
        );
        await assertEditorChromeAbsent(frame);
        const previewDiag = await collectParityDiagnostics(
          frame,
          preview,
          `preview-${key}-${viewport}`,
        );
        const previewPng = await captureParitySubjectPng(page, preview, expectedWidth);

        const storePage = await context.newPage();
        await storePage.emulateMedia({ reducedMotion: "reduce" });
        const storefront = await openStorefrontParityPage(storePage, key, viewport);
        await assertEditorChromeAbsent(storePage);
        const storefrontDiag = await collectParityDiagnostics(
          storePage,
          storefront,
          `storefront-${key}-${viewport}`,
        );
        const storefrontPng = await captureParitySubjectPng(storePage, storefront, expectedWidth);
        await storePage.close();

        const diff = diffParityDiagnostics(storefrontDiag, previewDiag);
        writeParityArtifact(
          `parity-${key}-${viewport}`,
          { storefront: storefrontDiag, preview: previewDiag, diff },
          { storefront: storefrontPng, preview: previewPng },
        );

        expect(
          diff.contentMatch,
          `CONTENT_FIXTURE_MISMATCH hashes ${diff.contentHashes.a} vs ${diff.contentHashes.b}`,
        ).toBe(true);
        expect(diff.mediaFailedA, `storefront broken media: ${diff.mediaFailedA.join(", ")}`).toEqual(
          [],
        );
        expect(diff.mediaFailedB, `preview broken media: ${diff.mediaFailedB.join(", ")}`).toEqual([]);
        await assertViewportParity(storefrontDiag, previewDiag, expectedWidth);
        expect(
          diff.rootWidthDelta,
          `root width delta ${diff.rootWidthDelta} (first section ${JSON.stringify(diff.firstDivergentSection)})`,
        ).toBeLessThanOrEqual(2);
        expect(
          diff.fontMismatches,
          `font mismatches: ${JSON.stringify(diff.fontMismatches)}`,
        ).toEqual([]);

        await assertScreenshotBuffersParity(
          page,
          storefrontPng,
          previewPng,
          `parity-${key}-${viewport}`,
        );
      });
    }
  }

  test("Offerte mobile: localize residual screenshot regions to DOM", async ({ page, context }) => {
    test.setTimeout(180_000);
    const { frame, subject: preview } = await openEditorParitySubject(
      page,
      "offerte",
      "mobile",
      "preview",
    );
    const storePage = await context.newPage();
    await storePage.emulateMedia({ reducedMotion: "reduce" });
    const storefront = await openStorefrontParityPage(storePage, "offerte", "mobile");

    const collectControls = async (subject: import("@playwright/test").Locator) =>
      subject.evaluate((el) => {
        const root = el.getBoundingClientRect();
        const nodes = Array.from(
          el.querySelectorAll(
            "h1, h2, p, label, input, select, textarea, button, [data-testid='form-file-upload']",
          ),
        );
        return nodes.map((node) => {
          const html = node as HTMLElement;
          const r = html.getBoundingClientRect();
          const cs = getComputedStyle(html);
          const tag = html.tagName.toLowerCase();
          return {
            tag,
            type: html.getAttribute("type") || "",
            name: html.getAttribute("name") || "",
            testId: html.getAttribute("data-testid") || "",
            text: (html.innerText || html.getAttribute("aria-label") || "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 80),
            y: r.top - root.top,
            height: r.height,
            width: r.width,
            display: cs.display,
            appearance: cs.appearance || (cs as CSSStyleDeclaration & { webkitAppearance?: string }).webkitAppearance || "",
            colorScheme: cs.colorScheme,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            borderWidth: cs.borderTopWidth,
            borderRadius: cs.borderRadius,
            padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
          };
        });
      });

    const docEnv = async (subject: import("@playwright/test").Locator) =>
      subject.evaluate((el) => {
        const doc = el.ownerDocument;
        const html = doc.documentElement;
        const body = doc.body;
        return {
          lang: html.lang,
          dir: html.dir || body.dir,
          htmlColorScheme: getComputedStyle(html).colorScheme,
          bodyColorScheme: getComputedStyle(body).colorScheme,
          htmlStyleColorScheme: html.style.colorScheme,
          bodyStyleColorScheme: body.style.colorScheme,
        };
      });

    const storeControls = await collectControls(storefront);
    const previewControls = await collectControls(preview);
    const storeEnv = await docEnv(storefront);
    const previewEnv = await docEnv(preview);

    const bands = [
      { y0: 20, y1: 80 },
      { y0: 120, y1: 320 },
      { y0: 340, y1: 420 },
      { y0: 1080, y1: 1280 },
      { y0: 1720, y1: 1780 },
    ];
    const hit = (controls: typeof storeControls, y0: number, y1: number) =>
      controls.filter((c) => c.y + c.height >= y0 && c.y <= y1);

    writeParityArtifact("offerte-mobile-region-dom-map", {
      storeEnv,
      previewEnv,
      bands: bands.map((b) => ({
        ...b,
        storefront: hit(storeControls, b.y0, b.y1),
        preview: hit(previewControls, b.y0, b.y1),
      })),
      storeNative: storeControls.filter((c) =>
        ["select", "input"].includes(c.tag) &&
        (c.tag === "select" || ["file", "checkbox", "radio", "date", "number"].includes(c.type)),
      ),
      previewNative: previewControls.filter((c) =>
        ["select", "input"].includes(c.tag) &&
        (c.tag === "select" || ["file", "checkbox", "radio", "date", "number"].includes(c.type)),
      ),
    });

    // Component-level screenshots for largest native suspects.
    for (const [label, sel] of [
      ["select", "select"],
      ["file", 'input[type="file"]'],
      ["textarea", "textarea"],
      ["submit", 'button[type="submit"]'],
      ["heading", "h2"],
    ] as const) {
      const s = storefront.locator(sel).first();
      const p = preview.locator(sel).first();
      if ((await s.count()) === 0 || (await p.count()) === 0) continue;
      const sPng = await s.screenshot({ animations: "disabled" });
      const pPng = await p.screenshot({ animations: "disabled" });
      writeParityArtifact(`offerte-mobile-component-${label}`, { label }, { storefront: sPng, preview: pPng });
      try {
        await assertScreenshotBuffersParity(page, sPng, pPng, `offerte-mobile-component-${label}`);
      } catch (err) {
        writeParityArtifact(`offerte-mobile-component-${label}-fail`, {
          label,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await storePage.close();
  });

  test("Home desktop: Preview vs Edit geometry (no layout shift)", async ({ page }) => {
    const { frame, subject: root } = await openEditorParitySubject(
      page,
      "home",
      "desktop",
      "preview",
    );

    const h1 = frame.locator("#home h1").first();
    const image = frame.locator("#home img").first();
    const cta = frame.locator("#home a").first();

    const preview = {
      root: await relativeRect(root, root),
      h1: await relativeRect(h1, root),
      image: await relativeRect(image, root),
      cta: await relativeRect(cta, root),
    };

    await setEditorInteractionMode(page, "edit");
    await expect(frame.locator("[data-cms-edit-guard='edit']").first()).toBeAttached();
    const editRoot = frame.locator("#home").first();
    await editRoot.scrollIntoViewIfNeeded();

    const edit = {
      root: await relativeRect(editRoot, editRoot),
      h1: await relativeRect(frame.locator("#home h1").first(), editRoot),
      image: await relativeRect(frame.locator("#home img").first(), editRoot),
      cta: await relativeRect(frame.locator("#home a").first(), editRoot),
    };

    assertRectsNearlyEqual(preview.root, edit.root, "hero root");
    assertRectsNearlyEqual(preview.h1, edit.h1, "hero H1");
    assertRectsNearlyEqual(preview.image, edit.image, "hero image");
    assertRectsNearlyEqual(preview.cta, edit.cta, "hero primary CTA");
  });

  test("Contact desktop: Preview vs Edit form geometry + sm:col-span grid", async ({ page }) => {
    test.setTimeout(120_000);
    const { frame, subject: root } = await openEditorParitySubject(
      page,
      "contact",
      "desktop",
      "preview",
    );
    await neutralizeEditorInteractionState(page, frame);
    await awaitFontsReady(root);

    const heading = frame.locator('[data-cms-section="contact.form"] h2').first();
    const form = frame.locator('[data-cms-section="contact.form"] form').first();
    const textarea = form.locator("textarea").first();
    const submit = form.locator('button[type="submit"]').first();

    await awaitStableBoundingBox(form);
    await awaitStableBoundingBox(textarea);

    const preview = {
      root: await relativeRect(root, root),
      heading: await relativeRect(heading, root),
      form: await relativeRect(form, root),
      grid: await relativeRect(form, root),
      textareaWrap: await relativeClosestRect(textarea, root, "[data-cms-form-field-chrome]"),
      textarea: await relativeRect(textarea, root),
      submit: await relativeRect(submit, root),
    };
    const previewChain = await captureVerticalGeometryChain(root, textarea);

    await setEditorInteractionMode(page, "edit");
    const editRoot = frame.locator('[data-cms-section="contact.form"]').first();
    await expect(editRoot).toBeVisible({ timeout: 30_000 });
    await expect(frame.locator("[data-cms-edit-guard='edit']")).toHaveCount(1, { timeout: 30_000 });
    await neutralizeEditorInteractionState(page, frame);
    await awaitFontsReady(editRoot);
    await prepareParitySubject(editRoot);
    await neutralizeEditorInteractionState(page, frame);

    const editForm = frame.locator('[data-cms-section="contact.form"] form').first();
    const editTextarea = editForm.locator("textarea").first();
    await awaitStableBoundingBox(editRoot);
    await awaitStableBoundingBox(editForm);
    await awaitStableBoundingBox(editTextarea);

    const edit = {
      root: await relativeRect(editRoot, editRoot),
      heading: await relativeRect(
        frame.locator('[data-cms-section="contact.form"] h2').first(),
        editRoot,
      ),
      form: await relativeRect(editForm, editRoot),
      grid: await relativeRect(editForm, editRoot),
      textareaWrap: await relativeClosestRect(editTextarea, editRoot, "[data-cms-form-field-chrome]"),
      textarea: await relativeRect(editTextarea, editRoot),
      submit: await relativeRect(editForm.locator('button[type="submit"]').first(), editRoot),
    };
    const editChain = await captureVerticalGeometryChain(editRoot, editTextarea);
    writeParityArtifact("contact-preview-edit-geometry-chain", { previewChain, editChain, preview, edit });

    const firstDivergent = previewChain.find((node, i) => {
      const other = editChain[i];
      if (!other) return true;
      return Math.abs(node.top - other.top) > 2 || Math.abs(node.height - other.height) > 2;
    });
    if (firstDivergent) {
      writeParityArtifact("contact-first-divergent-ancestor", {
        firstDivergent,
        previewChain,
        editChain,
      });
    }

    assertRectsNearlyEqual(preview.root, edit.root, "contact root");
    assertRectsNearlyEqual(preview.heading, edit.heading, "contact heading");
    assertRectsNearlyEqual(preview.form, edit.form, "contact form");
    assertRectsNearlyEqual(preview.textareaWrap, edit.textareaWrap, "contact textarea wrapper");
    assertRectsNearlyEqual(preview.textarea, edit.textarea, "contact textarea (full-width / sm:col-span-2)");
    assertRectsNearlyEqual(preview.submit, edit.submit, "contact submit");
  });

  test("Contact desktop: Preview↔Edit geometry stability ×10", async ({ page }) => {
    test.setTimeout(300_000);
    const failures: Array<{ run: number; label: string; dy: number }> = [];

    for (let run = 1; run <= 10; run++) {
      await resetBuiltinPagesToSeed(SEED_PAGES);
      await page.goto("/website");
      await syncBuiltinPagesLocalStorageFromStore(page, SEED_PAGES);

      const { frame, subject: root } = await openEditorParitySubject(
        page,
        "contact",
        "desktop",
        "preview",
      );
      await neutralizeEditorInteractionState(page, frame);
      await awaitFontsReady(root);
      const form = frame.locator('[data-cms-section="contact.form"] form').first();
      const textarea = form.locator("textarea").first();
      await awaitStableBoundingBox(textarea);
      const previewTextarea = await relativeRect(textarea, root);
      const previewForm = await relativeRect(form, root);

      await setEditorInteractionMode(page, "edit");
      const editRoot = frame.locator('[data-cms-section="contact.form"]').first();
      await expect(editRoot).toBeVisible({ timeout: 30_000 });
      await neutralizeEditorInteractionState(page, frame);
      await awaitFontsReady(editRoot);
      await prepareParitySubject(editRoot);
      await neutralizeEditorInteractionState(page, frame);
      const editForm = frame.locator('[data-cms-section="contact.form"] form').first();
      const editTextarea = editForm.locator("textarea").first();
      await awaitStableBoundingBox(editTextarea);
      const editTextareaRect = await relativeRect(editTextarea, editRoot);
      const editFormRect = await relativeRect(editForm, editRoot);

      const dyTextarea = Math.abs(previewTextarea.y - editTextareaRect.y);
      const dyForm = Math.abs(previewForm.y - editFormRect.y);
      if (dyTextarea > 2) failures.push({ run, label: "textarea", dy: dyTextarea });
      if (dyForm > 2) failures.push({ run, label: "form", dy: dyForm });
    }

    writeParityArtifact("contact-geometry-stability-x10", { failures });
    expect(failures, `Contact geometry instability: ${JSON.stringify(failures)}`).toEqual([]);
  });

  test("Offerte desktop: Preview vs Edit form geometry", async ({ page }) => {
    const { frame, subject: root } = await openEditorParitySubject(
      page,
      "offerte",
      "desktop",
      "preview",
    );
    const heading = root.locator("h2").first();
    const form = root.locator("form").first();
    const input = form.locator("input:not([type='hidden']):not([tabindex='-1'])").first();

    const preview = {
      root: await relativeRect(root, root),
      heading: await relativeRect(heading, root),
      form: await relativeRect(form, root),
      input: await relativeRect(input, root),
    };

    await setEditorInteractionMode(page, "edit");
    const editRoot = frame.locator('[data-cms-block-type="quoteRequestForm"]').first();
    await editRoot.scrollIntoViewIfNeeded();
    const editForm = editRoot.locator("form").first();

    assertRectsNearlyEqual(preview.root, await relativeRect(editRoot, editRoot), "offerte root");
    if (await heading.count()) {
      assertRectsNearlyEqual(
        preview.heading,
        await relativeRect(editRoot.locator("h2").first(), editRoot),
        "offerte heading",
      );
    }
    assertRectsNearlyEqual(preview.form, await relativeRect(editForm, editRoot), "offerte form");
    assertRectsNearlyEqual(
      preview.input,
      await relativeRect(
        editForm.locator("input:not([type='hidden']):not([tabindex='-1'])").first(),
        editRoot,
      ),
      "offerte input",
    );
  });

  test("Mobile: no horizontal overflow in Preview (Home/Contact/Offerte)", async ({ page }) => {
    for (const key of Object.keys(PARITY_PAGES) as ParityPageKey[]) {
      const { frame } = await openEditorParitySubject(page, key, "mobile", "preview");
      await assertNoHorizontalOverflow(frame);
    }
  });

  test("Preview disables selection chrome; Edit blocks form submit", async ({ page }) => {
    // Preview: no selection chrome; guard present. (Preview allows in-iframe
    // navigation for parity checks — do not click CTAs here.)
    await openEditorParitySubject(page, "home", "desktop", "preview");
    const frame = editFrame(page);
    await assertEditorChromeAbsent(frame);
    await expect(frame.locator("[data-cms-edit-guard='preview']").first()).toBeAttached({
      timeout: 15_000,
    });

    await setEditorInteractionMode(page, "edit");
    await expect(editFrame(page).locator("[data-cms-edit-guard='edit']").first()).toBeAttached({
      timeout: 30_000,
    });

    await openEditorParitySubject(page, "contact", "desktop", "edit");
    const form = editFrame(page).locator('[data-cms-section="contact.form"] form').first();
    await expect(form).toBeVisible({ timeout: 30_000 });
    const before = page.url();
    await form.evaluate((el) => {
      (el as HTMLFormElement).requestSubmit();
    });
    await expect(page).toHaveURL(before);
    await expect(editFrame(page).locator("[data-cms-edit-guard='edit']").first()).toBeAttached();
  });

  test("Edit → Preview → Edit does not invent draft dirtiness", async ({ page }) => {
    await openEditorParitySubject(page, "home", "desktop", "edit");
    const saveBtn = page
      .getByRole("button", { name: "Opslaan & publiceren" })
      .or(page.getByRole("button", { name: /^Opslaan$/ }));
    const wasDisabled = await saveBtn.first().isDisabled().catch(() => true);

    await setEditorInteractionMode(page, "preview");
    await setEditorInteractionMode(page, "edit");

    if (wasDisabled) {
      await expect(saveBtn.first()).toBeDisabled();
    }
  });

  test("Public storefront has no edit-surface chrome (no-provider regression)", async ({ page }) => {
    await page.setViewportSize(PARITY_DESKTOP);
    await page.goto(`${STOREFRONT_ORIGIN}/`, { waitUntil: "networkidle" });
    await assertEditorChromeAbsent(page);
    await expect(page.locator("[data-cms-edit-guard]")).toHaveCount(0);
    await expect(page.locator("#home h1")).toBeVisible();
  });
});

async function relativeRect(
  target: import("@playwright/test").Locator,
  root: import("@playwright/test").Locator,
): Promise<CssRect> {
  const t = await readRect(target);
  const r = await readRect(root);
  return {
    x: t.x - r.x,
    y: t.y - r.y,
    width: t.width,
    height: t.height,
  };
}

async function relativeClosestRect(
  target: import("@playwright/test").Locator,
  root: import("@playwright/test").Locator,
  closestSelector: string,
): Promise<CssRect> {
  return target.evaluate(
    (el, args) => {
      const host = el.closest(args.closestSelector) as HTMLElement | null;
      if (!host) throw new Error(`missing closest ${args.closestSelector}`);
      // Prefer explicit root match via data attribute when present.
      const rootEl =
        (el.closest('[data-cms-section="contact.form"]') as HTMLElement | null) ??
        (el.closest("[data-cms-section], [data-cms-block-type]") as HTMLElement | null);
      if (!rootEl) throw new Error("missing section root");
      const t = host.getBoundingClientRect();
      const r = rootEl.getBoundingClientRect();
      return { x: t.x - r.x, y: t.y - r.y, width: t.width, height: t.height };
    },
    { closestSelector },
  );
}
