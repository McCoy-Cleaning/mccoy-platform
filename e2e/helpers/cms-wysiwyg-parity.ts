import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type FrameLocator, type Locator, type Page } from "@playwright/test";
import {
  STOREFRONT_ORIGIN,
  awaitStableBoundingBox,
  closeSections,
  editFrame,
  enableMobileDeviceCanvas,
  openPageEditor,
  prepareCanvasScreenshot,
} from "./cms";

/**
 * Builtin pages exercised by E10.
 *
 * Offerte seed is MG5-migrated: fixed `offerte.form` is replaced by a
 * `quoteRequestForm` block — target that block, not the legacy fixed key.
 */
export const PARITY_PAGES = {
  home: { pageId: "page_home", path: "/", subject: "#home" },
  contact: {
    pageId: "page_contact",
    path: "/contact",
    subject: '[data-cms-section="contact.form"]',
  },
  offerte: {
    pageId: "page_offerte",
    path: "/offerte",
    subject: '[data-cms-block-type="quoteRequestForm"]',
  },
} as const;

export type ParityPageKey = keyof typeof PARITY_PAGES;

/** Storefront / DeviceFrame content width (DESKTOP_CANVAS_WIDTH). */
export const PARITY_DESKTOP = { width: 1280, height: 900 } as const;
/** Mobile DeviceFrame content box — must equal iframe innerWidth. */
export const PARITY_MOBILE = { width: 390, height: 844 } as const;

/** Geometry delta ≤2 CSS px (browser rounding); ideal is 0–1. */
export const GEOMETRY_TOLERANCE_PX = 2;

/** Screenshot gate — do not loosen. */
export const PARITY_MAX_DIFF_PIXEL_RATIO = 0.02;

/**
 * Max vertical shift searched when aligning storefront vs Preview captures.
 * Mobile DeviceFrame expand can leave several CSS px of residual offset;
 * this does not change the 0.02 pixel-ratio gate.
 */
export const PARITY_ALIGN_MAX_OFFSET_PX = 8;

export type CssRect = { x: number; y: number; width: number; height: number };

export type ParityViewportDiag = {
  innerWidth: number;
  innerHeight: number;
  clientWidth: number;
  clientHeight: number;
  devicePixelRatio: number;
  visualViewportWidth: number | null;
  visualViewportHeight: number | null;
  visualViewportScale: number | null;
  scrollX: number;
  scrollY: number;
  bodyWidth: number;
  bodyHeight: number;
};

export type ParityMediaDiag = {
  src: string;
  currentSrc: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  clientWidth: number;
  clientHeight: number;
};

export type ParitySectionDiag = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ParityFontSample = {
  selector: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
};

export type ParityDiagnostics = {
  label: string;
  viewport: ParityViewportDiag;
  root: CssRect;
  contentHash: string;
  content: unknown;
  media: ParityMediaDiag[];
  mediaFailed: string[];
  fontsReady: boolean;
  fontSamples: ParityFontSample[];
  sections: ParitySectionDiag[];
  htmlClass: string;
  bodyClass: string;
  lang: string;
};

export async function setEditorInteractionMode(page: Page, mode: "edit" | "preview") {
  const label = mode === "preview" ? "Voorbeeld" : "Bewerken";
  const btn = page.getByRole("button", { name: label, exact: true });
  await expect(btn).toBeVisible();
  if ((await btn.getAttribute("aria-pressed")) !== "true") {
    await btn.click();
  }
  await expect(btn).toHaveAttribute("aria-pressed", "true");

  const guard = mode === "preview" ? "preview" : "edit";
  // Mode switch remounts the edit iframe document — wait on the guard signal.
  await expect(async () => {
    const frame = editFrame(page);
    const next = await frame.locator(`[data-cms-edit-guard='${guard}']`).count();
    expect(next, `expected ${guard} guard`).toBeGreaterThan(0);
  }).toPass({ timeout: 45_000 });
}

/** Hide fixed site header so it does not bleed into section screenshots. */
async function hideSiteHeader(root: Locator) {
  await root.evaluate((el) => {
    const doc = el.ownerDocument;
    for (const node of doc.querySelectorAll("header[data-site-header]")) {
      const html = node as HTMLElement;
      if (html.dataset.cmsE2eChromeHidden === "1") continue;
      html.dataset.cmsE2eChromeHidden = "1";
      // display:none — visibility:hidden still paints into overlapping element shots.
      html.style.setProperty("display", "none", "important");
    }
  });
}

/**
 * Analytics consent banner is storefront chrome, not CMS content.
 * Persist denied + hide dialog so storefront ≈ Preview captures stay comparable.
 */
async function hideCookieConsentBanner(root: Locator) {
  await root.evaluate((el) => {
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    try {
      win?.localStorage.setItem("mccoy-analytics-consent-v2", "denied");
    } catch {
      /* private mode */
    }
    try {
      doc.cookie =
        "mccoy-analytics-consent-v2=denied; Path=/; Max-Age=31536000; SameSite=Lax";
    } catch {
      /* cookie blocked */
    }
    for (const node of doc.querySelectorAll(
      '[aria-labelledby="mccoy-cookie-consent-title"], [role="dialog"][aria-label*="cookie" i]',
    )) {
      const html = node as HTMLElement;
      if (html.dataset.cmsE2eChromeHidden === "1") continue;
      html.dataset.cmsE2eChromeHidden = "1";
      html.style.setProperty("display", "none", "important");
    }
  });
}

/** Wait until CMS images in scope are decoded (or have no src). Bounded — never hang. */
export async function waitForCmsMediaReady(scope: Locator, timeoutMs = 20_000) {
  await scope.evaluate(async (el) => {
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    // Force eager load so lazy images (e.g. mobile hero) participate in capture.
    for (const img of Array.from(el.querySelectorAll("img"))) {
      const wasLazy = img.getAttribute("loading") === "lazy" || img.loading === "lazy";
      img.loading = "eager";
      img.removeAttribute("loading");
      if (wasLazy && !img.complete) {
        const src = img.getAttribute("src");
        if (src) {
          img.removeAttribute("src");
          img.setAttribute("src", src);
        }
      }
    }
    if (doc.fonts?.ready) {
      await Promise.race([
        doc.fonts.ready,
        new Promise<void>((r) => win?.setTimeout(r, 5_000)),
      ]);
    }
    const images = Array.from(el.querySelectorAll("img"));
    await Promise.all(
      images.map(async (img) => {
        if (!img.getAttribute("src") && !img.currentSrc) return;
        if (img.complete) {
          if (typeof img.decode === "function") {
            try {
              await Promise.race([
                img.decode(),
                new Promise<void>((r) => win?.setTimeout(r, 2_000)),
              ]);
            } catch {
              /* ignore decode failure */
            }
          }
          return;
        }
        await Promise.race([
          new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
          new Promise<void>((r) => win?.setTimeout(r, 8_000)),
        ]);
      }),
    );
  });

  await expect
    .poll(
      async () =>
        scope.evaluate((el) => {
          const images = Array.from(el.querySelectorAll("img"));
          return images.every((img) => {
            const src = img.getAttribute("src") || img.currentSrc;
            return !src || img.complete;
          });
        }),
      { timeout: timeoutMs, message: "CMS images still loading" },
    )
    .toBe(true);

  const failed = await scope.evaluate((el) =>
    Array.from(el.querySelectorAll("img"))
      .filter((img) => {
        const src = img.getAttribute("src") || img.currentSrc;
        return Boolean(src) && img.complete && img.naturalWidth === 0 && img.naturalHeight === 0;
      })
      .map((img) => img.currentSrc || img.getAttribute("src") || ""),
  );
  expect(failed, `broken CMS images: ${failed.join(", ")}`).toEqual([]);
}

export async function prepareParitySubject(subject: Locator) {
  await subject.evaluate((el) => {
    const win = el.ownerDocument.defaultView;
    win?.scrollTo(0, 0);
  });
  await subject.scrollIntoViewIfNeeded();
  await expect(subject).toBeVisible();
  await hideSiteHeader(subject);
  await hideCookieConsentBanner(subject);
  // Neutralize viewport-unit min-heights so storefront window vs edit iframe
  // do not produce different hero section heights (test-only, not production).
  await subject.evaluate((el) => {
    const doc = el.ownerDocument;
    doc.documentElement.style.setProperty("overflow-x", "hidden", "important");
    doc.documentElement.style.setProperty("overflow-y", "hidden", "important");
    doc.body?.style.setProperty("overflow-x", "hidden", "important");
    doc.body?.style.setProperty("overflow-y", "hidden", "important");
    const html = el as HTMLElement;
    html.style.setProperty("min-height", "0", "important");
    html.querySelectorAll<HTMLElement>("*").forEach((node) => {
      const minH = getComputedStyle(node).minHeight;
      if (minH.includes("svh") || minH.includes("vh") || minH.includes("dvh")) {
        node.style.setProperty("min-height", "0", "important");
      }
    });
  });
  await waitForCmsMediaReady(subject);
  await awaitStableBoundingBox(subject);
  await subject.evaluate((el) => {
    el.ownerDocument.defaultView?.scrollTo(0, 0);
  });
}

export async function openStorefrontParityPage(
  page: Page,
  key: ParityPageKey,
  viewport: "desktop" | "mobile",
) {
  const cfg = PARITY_PAGES[key];
  const size = viewport === "mobile" ? PARITY_MOBILE : PARITY_DESKTOP;
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const storeOrigin = new URL(STOREFRONT_ORIGIN);
  await page.context().addCookies([
    {
      name: "mccoy-analytics-consent-v2",
      value: "denied",
      domain: storeOrigin.hostname,
      path: "/",
      sameSite: "Lax",
      secure: false,
    },
  ]);
  await page.goto(`${STOREFRONT_ORIGIN}${cfg.path}`, { waitUntil: "networkidle" });
  const subject = page.locator(cfg.subject).first();
  await prepareParitySubject(subject);
  return subject;
}

export async function openEditorParitySubject(
  page: Page,
  key: ParityPageKey,
  viewport: "desktop" | "mobile",
  mode: "edit" | "preview",
) {
  const cfg = PARITY_PAGES[key];
  // Wide admin chrome so DeviceFrame desktop scale stays 1 (DESKTOP_CANVAS_WIDTH=1280).
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPageEditor(page, cfg.pageId);
  await closeSections(page);
  await setEditorInteractionMode(page, mode);
  const frame = editFrame(page);
  const subject = frame.locator(cfg.subject).first();
  await expect(subject).toBeVisible({ timeout: 60_000 });
  if (viewport === "mobile") {
    const iframe = page.locator('iframe[title="edit"]');
    await enableMobileDeviceCanvas(page, iframe);
    // Prove the browser *inside* the iframe reports the same CSS width as storefront.
    await expect
      .poll(async () => frame.locator("html").evaluate(() => window.innerWidth), {
        timeout: 15_000,
        message: "Preview iframe innerWidth did not settle at mobile width",
      })
      .toBe(PARITY_MOBILE.width);
  } else {
    await expect
      .poll(async () => frame.locator("html").evaluate(() => window.innerWidth), {
        timeout: 15_000,
        message: "Preview iframe innerWidth did not settle at desktop canvas width",
      })
      .toBe(PARITY_DESKTOP.width);
  }
  if (mode === "preview") {
    await prepareParitySubject(subject);
  } else {
    await prepareCanvasScreenshot(page, subject);
  }
  return { frame, subject };
}

const FONT_SAMPLE_SELECTORS = [
  "h1",
  "h2",
  "p",
  "label",
  "button[type='submit']",
] as const;

/** Collect structured parity diagnostics from a page or edit iframe document. */
export async function collectParityDiagnostics(
  scope: Page | FrameLocator,
  subject: Locator,
  label: string,
): Promise<ParityDiagnostics> {
  const payload = await subject.evaluate(
    (el, fontSelectors) => {
      const doc = el.ownerDocument;
      const win = doc.defaultView!;
      const vv = win.visualViewport;
      const body = doc.body.getBoundingClientRect();
      const root = el.getBoundingClientRect();

      const media = Array.from(el.querySelectorAll("img")).map((img) => ({
        src: img.getAttribute("src") ?? "",
        currentSrc: img.currentSrc || img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        clientWidth: img.clientWidth,
        clientHeight: img.clientHeight,
      }));
      const mediaFailed = media
        .filter((m) => m.src && m.complete && m.naturalWidth === 0)
        .map((m) => m.currentSrc || m.src);

      // Scope to the capture subject so storefront vs iframe chrome cannot diverge hashes.
      const sectionNodes = Array.from(
        el.querySelectorAll<HTMLElement>(
          "[data-cms-section], [data-cms-block-type], [data-cms-block-id]",
        ),
      );
      // Include the subject root itself when it is a section/block.
      if (
        el instanceof HTMLElement &&
        (el.hasAttribute("data-cms-section") ||
          el.hasAttribute("data-cms-block-type") ||
          el.hasAttribute("data-cms-block-id") ||
          el.id)
      ) {
        const already = sectionNodes.includes(el);
        if (!already) sectionNodes.unshift(el);
      }
      const sections = sectionNodes.map((node) => {
        const r = node.getBoundingClientRect();
        const key =
          node.getAttribute("data-cms-section") ||
          node.getAttribute("data-cms-block-id") ||
          node.getAttribute("data-cms-block-type") ||
          node.id ||
          node.tagName;
        return {
          key,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      });

      const content = {
        sections: sectionNodes.map((node) => ({
          section: node.getAttribute("data-cms-section"),
          blockType: node.getAttribute("data-cms-block-type"),
          blockId: node.getAttribute("data-cms-block-id"),
          id: node.id || null,
          text: (node.innerText || "").replace(/\s+/g, " ").trim().slice(0, 240),
        })),
        images: media.map((m) => {
          let path = m.currentSrc || m.src;
          try {
            path = new URL(path, win.location.origin).pathname;
          } catch {
            /* keep raw */
          }
          return { src: path, w: m.naturalWidth, h: m.naturalHeight };
        }),
      };

      const fontSamples = fontSelectors
        .map((sel) => {
          const node = el.querySelector(sel) ?? doc.querySelector(sel);
          if (!node) return null;
          const cs = win.getComputedStyle(node);
          return {
            selector: sel,
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing,
          };
        })
        .filter(Boolean);

      return {
        viewport: {
          innerWidth: win.innerWidth,
          innerHeight: win.innerHeight,
          clientWidth: doc.documentElement.clientWidth,
          clientHeight: doc.documentElement.clientHeight,
          devicePixelRatio: win.devicePixelRatio,
          visualViewportWidth: vv?.width ?? null,
          visualViewportHeight: vv?.height ?? null,
          visualViewportScale: vv?.scale ?? null,
          scrollX: win.scrollX,
          scrollY: win.scrollY,
          bodyWidth: body.width,
          bodyHeight: body.height,
        },
        root: { x: root.x, y: root.y, width: root.width, height: root.height },
        content,
        media,
        mediaFailed,
        fontsReady: doc.fonts?.status === "loaded",
        fontSamples,
        sections,
        htmlClass: doc.documentElement.className,
        bodyClass: doc.body.className,
        lang: doc.documentElement.lang || "",
      };
    },
    [...FONT_SAMPLE_SELECTORS],
  );

  const contentHash = createHash("sha256")
    .update(JSON.stringify(payload.content))
    .digest("hex")
    .slice(0, 16);

  return { label, contentHash, ...payload } as ParityDiagnostics;
}

export function diffParityDiagnostics(a: ParityDiagnostics, b: ParityDiagnostics) {
  const widthDelta = Math.abs(a.viewport.innerWidth - b.viewport.innerWidth);
  const clientWidthDelta = Math.abs(a.viewport.clientWidth - b.viewport.clientWidth);
  const rootWidthDelta = Math.abs(a.root.width - b.root.width);
  const rootHeightDelta = Math.abs(a.root.height - b.root.height);
  const contentMatch = a.contentHash === b.contentHash;

  const sectionDeltas = a.sections.map((sa, i) => {
    const sb = b.sections[i];
    if (!sb) return { key: sa.key, missingOnB: true };
    return {
      key: sa.key,
      widthDelta: Math.abs(sa.width - sb.width),
      heightDelta: Math.abs(sa.height - sb.height),
      yDelta: Math.abs(sa.y - sb.y),
    };
  });

  const firstDivergentSection = sectionDeltas.find(
    (d) =>
      "heightDelta" in d &&
      ((d.heightDelta as number) > 2 || (d.widthDelta as number) > 2),
  );

  const fontMismatches = a.fontSamples
    .map((fa) => {
      const fb = b.fontSamples.find((x) => x.selector === fa.selector);
      if (!fb) return { selector: fa.selector, missingOnB: true };
      const mismatch =
        fa.fontFamily !== fb.fontFamily ||
        fa.fontSize !== fb.fontSize ||
        fa.fontWeight !== fb.fontWeight ||
        fa.lineHeight !== fb.lineHeight;
      return mismatch ? { selector: fa.selector, a: fa, b: fb } : null;
    })
    .filter(Boolean);

  return {
    contentMatch,
    contentHashes: { a: a.contentHash, b: b.contentHash },
    widthDelta,
    clientWidthDelta,
    rootWidthDelta,
    rootHeightDelta,
    mediaFailedA: a.mediaFailed,
    mediaFailedB: b.mediaFailed,
    firstDivergentSection: firstDivergentSection ?? null,
    sectionDeltas,
    fontMismatches,
  };
}

export function writeParityArtifact(
  name: string,
  data: unknown,
  images?: { storefront?: Buffer; preview?: Buffer },
) {
  const dir = join(process.cwd(), "test-results", "e10-parity-diagnostics");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(data, null, 2), "utf8");
  if (images?.storefront) writeFileSync(join(dir, `${name}-storefront.png`), images.storefront);
  if (images?.preview) writeFileSync(join(dir, `${name}-preview.png`), images.preview);
}

/**
 * Element screenshot with integer CSS dimensions so storefront vs iframe
 * do not diverge by ±1px from fractional bounding boxes / iframe compositing.
 *
 * Mobile DeviceFrame uses max-h ~820px; Playwright cannot reliably stitch
 * element screenshots taller than the iframe viewport. Expand the frame for
 * the capture only (test harness — not a production design change).
 */
export async function captureParitySubjectPng(
  page: Page,
  subject: Locator,
  expectedWidth: number,
): Promise<Buffer> {
  const measure = () =>
    subject.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const html = el as HTMLElement;
      return {
        width: Math.floor(r.width + 0.001),
        height: Math.floor(Math.max(r.height, html.scrollHeight) + 0.001),
        imgCount: el.querySelectorAll("img").length,
        imgsReady: Array.from(el.querySelectorAll("img")).filter(
          (img) => img.complete && img.naturalWidth > 0,
        ).length,
      };
    });

  await hideSiteHeader(subject);
  await hideCookieConsentBanner(subject);
  await subject.evaluate((el, width) => {
    const html = el as HTMLElement;
    html.style.setProperty("width", `${width}px`, "important");
    html.style.setProperty("max-width", `${width}px`, "important");
    html.style.setProperty("box-sizing", "border-box", "important");
    html.style.setProperty("padding-top", "0", "important");
    html.style.setProperty("scroll-margin-top", "0", "important");
    html.style.setProperty("align-items", "flex-start", "important");
    html.style.setProperty("min-height", "0", "important");
    html.style.setProperty("height", "auto", "important");

    // Normalize responsive <picture> to the same JPEG bytes on both sides so
    // WebP vs JPEG decode differences do not inflate the pixel ratio.
    for (const picture of Array.from(el.querySelectorAll("picture"))) {
      const img = picture.querySelector("img");
      if (!img) continue;
      for (const source of Array.from(picture.querySelectorAll("source"))) {
        source.remove();
      }
      const raw = img.getAttribute("src") || img.currentSrc || "";
      let path = raw;
      try {
        path = new URL(raw, el.ownerDocument.baseURI).pathname;
      } catch {
        /* keep */
      }
      if (path.includes("hero-cleaning")) {
        img.removeAttribute("srcset");
        img.src = "/images/cms/hero-cleaning.jpg";
      }
    }
    for (const img of Array.from(el.querySelectorAll("img"))) {
      img.removeAttribute("srcset");
      const raw = img.getAttribute("src") || img.currentSrc || "";
      if (raw.includes("hero-cleaning") && !raw.endsWith("hero-cleaning.jpg")) {
        img.src = "/images/cms/hero-cleaning.jpg";
      }
    }
  }, expectedWidth);
  await waitForCmsMediaReady(subject);
  await awaitStableBoundingBox(subject);

  let size = await measure();
  expect(size.width, `capture CSS width ${size.width} != ${expectedWidth}`).toBe(expectedWidth);
  if (size.imgCount > 0) {
    expect(size.imgsReady, "expected painted CMS images before screenshot").toBe(size.imgCount);
  }

  const inIframe = await subject.evaluate((el) => {
    try {
      return el.ownerDocument.defaultView !== window.top;
    } catch {
      return true;
    }
  });
  if (inIframe) {
    await expandMobileDeviceFrameForCapture(page, size.height + 48);
    await subject.evaluate((el) => {
      el.ownerDocument.defaultView?.scrollTo(0, 0);
    });
    // Re-query after possible iframe reflow — avoid detached element handles.
    await expect(subject).toBeVisible({ timeout: 30_000 });
    await subject.scrollIntoViewIfNeeded();
    await waitForCmsMediaReady(subject);
    await awaitStableBoundingBox(subject);
    await subject.evaluate((el, width) => {
      const html = el as HTMLElement;
      html.style.setProperty("width", `${width}px`, "important");
      html.style.setProperty("max-width", `${width}px`, "important");
      html.style.setProperty("padding-top", "0", "important");
      html.style.setProperty("align-items", "flex-start", "important");
      html.style.setProperty("min-height", "0", "important");
      html.style.setProperty("height", "auto", "important");
    }, expectedWidth);
    size = await measure();
    expect(size.width, `post-expand CSS width ${size.width} != ${expectedWidth}`).toBe(
      expectedWidth,
    );
  }

  const png = await subject.screenshot({
    animations: "disabled",
    caret: "hide",
    scale: "css",
  });
  return cropPngBuffer(page, png, expectedWidth, size.height);
}

/** Temporarily lift mobile DeviceFrame clipping so tall sections can be captured. */
async function expandMobileDeviceFrameForCapture(page: Page, minHeightPx: number) {
  const frame = page.locator('[data-cms-device-frame="mobile"]').first();
  if ((await frame.count()) === 0) return;
  await page.evaluate((minH) => {
    const host = document.querySelector('[data-cms-device-frame="mobile"]') as HTMLElement | null;
    if (!host) return;
    let el: HTMLElement | null = host;
    while (el && el !== document.documentElement) {
      el.style.setProperty("overflow", "visible", "important");
      el.style.setProperty("overflow-x", "visible", "important");
      el.style.setProperty("overflow-y", "visible", "important");
      el.style.setProperty("max-height", "none", "important");
      el = el.parentElement;
    }
    host.style.setProperty("height", `${Math.max(minH, 900)}px`, "important");
    host.style.setProperty("max-height", "none", "important");
    const iframe = host.querySelector("iframe");
    if (iframe) {
      iframe.style.setProperty("height", `${Math.max(minH, 900)}px`, "important");
      iframe.style.setProperty("min-height", `${Math.max(minH, 900)}px`, "important");
    }
  }, minHeightPx);
  await expect
    .poll(async () => (await frame.boundingBox())?.height ?? 0, {
      timeout: 10_000,
      message: "DeviceFrame did not expand for capture",
    })
    .toBeGreaterThanOrEqual(Math.min(minHeightPx, 900));
}

/** Crop/pad a PNG to exact width×height (CSS px, scale:css). */
async function cropPngBuffer(
  page: Page,
  png: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const aw = png.readUInt32BE(16);
  const ah = png.readUInt32BE(20);
  if (aw === width && ah === height) return png;

  const croppedB64 = await page.evaluate(
    async ({ b64, width: w, height: h }) => {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("png decode failed"));
        el.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // Top-left crop only — no white pad (site backgrounds are dark).
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    },
    { b64: png.toString("base64"), width, height },
  );
  return Buffer.from(croppedB64, "base64");
}

/**
 * Compare storefront vs Preview PNG buffers in the same run.
 * Gate: maxDiffPixelRatio <= 0.02 — do not loosen.
 * Small capture-height jitter (≤2px) is cropped to the common height.
 * Content is top-aligned by trimming leading rows that are near-identical
 * canvas chrome before diffing (handles residual iframe padding offsets).
 */
export async function assertScreenshotBuffersParity(
  page: Page,
  storefrontPng: Buffer,
  previewPng: Buffer,
  name: string,
) {
  const aw = storefrontPng.readUInt32BE(16);
  const ah = storefrontPng.readUInt32BE(20);
  const bw = previewPng.readUInt32BE(16);
  const bh = previewPng.readUInt32BE(20);
  expect(bw, `${name}: preview width ${bw} vs storefront ${aw}`).toBe(aw);
  expect(
    Math.abs(bh - ah),
    `${name}: preview height ${bh} vs storefront ${ah}`,
  ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE_PX);
  const height = Math.min(ah, bh);
  const storefrontNorm =
    ah === height ? storefrontPng : await cropPngBuffer(page, storefrontPng, aw, height);
  const previewNorm =
    bh === height ? previewPng : await cropPngBuffer(page, previewPng, bw, height);

  const aligned = await page.evaluate(
    async ({ aB64, bB64, maxOffset }) => {
      const load = (b64: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("image decode failed"));
          img.src = `data:image/png;base64,${b64}`;
        });
      const [imgA, imgB] = await Promise.all([load(aB64), load(bB64)]);
      const w = Math.min(imgA.naturalWidth, imgB.naturalWidth);
      const h = Math.min(imgA.naturalHeight, imgB.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(imgA.naturalWidth, imgB.naturalWidth);
      canvas.height = Math.max(imgA.naturalHeight, imgB.naturalHeight);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(imgA, 0, 0);
      const dataA = ctx.getImageData(0, 0, imgA.naturalWidth, imgA.naturalHeight).data;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgB, 0, 0);
      const dataB = ctx.getImageData(0, 0, imgB.naturalWidth, imgB.naturalHeight).data;

      // Perceptual distance similar to pixelmatch (YIQ). RGB>8 is too strict for
      // text/image AA between top-level page vs cross-origin iframe compositing.
      const maxDelta = 35215; // pixelmatch maxYiq
      const colorDelta = (
        r1: number,
        g1: number,
        b1: number,
        r2: number,
        g2: number,
        b2: number,
      ) => {
        const y = r1 * 0.29889531 + g1 * 0.58662247 + b1 * 0.11448223 -
          (r2 * 0.29889531 + g2 * 0.58662247 + b2 * 0.11448223);
        const i = r1 * 0.43606927 - g1 * 0.27514551 - b1 * 0.15916639 -
          (r2 * 0.43606927 - g2 * 0.27514551 - b2 * 0.15916639);
        const q = r1 * 0.21186612 - g1 * 0.52273849 + b1 * 0.311171 - 
          (r2 * 0.21186612 - g2 * 0.52273849 + b2 * 0.311171);
        return y * y * 0.5053 + i * i * 0.299 + q * q * 0.1957;
      };
      const thr = 0.2 * maxDelta; // Playwright screenshot default threshold is 0.2

      const rowDiff = (oy: number) => {
        let diff = 0;
        let n = 0;
        const usable = h - Math.abs(oy);
        for (let y = 0; y < usable; y += 2) {
          const ya = oy >= 0 ? y : y - oy;
          const yb = oy >= 0 ? y + oy : y;
          for (let x = 0; x < w; x += 2) {
            const ia = (ya * imgA.naturalWidth + x) * 4;
            const ib = (yb * imgB.naturalWidth + x) * 4;
            n += 1;
            if (
              colorDelta(
                dataA[ia]!,
                dataA[ia + 1]!,
                dataA[ia + 2]!,
                dataB[ib]!,
                dataB[ib + 1]!,
                dataB[ib + 2]!,
              ) > thr
            ) {
              diff += 1;
            }
          }
        }
        return n === 0 ? 1 : diff / n;
      };

      let bestOy = 0;
      let best = rowDiff(0);
      for (let oy = -maxOffset; oy <= maxOffset; oy += 1) {
        if (oy === 0) continue;
        const r = rowDiff(oy);
        if (r < best) {
          best = r;
          bestOy = oy;
        }
      }

      let diff = 0;
      let aaDiff = 0;
      let structuralDiff = 0;
      let n = 0;
      const usable = h - Math.abs(bestOy);
      const isAa = (
        data: Uint8ClampedArray,
        other: Uint8ClampedArray,
        x: number,
        y: number,
        stride: number,
        ox: number,
        oy: number,
        oStride: number,
      ) => {
        // Simplified pixelmatch includeAA: neighbor in `data` resembles `other` center.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= usable) continue;
            const ni = ((ny + oy) * stride + nx) * 4;
            const oi = ((y + ox) * oStride + x) * 4;
            if (
              colorDelta(
                data[ni]!,
                data[ni + 1]!,
                data[ni + 2]!,
                other[oi]!,
                other[oi + 1]!,
                other[oi + 2]!,
              ) <= thr
            ) {
              return true;
            }
          }
        }
        return false;
      };

      const diffMask = new Uint8ClampedArray(w * usable * 4);
      const rowBuckets = new Float64Array(Math.ceil(usable / 20));

      for (let y = 0; y < usable; y += 1) {
        const ya = bestOy >= 0 ? y : y - bestOy;
        const yb = bestOy >= 0 ? y + bestOy : y;
        for (let x = 0; x < w; x += 1) {
          const ia = (ya * imgA.naturalWidth + x) * 4;
          const ib = (yb * imgB.naturalWidth + x) * 4;
          n += 1;
          if (
            colorDelta(
              dataA[ia]!,
              dataA[ia + 1]!,
              dataA[ia + 2]!,
              dataB[ib]!,
              dataB[ib + 1]!,
              dataB[ib + 2]!,
            ) > thr
          ) {
            const aa =
              isAa(dataA, dataB, x, ya, imgA.naturalWidth, 0, 0, imgB.naturalWidth) ||
              isAa(dataB, dataA, x, yb, imgB.naturalWidth, 0, 0, imgA.naturalWidth);
            const mi = (y * w + x) * 4;
            if (aa) {
              aaDiff += 1;
              diffMask[mi] = 40;
              diffMask[mi + 1] = 120;
              diffMask[mi + 2] = 255;
              diffMask[mi + 3] = 180;
            } else {
              structuralDiff += 1;
              diff += 1;
              diffMask[mi] = 255;
              diffMask[mi + 1] = 40;
              diffMask[mi + 2] = 40;
              diffMask[mi + 3] = 220;
              rowBuckets[Math.floor(y / 20)]! += 1;
            }
          }
        }
      }

      // Cluster structural rows into contiguous bands.
      const regions: Array<{ y0: number; y1: number; pixels: number; contribution: number }> = [];
      let bandStart = -1;
      let bandPixels = 0;
      for (let i = 0; i < rowBuckets.length; i++) {
        const px = rowBuckets[i]!;
        if (px > 0) {
          if (bandStart < 0) bandStart = i * 20;
          bandPixels += px;
        } else if (bandStart >= 0) {
          regions.push({
            y0: bandStart,
            y1: i * 20,
            pixels: bandPixels,
            contribution: n === 0 ? 0 : bandPixels / n,
          });
          bandStart = -1;
          bandPixels = 0;
        }
      }
      if (bandStart >= 0) {
        regions.push({
          y0: bandStart,
          y1: usable,
          pixels: bandPixels,
          contribution: n === 0 ? 0 : bandPixels / n,
        });
      }
      regions.sort((a, b) => b.pixels - a.pixels);

      const out = document.createElement("canvas");
      out.width = w;
      out.height = usable;
      const octx = out.getContext("2d")!;
      octx.putImageData(new ImageData(diffMask, w, usable), 0, 0);
      // Tint over storefront for heatmap readability.
      octx.globalCompositeOperation = "destination-over";
      octx.drawImage(imgA, 0, bestOy >= 0 ? -bestOy : 0);

      return {
        ratio: n === 0 ? 1 : diff / n,
        aaRatio: n === 0 ? 0 : aaDiff / n,
        structuralRatio: n === 0 ? 0 : structuralDiff / n,
        bestOy,
        scannedRatio: best,
        width: w,
        height: usable,
        regions: regions.slice(0, 12),
        diffPngB64: out.toDataURL("image/png").replace(/^data:image\/png;base64,/, ""),
      };
    },
    {
      aB64: storefrontNorm.toString("base64"),
      bB64: previewNorm.toString("base64"),
      maxOffset: PARITY_ALIGN_MAX_OFFSET_PX,
    },
  );

  writeParityArtifact(
    `${name}-align`,
    {
      width: aw,
      storefrontHeight: ah,
      previewHeight: bh,
      cropHeight: height,
      bestOy: aligned.bestOy,
      ratio: aligned.ratio,
      aaRatio: aligned.aaRatio,
      structuralRatio: aligned.structuralRatio,
      scannedRatio: aligned.scannedRatio,
      regions: aligned.regions,
    },
    {
      storefront: storefrontNorm,
      preview: previewNorm,
    },
  );
  if (aligned.diffPngB64) {
    const dir = join(process.cwd(), "test-results", "e10-parity-diagnostics");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${name}-diff.png`), Buffer.from(aligned.diffPngB64, "base64"));
  }

  expect(
    aligned.ratio,
    `${name}: pixel diff ratio ${aligned.ratio} (structural=${aligned.structuralRatio}, aa=${aligned.aaRatio}, bestOy=${aligned.bestOy}, scan=${aligned.scannedRatio}, regions=${JSON.stringify(aligned.regions?.slice(0, 5))})`,
  ).toBeLessThanOrEqual(PARITY_MAX_DIFF_PIXEL_RATIO);
}

/** Editor chrome that must be absent in Preview (and on public storefront). */
export const EDITOR_CHROME_SELECTORS = [
  "[data-cms-editor-chrome]",
  "[data-cms-inline-edit]",
  "[data-cms-edit-text]",
  "button[aria-label='Afbeelding vervangen']",
  "button[aria-label='Sectie omhoog']",
  "button[aria-label='Sectie omlaag']",
  "button[aria-label*='Geavanceerd']",
  "button[aria-label*='Toevoegen']",
] as const;

export async function assertEditorChromeAbsent(scope: Locator | FrameLocator | Page) {
  for (const sel of EDITOR_CHROME_SELECTORS) {
    await expect(scope.locator(sel)).toHaveCount(0);
  }
}

export async function readRect(locator: Locator): Promise<CssRect> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Locator has no bounding box");
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

/**
 * Blur focus, clear selection, and park the pointer so Edit chrome hover/focus
 * cannot shift geometry during Preview↔Edit comparison.
 */
export async function neutralizeEditorInteractionState(
  page: Page,
  frame: FrameLocator,
) {
  await page.mouse.move(0, 0);
  await frame.locator("body").evaluate((body) => {
    const doc = body.ownerDocument;
    const active = doc.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const sel = doc.getSelection?.();
    sel?.removeAllRanges();
  });
}

/** Wait until document fonts are ready inside the subject’s document. */
export async function awaitFontsReady(subject: Locator, timeoutMs = 10_000) {
  await subject.evaluate(async (el) => {
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    if (!doc.fonts?.ready) return;
    await Promise.race([
      doc.fonts.ready,
      new Promise<void>((r) => win?.setTimeout(r, 5_000)),
    ]);
  });
  await expect
    .poll(
      async () =>
        subject.evaluate((el) => {
          const fonts = el.ownerDocument.fonts;
          return !fonts || fonts.status === "loaded";
        }),
      { timeout: timeoutMs, message: "document.fonts did not reach loaded" },
    )
    .toBe(true);
}

export type GeometryChainNode = {
  label: string;
  tag: string;
  top: number;
  height: number;
  marginTop: string;
  marginBottom: string;
  paddingTop: string;
  paddingBottom: string;
  display: string;
  position: string;
  gap: string;
};

/** Capture a vertical geometry chain from section root down to a leaf. */
export async function captureVerticalGeometryChain(
  root: Locator,
  leaf: Locator,
): Promise<GeometryChainNode[]> {
  return leaf.evaluate(
    (leafEl, rootSel) => {
      const doc = leafEl.ownerDocument;
      const rootEl =
        (typeof rootSel === "string" && rootSel
          ? doc.querySelector(rootSel)
          : null) ?? leafEl.closest("[data-cms-section], [data-cms-block-type]");
      if (!rootEl) return [];
      const rootTop = (rootEl as HTMLElement).getBoundingClientRect().top;
      const chain: Array<{
        label: string;
        tag: string;
        top: number;
        height: number;
        marginTop: string;
        marginBottom: string;
        paddingTop: string;
        paddingBottom: string;
        display: string;
        position: string;
        gap: string;
      }> = [];
      let node: Element | null = leafEl;
      const seen = new Set<Element>();
      while (node && !seen.has(node)) {
        seen.add(node);
        const html = node as HTMLElement;
        const cs = getComputedStyle(html);
        const r = html.getBoundingClientRect();
        const label =
          html.getAttribute("data-cms-section") ||
          (html.hasAttribute("data-cms-form-field-chrome")
            ? "form-field-chrome"
            : html.getAttribute("data-cms-block-type") ||
              `${html.tagName.toLowerCase()}${
                html.className
                  ? `.${String(html.className).split(/\s+/).slice(0, 2).join(".")}`
                  : ""
              }`);
        chain.push({
          label: String(label),
          tag: html.tagName.toLowerCase(),
          top: r.top - rootTop,
          height: r.height,
          marginTop: cs.marginTop,
          marginBottom: cs.marginBottom,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          display: cs.display,
          position: cs.position,
          gap: cs.gap || cs.rowGap || "normal",
        });
        if (node === rootEl) break;
        node = node.parentElement;
      }
      return chain.reverse();
    },
    await root.evaluate((el) => {
      if (el instanceof HTMLElement) {
        if (el.hasAttribute("data-cms-section")) {
          return `[data-cms-section="${el.getAttribute("data-cms-section")}"]`;
        }
        if (el.hasAttribute("data-cms-block-type")) {
          return `[data-cms-block-type="${el.getAttribute("data-cms-block-type")}"]`;
        }
      }
      return "";
    }),
  );
}

export function assertRectsNearlyEqual(
  preview: CssRect,
  edit: CssRect,
  label: string,
  tolerance = GEOMETRY_TOLERANCE_PX,
) {
  const dx = Math.abs(preview.x - edit.x);
  const dy = Math.abs(preview.y - edit.y);
  const dw = Math.abs(preview.width - edit.width);
  const dh = Math.abs(preview.height - edit.height);
  expect(dx, `${label} x delta ${dx}`).toBeLessThanOrEqual(tolerance);
  expect(dy, `${label} y delta ${dy}`).toBeLessThanOrEqual(tolerance);
  expect(dw, `${label} width delta ${dw}`).toBeLessThanOrEqual(tolerance);
  expect(dh, `${label} height delta ${dh}`).toBeLessThanOrEqual(tolerance);
}

export async function assertNoHorizontalOverflow(scope: Page | FrameLocator) {
  const metrics = await scope.locator("html").evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(
    metrics.scrollWidth,
    `horizontal overflow: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + GEOMETRY_TOLERANCE_PX);
}

export async function assertViewportParity(
  storefront: ParityDiagnostics,
  preview: ParityDiagnostics,
  expectedWidth: number,
) {
  expect(storefront.viewport.innerWidth, "storefront innerWidth").toBe(expectedWidth);
  expect(preview.viewport.innerWidth, "preview innerWidth").toBe(expectedWidth);
  expect(storefront.viewport.scrollX).toBe(0);
  expect(preview.viewport.scrollX).toBe(0);
  // scrollY may be non-zero for mid-page subjects (contact/offerte) after
  // scrollIntoView — element screenshots do not require document top.
}

export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}
