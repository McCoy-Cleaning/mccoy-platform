/**
 * Remove a flat solid matte behind a logo.
 *
 * Handles two common cases:
 * 1. Plate reaches the image edges → flood from the border.
 * 2. Transparent padding around a plate → detect plate on the opaque
 *    bounding-box rim, then flood from those rim pixels.
 *
 * Complex / photographic backgrounds are left unchanged.
 */

export type LogoBackgroundRemovalOptions = {
  /** Max RGB distance from the plate color (0–441). Default 40. */
  tolerance?: number;
};

export type LogoBackgroundRemovalResult = {
  changed: boolean;
  matte: { r: number; g: number; b: number } | null;
};

/**
 * Default longer-edge target for partner logo marks.
 * PartnersSlider cards reach ~300 CSS px wide (clamp max 18.75rem) at 3:1;
 * 1024 covers ≈ display × 3× DPR so `object-contain` is not enlarging a soft bitmap.
 */
export const LOGO_NORMALIZE_TARGET_EDGE = 1024;

/** Opaque mark longer edge below this is flagged as a soft/tiny source. */
export const LOGO_NORMALIZE_TINY_MARK_EDGE = 64;

/**
 * Upscale factors above this use stepped (~2×) bicubic passes instead of one jump.
 */
export const LOGO_UPSCALE_STEP_THRESHOLD = 2;

/** Default unsharp amount before scale-dependent boost (0–1). */
export const LOGO_SHARPEN_AMOUNT_DEFAULT = 0.42;

export type LogoNormalizeOptions = {
  /**
   * Extra transparent padding around the opaque mark, as a fraction of
   * max(mark width, mark height). Default derived from {@link targetFill}.
   */
  paddingRatio?: number;
  /**
   * How much of the output frame the padded mark should occupy along each
   * axis (0.7–0.85 recommended). Default 0.82. Used to derive padding when
   * {@link paddingRatio} is omitted.
   */
  targetFill?: number;
  /**
   * Cap on the longer output edge. Default {@link LOGO_NORMALIZE_TARGET_EDGE}
   * so marks fit a consistent ~1024 long-edge box.
   */
  maxEdge?: number;
  /**
   * Upscale small marks so the longer edge is at least this.
   * Default {@link LOGO_NORMALIZE_TARGET_EDGE} (raised for retina partner cards).
   */
  minEdge?: number;
  /** Alpha threshold for “opaque” content. Default 16. */
  alphaThreshold?: number;
  /**
   * Mild unsharp mask after upscale only. Default true.
   * Downscales and 1:1 copies never sharpen.
   */
  sharpenOnUpscale?: boolean;
  /**
   * Base unsharp amount (0–1). Default {@link LOGO_SHARPEN_AMOUNT_DEFAULT}.
   * Effective amount grows with upscale factor (still capped).
   */
  sharpenAmount?: number;
  /** Unsharp luminance threshold (0–255). Default 4. */
  sharpenThreshold?: number;
};

export type LogoNormalizeResult = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** True when the canvas was cropped or recentered vs the input. */
  changed: boolean;
  markBounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Output long-edge scale vs the 1:1 padded crop (>1 = upscaled). */
  scale: number;
  /** True when bicubic resize changed dimensions vs the padded crop. */
  wasScaled: boolean;
  /** True when a mild unsharp mask was applied (upscale path only). */
  sharpened: boolean;
  /** Unsharp amount actually applied (0 when not sharpened). */
  sharpenAmountApplied: number;
  /** Bicubic passes used for the resize (1 = single pass; >1 = stepped upscale). */
  resizePasses: number;
  /**
   * True when the opaque mark’s longer edge was below
   * {@link LOGO_NORMALIZE_TINY_MARK_EDGE} — upscale cannot invent detail.
   */
  sourceMarkTiny: boolean;
};

type Rgba = { r: number; g: number; b: number; a: number };

function colorDist(a: Rgba, b: Pick<Rgba, "r" | "g" | "b">): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function lum(c: Pick<Rgba, "r" | "g" | "b">): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

function sat(c: Pick<Rgba, "r" | "g" | "b">): number {
  const mx = Math.max(c.r, c.g, c.b);
  const mn = Math.min(c.r, c.g, c.b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

function isPlateLike(c: Pick<Rgba, "r" | "g" | "b">): boolean {
  const L = lum(c);
  const S = sat(c);
  // Near black or near white.
  if (L <= 48 || L >= 220) return true;
  // Flat charcoal / light-grey mats only — not mid-tone unsaturated logo ink.
  if (S <= 0.12 && (L <= 55 || L >= 190)) return true;
  // Saturated brand plates at any luminance (bright Steggink yellow, mid
  // mustard/ochre/gold, deep brand blues/reds). Mid-tone ink alone is rarely
  // this saturated across a majority plate share.
  if (S >= 0.4) return true;
  return false;
}

type PlateCandidate = { r: number; g: number; b: number; share: number };

/**
 * Prefer a clear majority saturated plate over a B/W rim that is only a
 * thin print margin (white side gutters around a colored plate).
 */
function pickPlateCandidate(
  rim: PlateCandidate | null,
  dominant: PlateCandidate | null,
): PlateCandidate | null {
  if (!rim) return dominant;
  if (!dominant) return rim;
  const rimL = lum(rim);
  const rimIsBwMat = sat(rim) <= 0.12 || rimL <= 48 || rimL >= 220;
  const domIsSaturated = sat(dominant) >= 0.4;
  if (rimIsBwMat && domIsSaturated && dominant.share >= 0.35) {
    return dominant;
  }
  return rim;
}

/**
 * After the brand plate is gone, erase thin white/black print margins still
 * connected to the image border. Transparent gaps keep interior white/black
 * wordmarks (e.g. “GASTERIJ”) from being flood-deleted.
 */
function stripBorderGutters(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const isGutter = (p: Rgba) => {
    if (p.a < 200) return false;
    const L = lum(p);
    const S = sat(p);
    return S <= 0.12 && (L <= 48 || L >= 220);
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    const p = readPixel(data, width, x, y);
    if (!isGutter(p)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = (idx / width) | 0;
    writeTransparent(data, width, x, y);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function readPixel(data: Uint8ClampedArray, width: number, x: number, y: number): Rgba {
  const i = (y * width + x) * 4;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
}

function writeTransparent(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  data[i + 3] = 0;
}

function opaqueBBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 200,
) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (readPixel(data, width, x, y).a < alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

/** Catmull-Rom cubic kernel (a = −0.5). */
function cubicKernel(t: number): number {
  const a = -0.5;
  const x = Math.abs(t);
  if (x <= 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return ((a * x - 5 * a) * x + 8 * a) * x - 4 * a;
  return 0;
}

function sampleAt(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): Rgba {
  // Outside the buffer = transparent (do not clamp — that bleeds mark ink into pads).
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  return readPixel(data, width, x, y);
}

/**
 * Bicubic sample with premultiplied alpha so transparent padding does not
 * bleed dark fringes into the mark.
 */
function sampleBicubic(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): Rgba {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let j = -1; j <= 2; j++) {
    const wy = cubicKernel(y - (y0 + j));
    for (let i = -1; i <= 2; i++) {
      const w = wy * cubicKernel(x - (x0 + i));
      if (w === 0) continue;
      const p = sampleAt(data, width, height, x0 + i, y0 + j);
      const pa = p.a / 255;
      r += p.r * pa * w;
      g += p.g * pa * w;
      b += p.b * pa * w;
      a += p.a * w;
    }
  }
  if (a <= 0.5) return { r: 0, g: 0, b: 0, a: 0 };
  const inv = 255 / a;
  return {
    r: Math.min(255, Math.max(0, Math.round(r * inv))),
    g: Math.min(255, Math.max(0, Math.round(g * inv))),
    b: Math.min(255, Math.max(0, Math.round(b * inv))),
    a: Math.min(255, Math.max(0, Math.round(a))),
  };
}

/**
 * High-quality resize (bicubic). Identity when dimensions match.
 */
function resizeRgbaBicubic(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8ClampedArray {
  if (srcW === dstW && srcH === dstH) {
    return new Uint8ClampedArray(src);
  }
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  for (let dy = 0; dy < dstH; dy++) {
    const sy = ((dy + 0.5) / dstH) * srcH - 0.5;
    for (let dx = 0; dx < dstW; dx++) {
      const sx = ((dx + 0.5) / dstW) * srcW - 0.5;
      const p = sampleBicubic(src, srcW, srcH, sx, sy);
      const oi = (dy * dstW + dx) * 4;
      out[oi] = p.r;
      out[oi + 1] = p.g;
      out[oi + 2] = p.b;
      out[oi + 3] = p.a;
    }
  }
  return out;
}

/**
 * Bicubic resize with stepped ~2× upscales when the scale factor is large.
 * Large single jumps tend to look softer/blockier than intermediate passes.
 */
function resizeRgbaBicubicStepped(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { data: Uint8ClampedArray; passes: number } {
  if (srcW === dstW && srcH === dstH) {
    return { data: new Uint8ClampedArray(src), passes: 0 };
  }

  const scale = Math.max(dstW / srcW, dstH / srcH);
  if (scale <= LOGO_UPSCALE_STEP_THRESHOLD) {
    return { data: resizeRgbaBicubic(src, srcW, srcH, dstW, dstH), passes: 1 };
  }

  let cur = src;
  let cw = srcW;
  let ch = srcH;
  let passes = 0;
  // Cap iterations so pathological targets cannot loop forever.
  for (let i = 0; i < 8; i++) {
    const remain = Math.max(dstW / cw, dstH / ch);
    if (remain <= LOGO_UPSCALE_STEP_THRESHOLD) break;
    const nw = Math.min(dstW, Math.max(cw + 1, Math.round(cw * LOGO_UPSCALE_STEP_THRESHOLD)));
    const nh = Math.min(dstH, Math.max(ch + 1, Math.round(ch * LOGO_UPSCALE_STEP_THRESHOLD)));
    if (nw === cw && nh === ch) break;
    cur = resizeRgbaBicubic(cur, cw, ch, nw, nh);
    cw = nw;
    ch = nh;
    passes++;
    if (cw === dstW && ch === dstH) {
      return { data: cur, passes };
    }
  }
  if (cw !== dstW || ch !== dstH) {
    cur = resizeRgbaBicubic(cur, cw, ch, dstW, dstH);
    passes++;
  }
  return { data: cur, passes: Math.max(1, passes) };
}

/**
 * Scale-dependent unsharp: stronger when the mark was stretched a lot,
 * still capped so soft brand gradients do not ring.
 */
export function resolveLogoSharpenAmount(baseAmount: number, scale: number): number {
  if (baseAmount <= 0 || scale <= 1) return 0;
  let factor = 1;
  if (scale >= 4) factor = 1.55;
  else if (scale >= 2.5) factor = 1.35;
  else if (scale >= 1.75) factor = 1.15;
  return Math.min(0.72, baseAmount * factor);
}

/**
 * Mild unsharp mask on RGB only (alpha preserved). Separable 3-tap blur.
 * Skips near-transparent pixels so soft brand edges stay clean.
 */
function applyMildUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
  threshold: number,
): void {
  if (amount <= 0 || width < 3 || height < 3) return;
  const blur = new Float32Array(width * height * 3);
  // Horizontal pass → temporary in blur channels; vertical into same buffer.
  const tmp = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      if (a < 8) continue;
      const xl = Math.max(0, x - 1);
      const xr = Math.min(width - 1, x + 1);
      const il = (y * width + xl) * 4;
      const ir = (y * width + xr) * 4;
      const ti = (y * width + x) * 3;
      tmp[ti] = (data[il]! + data[i]! * 2 + data[ir]!) * 0.25;
      tmp[ti + 1] = (data[il + 1]! + data[i + 1]! * 2 + data[ir + 1]!) * 0.25;
      tmp[ti + 2] = (data[il + 2]! + data[i + 2]! * 2 + data[ir + 2]!) * 0.25;
    }
  }
  for (let y = 0; y < height; y++) {
    const yu = Math.max(0, y - 1);
    const yd = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! < 8) continue;
      const ti = (y * width + x) * 3;
      const tu = (yu * width + x) * 3;
      const td = (yd * width + x) * 3;
      blur[ti] = (tmp[tu]! + tmp[ti]! * 2 + tmp[td]!) * 0.25;
      blur[ti + 1] = (tmp[tu + 1]! + tmp[ti + 1]! * 2 + tmp[td + 1]!) * 0.25;
      blur[ti + 2] = (tmp[tu + 2]! + tmp[ti + 2]! * 2 + tmp[td + 2]!) * 0.25;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! < 8) continue;
      const ti = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        const orig = data[i + c]!;
        const diff = orig - blur[ti + c]!;
        if (Math.abs(diff) < threshold) continue;
        data[i + c] = Math.min(255, Math.max(0, Math.round(orig + amount * diff)));
      }
    }
  }
}

/**
 * Tight-crop opaque logo content so the mark fills a consistent fraction of
 * the frame, then bicubic-resize into a ~1024 long-edge target box. Large
 * upscales use stepped passes and scale-dependent unsharp; plate strip /
 * Dominee–Steggink detection is unchanged.
 */
export function cropAndNormalizeLogoMark(
  imageData: Pick<ImageData, "data" | "width" | "height">,
  options?: LogoNormalizeOptions,
): LogoNormalizeResult | null {
  const targetFill = Math.min(0.95, Math.max(0.5, options?.targetFill ?? 0.82));
  // Derive padding from target fill when paddingRatio omitted:
  // mark / (mark + 2pad) ≈ targetFill → pad ≈ mark * (1 - fill) / (2 * fill)
  const paddingRatio =
    options?.paddingRatio ?? Math.max(0.02, (1 - targetFill) / (2 * targetFill));
  const maxEdge = options?.maxEdge ?? LOGO_NORMALIZE_TARGET_EDGE;
  const minEdge = options?.minEdge ?? LOGO_NORMALIZE_TARGET_EDGE;
  const alphaThreshold = options?.alphaThreshold ?? 16;
  const sharpenOnUpscale = options?.sharpenOnUpscale !== false;
  const sharpenAmount = options?.sharpenAmount ?? LOGO_SHARPEN_AMOUNT_DEFAULT;
  const sharpenThreshold = options?.sharpenThreshold ?? 4;
  const { data, width, height } = imageData;

  const bbox = opaqueBBox(data, width, height, alphaThreshold);
  if (!bbox) return null;

  const markW = bbox.maxX - bbox.minX + 1;
  const markH = bbox.maxY - bbox.minY + 1;
  const sourceMarkTiny = Math.max(markW, markH) < LOGO_NORMALIZE_TINY_MARK_EDGE;
  // Pad from the shorter edge so wide wordmarks don't gain huge vertical empty space.
  const pad = Math.max(1, Math.round(Math.min(markW, markH) * paddingRatio));

  // 1:1 padded crop (no resampling yet).
  const contentW = markW + pad * 2;
  const contentH = markH + pad * 2;
  const cropped = new Uint8ClampedArray(contentW * contentH * 4);
  const srcOriginX = bbox.minX - pad;
  const srcOriginY = bbox.minY - pad;
  for (let dy = 0; dy < contentH; dy++) {
    for (let dx = 0; dx < contentW; dx++) {
      const sx = srcOriginX + dx;
      const sy = srcOriginY + dy;
      const oi = (dy * contentW + dx) * 4;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
        cropped[oi + 3] = 0;
        continue;
      }
      const si = (sy * width + sx) * 4;
      cropped[oi] = data[si]!;
      cropped[oi + 1] = data[si + 1]!;
      cropped[oi + 2] = data[si + 2]!;
      cropped[oi + 3] = data[si + 3]!;
    }
  }

  // Fit longer edge into [minEdge, maxEdge] — default both 1024 for a consistent box.
  const longEdge = Math.max(contentW, contentH);
  let scale = 1;
  if (longEdge < minEdge) {
    scale = minEdge / longEdge;
  }
  if (longEdge * scale > maxEdge) {
    scale = maxEdge / longEdge;
  }
  const outW = Math.max(1, Math.round(contentW * scale));
  const outH = Math.max(1, Math.round(contentH * scale));
  const wasScaled = outW !== contentW || outH !== contentH;

  const resized = resizeRgbaBicubicStepped(cropped, contentW, contentH, outW, outH);
  const out = resized.data;
  const resizePasses = resized.passes;
  const sharpenAmountApplied =
    wasScaled && scale > 1 && sharpenOnUpscale
      ? resolveLogoSharpenAmount(sharpenAmount, scale)
      : 0;
  const sharpened = sharpenAmountApplied > 0;
  if (sharpened) {
    applyMildUnsharpMask(out, outW, outH, sharpenAmountApplied, sharpenThreshold);
  }

  const changed =
    outW !== width ||
    outH !== height ||
    wasScaled ||
    bbox.minX > 1 ||
    bbox.minY > 1 ||
    bbox.maxX < width - 2 ||
    bbox.maxY < height - 2;

  return {
    data: out,
    width: outW,
    height: outH,
    changed,
    markBounds: bbox,
    scale,
    wasScaled,
    sharpened,
    sharpenAmountApplied,
    resizePasses,
    sourceMarkTiny,
  };
}

function quantKey(c: Pick<Rgba, "r" | "g" | "b">): string {
  return `${c.r >> 3},${c.g >> 3},${c.b >> 3}`;
}

/**
 * Dominant color along the opaque bounding-box rim (the plate, not the mark).
 */
function detectRimPlate(
  data: Uint8ClampedArray,
  width: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): PlateCandidate | null {
  const hist = new Map<string, { n: number; r: number; g: number; b: number }>();
  let rimCount = 0;
  const add = (x: number, y: number) => {
    const p = readPixel(data, width, x, y);
    if (p.a < 200) return;
    rimCount++;
    const key = quantKey(p);
    const e = hist.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += p.r;
    e.g += p.g;
    e.b += p.b;
    hist.set(key, e);
  };

  const { minX, minY, maxX, maxY } = bbox;
  for (let x = minX; x <= maxX; x++) {
    add(x, minY);
    add(x, maxY);
    if (minY + 1 <= maxY) add(x, minY + 1);
    if (maxY - 1 >= minY) add(x, maxY - 1);
  }
  for (let y = minY; y <= maxY; y++) {
    add(minX, y);
    add(maxX, y);
    if (minX + 1 <= maxX) add(minX + 1, y);
    if (maxX - 1 >= minX) add(maxX - 1, y);
  }

  if (rimCount < 8) return null;
  const top = [...hist.values()].sort((a, b) => b.n - a.n)[0];
  if (!top) return null;
  const plate = {
    r: Math.round(top.r / top.n),
    g: Math.round(top.g / top.n),
    b: Math.round(top.b / top.n),
    share: top.n / rimCount,
  };
  if (plate.share < 0.22 || !isPlateLike(plate)) return null;
  return plate;
}

/**
 * Fallback: dominant opaque color if it looks like a flat plate.
 */
function detectDominantPlate(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): PlateCandidate | null {
  const hist = new Map<string, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = readPixel(data, width, x, y);
      if (p.a < 200) continue;
      opaque++;
      const key = quantKey(p);
      const e = hist.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      e.n++;
      e.r += p.r;
      e.g += p.g;
      e.b += p.b;
      hist.set(key, e);
    }
  }
  if (opaque < 16) return null;
  const top = [...hist.values()].sort((a, b) => b.n - a.n)[0];
  if (!top) return null;
  const plate = {
    r: Math.round(top.r / top.n),
    g: Math.round(top.g / top.n),
    b: Math.round(top.b / top.n),
    share: top.n / opaque,
  };
  // Strong majority plate (e.g. charcoal logo cards).
  if (plate.share >= 0.4 && isPlateLike(plate)) return plate;
  // Near-black / near-white plates can be a smaller share but still clear.
  const L = lum(plate);
  if (plate.share >= 0.25 && (L <= 40 || L >= 230)) return plate;
  return null;
}

function floodRemovePlate(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  matte: Pick<Rgba, "r" | "g" | "b">,
  seeds: Array<{ x: number; y: number }>,
  tolerance: number,
): boolean {
  const matches = (x: number, y: number) => {
    const p = readPixel(data, width, x, y);
    if (p.a < 16) return false;
    return colorDist(p, matte) <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    if (!matches(x, y)) return;
    visited[idx] = 1;
    stack.push(idx);
  };

  for (const s of seeds) push(s.x, s.y);

  let changed = false;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % width;
    const y = (idx / width) | 0;
    writeTransparent(data, width, x, y);
    changed = true;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  if (changed) {
    const fringeTol = tolerance * 1.35;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = readPixel(data, width, x, y);
        if (p.a < 16 || p.a === 255) continue;
        if (colorDist(p, matte) <= fringeTol) writeTransparent(data, width, x, y);
      }
    }
  }

  return changed;
}

function countOpaque(data: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! >= 16) n++;
  }
  return n;
}

/**
 * True when the bbox interior contains a real mark distinct from the plate.
 * White plates require dark ink; black plates require light ink — this avoids
 * deleting already-stripped white wordmarks that only have colored accents.
 */
function interiorDiffersFromPlate(
  data: Uint8ClampedArray,
  width: number,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  plate: Pick<Rgba, "r" | "g" | "b">,
  tolerance: number,
): boolean {
  const bw = bbox.maxX - bbox.minX + 1;
  const bh = bbox.maxY - bbox.minY + 1;
  const x0 = bbox.minX + Math.floor(bw * 0.15);
  const x1 = bbox.maxX - Math.floor(bw * 0.15);
  const y0 = bbox.minY + Math.floor(bh * 0.15);
  const y1 = bbox.maxY - Math.floor(bh * 0.15);
  let plateLike = 0;
  let other = 0;
  let darkOther = 0;
  let lightOther = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = readPixel(data, width, x, y);
      if (p.a < 200) continue;
      if (colorDist(p, plate) <= tolerance) {
        plateLike++;
        continue;
      }
      other++;
      const L = lum(p);
      if (L <= 120) darkOther++;
      if (L >= 160) lightOther++;
    }
  }
  if (other < 16) return false;
  const plateL = lum(plate);
  // Near-white plates need dark ink (avoids deleting white wordmarks with red accents).
  if (plateL >= 230) return darkOther >= 16;
  // Near-black plates: any non-plate mark (white, green, etc.).
  if (plateL <= 50) return other >= 16;
  // Colored plates (e.g. Steggink yellow): need a contrasting mark.
  return darkOther >= 16 || other > plateLike * 0.06;
}

/**
 * In-place: erase the solid matte from `imageData` (alpha → 0).
 * Skips when the candidate plate matches the mark interior (already-stripped
 * logos) so ink is not deleted.
 */
export function removeSolidLogoBackground(
  imageData: Pick<ImageData, "data" | "width" | "height">,
  options?: LogoBackgroundRemovalOptions,
): LogoBackgroundRemovalResult {
  const tolerance = options?.tolerance ?? 40;
  const { data, width, height } = imageData;
  if (width < 2 || height < 2) return { changed: false, matte: null };

  const bbox = opaqueBBox(data, width, height);
  if (!bbox) return { changed: false, matte: null };

  const plate = pickPlateCandidate(
    detectRimPlate(data, width, bbox),
    detectDominantPlate(data, width, height),
  );
  if (!plate) return { changed: false, matte: null };

  if (!interiorDiffersFromPlate(data, width, bbox, plate, tolerance)) {
    return { changed: false, matte: null };
  }

  // Saturated plates often have pale anti-aliased rims far from the fill.
  const effectiveTolerance = sat(plate) >= 0.4 ? Math.max(tolerance, 90) : tolerance;

  const seeds: Array<{ x: number; y: number }> = [];
  const maybeSeed = (x: number, y: number) => {
    const p = readPixel(data, width, x, y);
    if (p.a < 200) return;
    if (colorDist(p, plate) <= effectiveTolerance) seeds.push({ x, y });
  };

  // Seed from image border (case 1) and opaque bbox rim (case 2).
  for (let x = 0; x < width; x++) {
    maybeSeed(x, 0);
    maybeSeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    maybeSeed(0, y);
    maybeSeed(width - 1, y);
  }
  for (let x = bbox.minX; x <= bbox.maxX; x++) {
    maybeSeed(x, bbox.minY);
    maybeSeed(x, bbox.maxY);
  }
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    maybeSeed(bbox.minX, y);
    maybeSeed(bbox.maxX, y);
  }

  // Colored plates inset from white print margins: also seed from interior
  // plate pixels near the opaque bbox so flood can start when the image
  // border itself is only the gutter color.
  if (sat(plate) >= 0.4 && seeds.length === 0) {
    const stepX = Math.max(1, Math.floor((bbox.maxX - bbox.minX) / 24));
    const stepY = Math.max(1, Math.floor((bbox.maxY - bbox.minY) / 24));
    for (let y = bbox.minY; y <= bbox.maxY; y += stepY) {
      for (let x = bbox.minX; x <= bbox.maxX; x += stepX) {
        maybeSeed(x, y);
      }
    }
  }

  if (seeds.length === 0) return { changed: false, matte: null };

  const opaqueBefore = countOpaque(data);
  const snapshot = new Uint8ClampedArray(data);
  const changed = floodRemovePlate(data, width, height, plate, seeds, effectiveTolerance);
  if (!changed) return { changed: false, matte: null };

  // Absolute wipeout guard.
  if (countOpaque(data) < 8 && opaqueBefore >= 8) {
    data.set(snapshot);
    return { changed: false, matte: null };
  }

  stripBorderGutters(data, width, height);

  // If gutter cleanup ate the mark, roll back entirely.
  if (countOpaque(data) < 8 && opaqueBefore >= 8) {
    data.set(snapshot);
    return { changed: false, matte: null };
  }

  return {
    changed: true,
    matte: { r: plate.r, g: plate.g, b: plate.b },
  };
}
