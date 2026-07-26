/**
 * Strip solid logo plates from storefront public partner PNGs, then tight-crop
 * and normalize mark fill (one-time / re-runnable).
 *
 * Usage:
 *   node scripts/strip-partner-logo-backgrounds.mjs
 *   PARTNER_LOGO_ONLY=steggink,laurens node scripts/strip-partner-logo-backgrounds.mjs
 *
 * Laurens: white card + white mark → bake a tight black plate so the mark
 * stays visible on the white partner card.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "../apps/storefront/public/images/partners");

function colorDist(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
function lum(c) {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}
function sat(c) {
  const mx = Math.max(c.r, c.g, c.b);
  const mn = Math.min(c.r, c.g, c.b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
function isPlateLike(c) {
  const L = lum(c);
  const S = sat(c);
  if (L <= 48 || L >= 220) return true;
  if (S <= 0.12 && (L <= 55 || L >= 190)) return true;
  if (L >= 160 && S >= 0.5) return true;
  return false;
}
function readPixel(data, width, x, y) {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}
function writeTransparent(data, width, x, y) {
  data[(y * width + x) * 4 + 3] = 0;
}
function opaqueBBox(data, width, height, alphaThreshold = 200) {
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
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
function detectRimPlate(data, width, bbox) {
  const hist = new Map();
  let rimCount = 0;
  const add = (x, y) => {
    const p = readPixel(data, width, x, y);
    if (p.a < 200) return;
    rimCount++;
    const key = `${p.r >> 3},${p.g >> 3},${p.b >> 3}`;
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
function detectDominantPlate(data, width, height) {
  const hist = new Map();
  let opaque = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = readPixel(data, width, x, y);
      if (p.a < 200) continue;
      opaque++;
      const key = `${p.r >> 3},${p.g >> 3},${p.b >> 3}`;
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
  if (plate.share >= 0.4 && isPlateLike(plate)) return plate;
  const L = lum(plate);
  if (plate.share >= 0.25 && (L <= 40 || L >= 230)) return plate;
  return null;
}
function removeSolidLogoBackground(imageData, options = {}) {
  const tolerance = options.tolerance ?? 40;
  const { data, width, height } = imageData;
  if (width < 2 || height < 2) return { changed: false, matte: null };
  const bbox = opaqueBBox(data, width, height);
  if (!bbox) return { changed: false, matte: null };
  const plate = detectRimPlate(data, width, bbox) ?? detectDominantPlate(data, width, height);
  if (!plate) return { changed: false, matte: null };

  // Interior must differ from plate (skip already-stripped marks).
  {
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
    const plateL = lum(plate);
    let ok = false;
    if (other >= 16) {
      if (plateL >= 230) ok = darkOther >= 16;
      else if (plateL <= 50) ok = true;
      else ok = darkOther >= 16 || other > plateLike * 0.06;
    }
    if (!ok) return { changed: false, matte: null };
  }

  const seeds = [];
  const maybeSeed = (x, y) => {
    const p = readPixel(data, width, x, y);
    if (p.a < 200) return;
    if (colorDist(p, plate) <= tolerance) seeds.push({ x, y });
  };
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
  if (!seeds.length) return { changed: false, matte: null };

  let opaqueBefore = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] >= 16) opaqueBefore++;
  const snapshot = new Uint8ClampedArray(data);

  const matches = (x, y) => {
    const p = readPixel(data, width, x, y);
    if (p.a < 16) return false;
    return colorDist(p, plate) <= tolerance;
  };
  const visited = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
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
    const idx = stack.pop();
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
        if (colorDist(p, plate) <= fringeTol) writeTransparent(data, width, x, y);
      }
    }
  }
  if (!changed) return { changed: false, matte: null };
  let opaqueAfter = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] >= 16) opaqueAfter++;
  if (opaqueAfter < 8 && opaqueBefore >= 8) {
    data.set(snapshot);
    return { changed: false, matte: null };
  }
  return { changed: true, matte: { r: plate.r, g: plate.g, b: plate.b } };
}

function cubicKernel(t) {
  const a = -0.5;
  const x = Math.abs(t);
  if (x <= 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return ((a * x - 5 * a) * x + 8 * a) * x - 4 * a;
  return 0;
}

function sampleAt(data, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return { r: 0, g: 0, b: 0, a: 0 };
  return readPixel(data, width, x, y);
}

function sampleBicubic(data, width, height, x, y) {
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

function resizeRgbaBicubic(src, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return new Uint8ClampedArray(src);
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

const LOGO_UPSCALE_STEP_THRESHOLD = 2;

function resizeRgbaBicubicStepped(src, srcW, srcH, dstW, dstH) {
  if (srcW === dstW && srcH === dstH) return new Uint8ClampedArray(src);
  const scale = Math.max(dstW / srcW, dstH / srcH);
  if (scale <= LOGO_UPSCALE_STEP_THRESHOLD) {
    return resizeRgbaBicubic(src, srcW, srcH, dstW, dstH);
  }
  let cur = src;
  let cw = srcW;
  let ch = srcH;
  for (let i = 0; i < 8; i++) {
    const remain = Math.max(dstW / cw, dstH / ch);
    if (remain <= LOGO_UPSCALE_STEP_THRESHOLD) break;
    const nw = Math.min(dstW, Math.max(cw + 1, Math.round(cw * LOGO_UPSCALE_STEP_THRESHOLD)));
    const nh = Math.min(dstH, Math.max(ch + 1, Math.round(ch * LOGO_UPSCALE_STEP_THRESHOLD)));
    if (nw === cw && nh === ch) break;
    cur = resizeRgbaBicubic(cur, cw, ch, nw, nh);
    cw = nw;
    ch = nh;
    if (cw === dstW && ch === dstH) return cur;
  }
  if (cw !== dstW || ch !== dstH) {
    cur = resizeRgbaBicubic(cur, cw, ch, dstW, dstH);
  }
  return cur;
}

function resolveLogoSharpenAmount(baseAmount, scale) {
  if (baseAmount <= 0 || scale <= 1) return 0;
  let factor = 1;
  if (scale >= 4) factor = 1.55;
  else if (scale >= 2.5) factor = 1.35;
  else if (scale >= 1.75) factor = 1.15;
  return Math.min(0.72, baseAmount * factor);
}

function applyMildUnsharpMask(data, width, height, amount, threshold) {
  if (amount <= 0 || width < 3 || height < 3) return;
  const blur = new Float32Array(width * height * 3);
  const tmp = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue;
      const xl = Math.max(0, x - 1);
      const xr = Math.min(width - 1, x + 1);
      const il = (y * width + xl) * 4;
      const ir = (y * width + xr) * 4;
      const ti = (y * width + x) * 3;
      tmp[ti] = (data[il] + data[i] * 2 + data[ir]) * 0.25;
      tmp[ti + 1] = (data[il + 1] + data[i + 1] * 2 + data[ir + 1]) * 0.25;
      tmp[ti + 2] = (data[il + 2] + data[i + 2] * 2 + data[ir + 2]) * 0.25;
    }
  }
  for (let y = 0; y < height; y++) {
    const yu = Math.max(0, y - 1);
    const yd = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue;
      const ti = (y * width + x) * 3;
      const tu = (yu * width + x) * 3;
      const td = (yd * width + x) * 3;
      blur[ti] = (tmp[tu] + tmp[ti] * 2 + tmp[td]) * 0.25;
      blur[ti + 1] = (tmp[tu + 1] + tmp[ti + 1] * 2 + tmp[td + 1]) * 0.25;
      blur[ti + 2] = (tmp[tu + 2] + tmp[ti + 2] * 2 + tmp[td + 2]) * 0.25;
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue;
      const ti = (y * width + x) * 3;
      for (let c = 0; c < 3; c++) {
        const orig = data[i + c];
        const diff = orig - blur[ti + c];
        if (Math.abs(diff) < threshold) continue;
        data[i + c] = Math.min(255, Math.max(0, Math.round(orig + amount * diff)));
      }
    }
  }
}

const LOGO_NORMALIZE_TARGET_EDGE = 1024;

function cropAndNormalizeLogoMark(imageData, options = {}) {
  const targetFill = Math.min(0.95, Math.max(0.5, options.targetFill ?? 0.82));
  const paddingRatio =
    options.paddingRatio ?? Math.max(0.02, (1 - targetFill) / (2 * targetFill));
  const maxEdge = options.maxEdge ?? LOGO_NORMALIZE_TARGET_EDGE;
  const minEdge = options.minEdge ?? LOGO_NORMALIZE_TARGET_EDGE;
  const alphaThreshold = options.alphaThreshold ?? 16;
  const sharpenOnUpscale = options.sharpenOnUpscale !== false;
  const sharpenAmount = options.sharpenAmount ?? 0.42;
  const sharpenThreshold = options.sharpenThreshold ?? 4;
  const { data, width, height } = imageData;

  const bbox = opaqueBBox(data, width, height, alphaThreshold);
  if (!bbox) return null;

  const markW = bbox.maxX - bbox.minX + 1;
  const markH = bbox.maxY - bbox.minY + 1;
  const pad = Math.max(1, Math.round(Math.min(markW, markH) * paddingRatio));

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
      cropped[oi] = data[si];
      cropped[oi + 1] = data[si + 1];
      cropped[oi + 2] = data[si + 2];
      cropped[oi + 3] = data[si + 3];
    }
  }

  const longEdge = Math.max(contentW, contentH);
  let scale = 1;
  if (longEdge < minEdge) scale = minEdge / longEdge;
  if (longEdge * scale > maxEdge) scale = maxEdge / longEdge;
  const outW = Math.max(1, Math.round(contentW * scale));
  const outH = Math.max(1, Math.round(contentH * scale));
  const wasScaled = outW !== contentW || outH !== contentH;

  const out = resizeRgbaBicubicStepped(cropped, contentW, contentH, outW, outH);
  const amount =
    wasScaled && scale > 1 && sharpenOnUpscale
      ? resolveLogoSharpenAmount(sharpenAmount, scale)
      : 0;
  if (amount > 0) {
    applyMildUnsharpMask(out, outW, outH, amount, sharpenThreshold);
  }

  const changed =
    outW !== width ||
    outH !== height ||
    wasScaled ||
    bbox.minX > 1 ||
    bbox.minY > 1 ||
    bbox.maxX < width - 2 ||
    bbox.maxY < height - 2;

  return { data: out, width: outW, height: outH, changed };
}

/** White mark on white card: bake a tight black plate under the mark. */
function bakeBlackPlate(imageData) {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3];
    if (a < 16) {
      out[i * 4] = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 0;
      out[i * 4 + 3] = 255;
    } else {
      out[i * 4] = data[i * 4];
      out[i * 4 + 1] = data[i * 4 + 1];
      out[i * 4 + 2] = data[i * 4 + 2];
      out[i * 4 + 3] = data[i * 4 + 3];
    }
  }
  return { data: out, width, height };
}

/** Optional: only these stems (no extension). Empty = all PNGs. */
const ONLY = new Set(
  (process.env.PARTNER_LOGO_ONLY ??
    "de-dominee-grand-cafe,finbrokers,benerink,laurens,steggink,benitech")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

/** Logos whose white mark needs a baked black plate for a white CSS card. */
const BAKE_BLACK_PLATE = new Set(["laurens"]);

const files = fs
  .readdirSync(dir)
  .filter((f) => /\.png$/i.test(f))
  .filter((f) => {
    if (ONLY.size === 0) return true;
    const stem = f.replace(/\.(png|jpe?g|webp|svg)$/i, "").toLowerCase();
    return ONLY.has(stem);
  })
  .sort();

let changedCount = 0;
for (const file of files) {
  const stem = file.replace(/\.(png|jpe?g|webp|svg)$/i, "").toLowerCase();
  const full = path.join(dir, file);
  const { data, info } = await sharp(full).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let imageData = { data: new Uint8ClampedArray(data), width: info.width, height: info.height };

  // Steggink: strip outer black first, then yellow plate (may need two passes).
  let strip = removeSolidLogoBackground(imageData);
  let matteNotes = [];
  if (strip.changed && strip.matte) {
    matteNotes.push(`rgb(${strip.matte.r},${strip.matte.g},${strip.matte.b})`);
  }
  // Second pass for nested plates (black frame → yellow plate).
  const strip2 = removeSolidLogoBackground(imageData);
  if (strip2.changed && strip2.matte) {
    matteNotes.push(`rgb(${strip2.matte.r},${strip2.matte.g},${strip2.matte.b})`);
    strip = { changed: true, matte: strip2.matte };
  }

  // Steggink: force-strip the yellow brand plate (rim anti-alias is pale cream).
  if (stem === "steggink") {
    const yellow = { r: 253, g: 241, b: 0 };
    const tol = 120;
    const seeds = [];
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const p = readPixel(imageData.data, imageData.width, x, y);
        if (p.a < 200) continue;
        if (colorDist(p, yellow) <= tol) seeds.push({ x, y });
      }
    }
    // Only seed plate pixels that touch a non-yellow neighbor or the bbox rim
    // — use all yellow as flood seeds (connected yellow fill).
    if (seeds.length) {
      const visited = new Uint8Array(imageData.width * imageData.height);
      const stack = seeds.map((s) => s.y * imageData.width + s.x);
      for (const idx of stack) visited[idx] = 1;
      let changed = false;
      while (stack.length) {
        const idx = stack.pop();
        const x = idx % imageData.width;
        const y = (idx / imageData.width) | 0;
        writeTransparent(imageData.data, imageData.width, x, y);
        changed = true;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= imageData.width || ny >= imageData.height) continue;
          const nidx = ny * imageData.width + nx;
          if (visited[nidx]) continue;
          const p = readPixel(imageData.data, imageData.width, nx, ny);
          if (p.a < 16 || colorDist(p, yellow) > tol) continue;
          visited[nidx] = 1;
          stack.push(nidx);
        }
      }
      if (changed) {
        strip = { changed: true, matte: yellow };
        matteNotes.push(`rgb(${yellow.r},${yellow.g},${yellow.b})`);
      }
    }
  }

  let normalized = cropAndNormalizeLogoMark(imageData);
  if (normalized) {
    imageData = { data: normalized.data, width: normalized.width, height: normalized.height };
  }

  if (BAKE_BLACK_PLATE.has(stem)) {
    imageData = bakeBlackPlate(imageData);
  }

  if (!strip.changed && !(normalized && normalized.changed) && !BAKE_BLACK_PLATE.has(stem)) {
    console.log(`skip  ${file}`);
    continue;
  }

  await sharp(Buffer.from(imageData.data), {
    raw: { width: imageData.width, height: imageData.height, channels: 4 },
  })
    .png()
    .toFile(full);
  changedCount++;
  const matte = matteNotes.length ? ` matte=${matteNotes.join("→")}` : "";
  const bake = BAKE_BLACK_PLATE.has(stem) ? " bake=black" : "";
  console.log(
    `fix ${file}  ${info.width}x${info.height}→${imageData.width}x${imageData.height}${matte}${bake}`,
  );
}
console.log(`Done. Updated ${changedCount}/${files.length} logos.`);
