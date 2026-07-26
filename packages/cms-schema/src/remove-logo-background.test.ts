import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { logoBackdropFromPlateMatte } from "./infer-logo-backdrop";
import {
  cropAndNormalizeLogoMark,
  LOGO_NORMALIZE_TARGET_EDGE,
  LOGO_SHARPEN_AMOUNT_DEFAULT,
  removeSolidLogoBackground,
  resolveLogoSharpenAmount,
} from "./remove-logo-background";

function solidImage(width: number, height: number, fill: [number, number, number, number], mark?: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: [number, number, number, number];
}) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  if (mark) {
    for (let y = mark.y; y < mark.y + mark.h; y++) {
      for (let x = mark.x; x < mark.x + mark.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = mark.color[0];
        data[i + 1] = mark.color[1];
        data[i + 2] = mark.color[2];
        data[i + 3] = mark.color[3];
      }
    }
  }
  return { data, width, height };
}

function opaqueBounds(img: { data: Uint8ClampedArray; width: number; height: number }) {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]! < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

describe("removeSolidLogoBackground", () => {
  it("strips a black plate and keeps the colored mark", () => {
    const img = solidImage(40, 40, [0, 0, 0, 255], {
      x: 12,
      y: 12,
      w: 16,
      h: 16,
      color: [0, 180, 80, 255],
    });
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(result.matte).toEqual({ r: 0, g: 0, b: 0 });
    expect(logoBackdropFromPlateMatte(result.matte)).toBe("#000000");
    // Corner transparent
    expect(img.data[3]).toBe(0);
    // Mark still opaque green
    const mid = ((20 * 40 + 20) * 4);
    expect(img.data[mid + 3]).toBe(255);
    expect(img.data[mid + 1]).toBeGreaterThan(100);
  });

  it("strips a white plate", () => {
    const img = solidImage(30, 30, [255, 255, 255, 255], {
      x: 8,
      y: 8,
      w: 14,
      h: 14,
      color: [20, 20, 20, 255],
    });
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(logoBackdropFromPlateMatte(result.matte)).toBe("#ffffff");
    expect(img.data[3]).toBe(0);
    const mid = ((15 * 30 + 15) * 4);
    expect(img.data[mid + 3]).toBe(255);
  });

  it("no-ops when corners already transparent", () => {
    const img = solidImage(20, 20, [0, 0, 0, 0], {
      x: 6,
      y: 6,
      w: 8,
      h: 8,
      color: [255, 0, 0, 255],
    });
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(false);
  });

  it("strips a plate surrounded by transparent padding", () => {
    // Transparent canvas with an inset white plate and a dark mark.
    const width = 40;
    const height = 40;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 8; y < 32; y++) {
      for (let x = 8; x < 32; x++) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    for (let y = 14; y < 26; y++) {
      for (let x = 14; x < 26; x++) {
        const i = (y * width + x) * 4;
        data[i] = 10;
        data[i + 1] = 10;
        data[i + 2] = 10;
        data[i + 3] = 255;
      }
    }
    const img = { data, width, height };
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(logoBackdropFromPlateMatte(result.matte)).toBe("#ffffff");
    // Plate corner (inside former white area) transparent
    expect(img.data[((9 * 40 + 9) * 4) + 3]).toBe(0);
    // Mark remains
    expect(img.data[((20 * 40 + 20) * 4) + 3]).toBe(255);
  });

  it("does not destroy an already-stripped white mark on transparent", () => {
    const img = solidImage(40, 40, [0, 0, 0, 0], {
      x: 10,
      y: 12,
      w: 20,
      h: 16,
      color: [255, 255, 255, 255],
    });
    const before = img.data.slice();
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(false);
    expect(img.data).toEqual(before);
  });

  it("strips a bright yellow brand plate", () => {
    const img = solidImage(40, 40, [253, 241, 0, 255], {
      x: 12,
      y: 14,
      w: 16,
      h: 12,
      color: [20, 20, 20, 255],
    });
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(result.matte!.r).toBeGreaterThan(200);
    expect(result.matte!.g).toBeGreaterThan(200);
    expect(result.matte!.b).toBeLessThan(40);
    expect(img.data[3]).toBe(0);
    const mid = (20 * 40 + 20) * 4;
    expect(img.data[mid + 3]).toBe(255);
  });

  it("strips a mid-luminance mustard/ochre plate (not only bright yellow)", () => {
    // Gasterij-like plate ~#987a00 — saturated but L≈117, below the old L>=160 gate.
    const mustard: [number, number, number, number] = [152, 122, 0, 255];
    const img = solidImage(48, 32, mustard, {
      x: 14,
      y: 10,
      w: 20,
      h: 12,
      color: [10, 10, 10, 255],
    });
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(result.matte!.r).toBeGreaterThan(130);
    expect(result.matte!.r).toBeLessThan(175);
    expect(result.matte!.g).toBeGreaterThan(100);
    expect(result.matte!.b).toBeLessThan(40);
    expect(logoBackdropFromPlateMatte(result.matte)).toMatch(/^#[0-9a-f]{6}$/);
    expect(logoBackdropFromPlateMatte(result.matte)).not.toBe("#ffffff");
    expect(img.data[3]).toBe(0);
    const mid = (16 * 48 + 24) * 4;
    expect(img.data[mid + 3]).toBe(255);
  });

  it("prefers mustard plate over white side gutters and strips both", () => {
    const width = 60;
    const height = 36;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const gutter = x < 3 || x >= width - 3;
        data[i] = gutter ? 255 : 152;
        data[i + 1] = gutter ? 255 : 122;
        data[i + 2] = gutter ? 255 : 0;
        data[i + 3] = 255;
      }
    }
    // Dark mark + inset white wordmark (must survive gutter cleanup).
    for (let y = 12; y < 24; y++) {
      for (let x = 22; x < 38; x++) {
        const i = (y * width + x) * 4;
        data[i] = 15;
        data[i + 1] = 15;
        data[i + 2] = 15;
        data[i + 3] = 255;
      }
    }
    for (let y = 6; y < 10; y++) {
      for (let x = 26; x < 34; x++) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    const img = { data, width, height };
    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(result.matte!.r).toBeGreaterThan(130);
    expect(result.matte!.b).toBeLessThan(40);
    expect(logoBackdropFromPlateMatte(result.matte)).not.toBe("#ffffff");
    // Side gutters gone
    expect(img.data[3]).toBe(0);
    expect(img.data[((0 * width + (width - 1)) * 4) + 3]).toBe(0);
    // Dark mark remains
    expect(img.data[((18 * width + 30) * 4) + 3]).toBe(255);
    // Interior white wordmark remains
    expect(img.data[((8 * width + 30) * 4) + 3]).toBe(255);
    expect(img.data[(8 * width + 30) * 4]).toBe(255);
  });

  it("strips the Gasterij Oatmössche fixture (mustard plate + white gutters)", async () => {
    const fixture = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "gasterij-oatmossche.png");
    const { data, info } = await sharp(fixture).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const img = {
      data: new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    };
    const beforeCornerA = img.data[3];
    expect(beforeCornerA).toBe(255);

    const result = removeSolidLogoBackground(img);
    expect(result.changed).toBe(true);
    expect(result.matte).not.toBeNull();
    // Mustard / gold plate, not white default
    expect(result.matte!.r).toBeGreaterThan(120);
    expect(result.matte!.r).toBeLessThan(190);
    expect(result.matte!.g).toBeGreaterThan(90);
    expect(result.matte!.b).toBeLessThan(40);
    const backdrop = logoBackdropFromPlateMatte(result.matte);
    expect(backdrop).not.toBe("#ffffff");
    expect(backdrop).not.toBe("#000000");

    // Corners (former white gutters / plate) transparent
    expect(img.data[3]).toBe(0);
    expect(img.data[((0 * info.width + (info.width - 1)) * 4) + 3]).toBe(0);

    // Logo ink still present near center
    const cx = Math.floor(info.width / 2);
    const cy = Math.floor(info.height / 2);
    let opaqueNearCenter = 0;
    for (let y = cy - 20; y <= cy + 20; y++) {
      for (let x = cx - 40; x <= cx + 40; x++) {
        if (img.data[(y * info.width + x) * 4 + 3]! >= 200) opaqueNearCenter++;
      }
    }
    expect(opaqueNearCenter).toBeGreaterThan(80);

    const normalized = cropAndNormalizeLogoMark(img);
    expect(normalized).not.toBeNull();
    expect(normalized!.data[3]).toBe(0);
  });
});

describe("cropAndNormalizeLogoMark", () => {
  it("tight-crops huge transparent padding around a small mark", () => {
    const img = solidImage(100, 100, [0, 0, 0, 0], {
      x: 40,
      y: 45,
      w: 20,
      h: 10,
      color: [30, 30, 30, 255],
    });
    const result = cropAndNormalizeLogoMark(img, {
      paddingRatio: 0.1,
      targetFill: 0.82,
      minEdge: 1,
      maxEdge: 1280,
    });
    expect(result).not.toBeNull();
    expect(result!.changed).toBe(true);
    // Output should be much smaller than the padded 100×100 canvas.
    expect(result!.width).toBeLessThan(60);
    expect(result!.height).toBeLessThan(40);
    expect(result!.wasScaled).toBe(false);
    expect(result!.sharpened).toBe(false);

    const bounds = opaqueBounds(result!);
    const fillX = bounds.w / result!.width;
    const fillY = bounds.h / result!.height;
    // Mark should occupy most of the tight frame (padding ~10%).
    expect(fillX).toBeGreaterThan(0.7);
    expect(fillX).toBeLessThan(0.95);
    expect(fillY).toBeGreaterThan(0.7);
    expect(fillY).toBeLessThan(0.95);
  });

  it("normalizes after plate strip so the mark fills the frame", () => {
    const img = solidImage(80, 80, [0, 0, 0, 255], {
      x: 28,
      y: 30,
      w: 24,
      h: 20,
      color: [255, 255, 255, 255],
    });
    removeSolidLogoBackground(img);
    const result = cropAndNormalizeLogoMark(img, {
      paddingRatio: 0.1,
      targetFill: 0.8,
      minEdge: 1,
      maxEdge: 1280,
    });
    expect(result).not.toBeNull();
    const bounds = opaqueBounds(result!);
    expect(bounds.w / result!.width).toBeGreaterThan(0.65);
    expect(bounds.h / result!.height).toBeGreaterThan(0.65);
    // Corners of normalized canvas stay transparent
    expect(result!.data[3]).toBe(0);
  });

  it("upscales tiny marks to a minimum edge", () => {
    const img = solidImage(40, 40, [0, 0, 0, 0], {
      x: 16,
      y: 16,
      w: 8,
      h: 6,
      color: [10, 10, 10, 255],
    });
    const result = cropAndNormalizeLogoMark(img, { minEdge: 120, maxEdge: 120, paddingRatio: 0.1 });
    expect(result).not.toBeNull();
    expect(Math.max(result!.width, result!.height)).toBeGreaterThanOrEqual(120);
    expect(result!.wasScaled).toBe(true);
    expect(result!.scale).toBeGreaterThan(1);
    expect(result!.sharpened).toBe(true);
    expect(result!.sourceMarkTiny).toBe(true);
  });

  it("applies mild unsharp only when the mark was upscaled", () => {
    const tiny = solidImage(32, 32, [0, 0, 0, 0], {
      x: 8,
      y: 8,
      w: 16,
      h: 12,
      color: [20, 40, 80, 255],
    });
    // Checker-ish edge: half the mark a lighter tone so sharpen has contrast to work with.
    for (let y = 8; y < 20; y++) {
      for (let x = 8; x < 24; x++) {
        if (((x + y) & 1) === 0) continue;
        const i = (y * 32 + x) * 4;
        tiny.data[i] = 180;
        tiny.data[i + 1] = 200;
        tiny.data[i + 2] = 220;
      }
    }

    const up = cropAndNormalizeLogoMark(tiny, {
      minEdge: 160,
      maxEdge: 160,
      paddingRatio: 0.25,
      sharpenAmount: 0.5,
      sharpenThreshold: 1,
    });
    expect(up).not.toBeNull();
    expect(up!.wasScaled).toBe(true);
    expect(up!.scale).toBeGreaterThan(1);
    expect(up!.sharpened).toBe(true);
    // Far corner stays fully transparent (generous pad + OOB-as-transparent sampling).
    expect(up!.data[3]).toBe(0);
    expect(up!.data[((up!.height - 1) * up!.width + (up!.width - 1)) * 4 + 3]).toBe(0);

    const noSharpen = cropAndNormalizeLogoMark(tiny, {
      minEdge: 160,
      maxEdge: 160,
      paddingRatio: 0.25,
      sharpenOnUpscale: false,
    });
    expect(noSharpen!.sharpened).toBe(false);
    expect(noSharpen!.wasScaled).toBe(true);
  });

  it("does not sharpen already-large marks (downscale / 1:1)", () => {
    // Mark already near a large target — no upscale, no sharpen.
    const img = solidImage(600, 400, [0, 0, 0, 0], {
      x: 40,
      y: 40,
      w: 520,
      h: 320,
      color: [12, 12, 12, 255],
    });
    // Soft gradient band — must stay smooth (not over-sharpened).
    for (let y = 40; y < 360; y++) {
      for (let x = 40; x < 560; x++) {
        const t = (x - 40) / 520;
        const i = (y * 600 + x) * 4;
        img.data[i] = Math.round(12 + t * 80);
        img.data[i + 1] = Math.round(12 + t * 40);
        img.data[i + 2] = Math.round(12 + t * 20);
      }
    }

    const result = cropAndNormalizeLogoMark(img, {
      paddingRatio: 0.05,
      minEdge: 512,
      maxEdge: 512,
    });
    expect(result).not.toBeNull();
    expect(Math.max(result!.width, result!.height)).toBe(512);
    expect(result!.scale).toBeLessThanOrEqual(1);
    expect(result!.sharpened).toBe(false);
    expect(result!.sharpenAmountApplied).toBe(0);
    expect(result!.sourceMarkTiny).toBe(false);

    // Sample mid-gradient: values should remain smoothly ordered (no ringing spikes).
    const midY = Math.floor(result!.height / 2);
    const samples: number[] = [];
    for (let x = Math.floor(result!.width * 0.2); x < Math.floor(result!.width * 0.8); x += 8) {
      const a = result!.data[(midY * result!.width + x) * 4 + 3]!;
      if (a < 200) continue;
      samples.push(result!.data[(midY * result!.width + x) * 4]!);
    }
    expect(samples.length).toBeGreaterThan(4);
    for (let i = 1; i < samples.length; i++) {
      // Soft brand gradient: consecutive samples should not jump wildly.
      expect(Math.abs(samples[i]! - samples[i - 1]!)).toBeLessThan(40);
    }
  });

  it("defaults to a ~1024 target box for partner-card DPI", () => {
    const img = solidImage(80, 80, [0, 0, 0, 0], {
      x: 20,
      y: 24,
      w: 40,
      h: 32,
      color: [5, 5, 5, 255],
    });
    const result = cropAndNormalizeLogoMark(img, { paddingRatio: 0.1 });
    expect(result).not.toBeNull();
    expect(LOGO_NORMALIZE_TARGET_EDGE).toBe(1024);
    expect(Math.max(result!.width, result!.height)).toBe(1024);
    expect(result!.wasScaled).toBe(true);
    expect(result!.sharpened).toBe(true);
    expect(result!.scale).toBeGreaterThan(2);
    // Large jump → stepped bicubic passes.
    expect(result!.resizePasses).toBeGreaterThan(1);
    expect(result!.sharpenAmountApplied).toBeGreaterThan(LOGO_SHARPEN_AMOUNT_DEFAULT);
  });

  it("uses stepped upscale and stronger sharpen for high scale factors", () => {
    const img = solidImage(48, 48, [0, 0, 0, 0], {
      x: 18,
      y: 18,
      w: 12,
      h: 10,
      color: [30, 30, 30, 255],
    });
    // Checker contrast so unsharp has edges to work with.
    for (let y = 18; y < 28; y++) {
      for (let x = 18; x < 30; x++) {
        if (((x + y) & 1) === 0) continue;
        const i = (y * 48 + x) * 4;
        img.data[i] = 200;
        img.data[i + 1] = 200;
        img.data[i + 2] = 200;
      }
    }

    const high = cropAndNormalizeLogoMark(img, {
      paddingRatio: 0.35,
      minEdge: 512,
      maxEdge: 512,
      sharpenAmount: 0.4,
    });
    expect(high).not.toBeNull();
    expect(high!.scale).toBeGreaterThan(2.5);
    expect(high!.resizePasses).toBeGreaterThan(1);
    expect(high!.sharpened).toBe(true);
    expect(high!.sharpenAmountApplied).toBe(resolveLogoSharpenAmount(0.4, high!.scale));
    expect(high!.sharpenAmountApplied).toBeGreaterThan(0.4);
    // Far corners stay effectively clear (bicubic soft fringe may leave a≈1–2).
    expect(high!.data[3]!).toBeLessThan(8);
    expect(high!.data[((high!.height - 1) * high!.width + (high!.width - 1)) * 4 + 3]!).toBeLessThan(8);

    const mild = cropAndNormalizeLogoMark(img, {
      paddingRatio: 0.35,
      minEdge: 28,
      maxEdge: 28,
      sharpenAmount: 0.4,
    });
    expect(mild!.scale).toBeLessThan(2);
    expect(mild!.resizePasses).toBe(1);
    expect(mild!.sharpenAmountApplied).toBeLessThanOrEqual(high!.sharpenAmountApplied);
  });

  it("resolveLogoSharpenAmount scales with upscale factor", () => {
    expect(resolveLogoSharpenAmount(0.42, 1)).toBe(0);
    expect(resolveLogoSharpenAmount(0.42, 1.5)).toBe(0.42);
    expect(resolveLogoSharpenAmount(0.42, 2)).toBeCloseTo(0.42 * 1.15);
    expect(resolveLogoSharpenAmount(0.42, 3)).toBeCloseTo(0.42 * 1.35);
    expect(resolveLogoSharpenAmount(0.42, 5)).toBeCloseTo(Math.min(0.72, 0.42 * 1.55));
  });
});
