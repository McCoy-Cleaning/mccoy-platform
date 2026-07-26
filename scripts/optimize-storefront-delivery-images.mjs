/**
 * Optimize oversized storefront static images for delivery (not CMS editor quality).
 *
 * - Nav/logo: display ~72px tall → keep ~2× retina raster, crush PNG
 * - Flyer / vision PNGs: resize + WebP-friendly re-encode as optimized PNG/JPEG
 * - Hero: emit responsive WebP (+ keep JPEG source)
 * - Partners: emit 480w WebP display variants beside masters (masters stay for quality)
 *
 * Usage: node scripts/optimize-storefront-delivery-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function rel(p) {
  return path.relative(root, p);
}

async function writeIfSmaller(targetPath, buffer, label) {
  const prev = fs.existsSync(targetPath) ? fs.statSync(targetPath).size : 0;
  if (prev > 0 && buffer.length >= prev * 0.98) {
    console.log(`skip ${label}: no meaningful savings (${Math.round(prev / 1024)}KB)`);
    return false;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
  console.log(
    `ok   ${label}: ${Math.round(prev / 1024)}KB → ${Math.round(buffer.length / 1024)}KB`,
  );
  return true;
}

async function optimizeLogoPng(filePath, maxWidth = 480) {
  const input = fs.readFileSync(filePath);
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const pipeline = sharp(input, { failOn: "none" }).rotate();
  if ((meta.width ?? 0) > maxWidth) {
    pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  // Never use PNG palette on logos — it can flatten/matte alpha incorrectly.
  const png = await pipeline
    .clone()
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer();
  const webp = await pipeline
    .clone()
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toBuffer();
  await writeIfSmaller(filePath, png, rel(filePath));
  const webpPath = filePath.replace(/\.png$/i, ".webp");
  await writeIfSmaller(webpPath, webp, rel(webpPath));
}

async function optimizePhotoLike(filePath, { maxEdge, preferJpeg }) {
  const input = fs.readFileSync(filePath);
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longest = Math.max(w, h);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));
  const base = sharp(input, { failOn: "none" }).rotate().resize(width, height, {
    fit: "fill",
    withoutEnlargement: true,
  });

  if (preferJpeg || /\.jpe?g$/i.test(filePath)) {
    const jpeg = await base.clone().jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    const outPath = filePath.replace(/\.png$/i, ".jpg");
    if (outPath !== filePath && /\.png$/i.test(filePath)) {
      await writeIfSmaller(outPath, jpeg, rel(outPath));
      // Also crush original PNG path to a smaller PNG so old refs stay valid.
      const png = await base.clone().png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer();
      await writeIfSmaller(filePath, png, rel(filePath));
    } else {
      await writeIfSmaller(filePath, jpeg, rel(filePath));
    }
    const webp = await base.clone().webp({ quality: 76, effort: 6 }).toBuffer();
    await writeIfSmaller(filePath.replace(/\.(png|jpe?g)$/i, ".webp"), webp, rel(filePath.replace(/\.(png|jpe?g)$/i, ".webp")));
    return;
  }

  const png = await base.clone().png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer();
  await writeIfSmaller(filePath, png, rel(filePath));
  const webp = await base.clone().webp({ quality: 80, alphaQuality: 85, effort: 6 }).toBuffer();
  await writeIfSmaller(filePath.replace(/\.png$/i, ".webp"), webp, rel(filePath.replace(/\.png$/i, ".webp")));
}

async function emitHeroVariants(jpegPath) {
  const input = fs.readFileSync(jpegPath);
  const widths = [640, 960, 1280];
  for (const width of widths) {
    const webp = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 75, effort: 6 })
      .toBuffer();
    const out = jpegPath.replace(/\.jpe?g$/i, `-${width}.webp`);
    await writeIfSmaller(out, webp, rel(out));
  }
  // Also lightly recompress master JPEG if oversized for LCP.
  const jpeg = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  await writeIfSmaller(jpegPath, jpeg, rel(jpegPath));
}

async function emitPartnerDisplayVariants(dir) {
  const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f) && !f.includes("-w"));
  for (const file of files) {
    const src = path.join(dir, file);
    const input = fs.readFileSync(src);
    const webp480 = await sharp(input, { failOn: "none" })
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 85, alphaQuality: 90, effort: 6 })
      .toBuffer();
    const out = path.join(dir, file.replace(/\.png$/i, "-w480.webp"));
    await writeIfSmaller(out, webp480, rel(out));
  }
}

async function main() {
  const logoTargets = [
    path.join(root, "apps/storefront/public/images/cms/logo-mccoy.png"),
    path.join(root, "apps/storefront/src/assets/logo-mccoy.png"),
  ];
  for (const p of logoTargets) {
    if (fs.existsSync(p)) await optimizeLogoPng(p, 480);
  }

  const flyerTargets = [
    path.join(root, "apps/storefront/public/images/cms/products-flyer.png"),
    path.join(root, "apps/storefront/src/assets/mccoy-products-flyer.png"),
  ];
  for (const p of flyerTargets) {
    if (fs.existsSync(p)) await optimizePhotoLike(p, { maxEdge: 1200, preferJpeg: true });
  }

  const visionPng = [
    path.join(root, "apps/storefront/public/images/cms/about-vision-alt.png"),
    path.join(root, "apps/storefront/src/assets/mccoy-about-vision.png"),
  ];
  for (const p of visionPng) {
    if (fs.existsSync(p)) await optimizePhotoLike(p, { maxEdge: 1200, preferJpeg: true });
  }

  const heroes = [
    path.join(root, "apps/storefront/public/images/cms/hero-cleaning.jpg"),
    path.join(root, "apps/storefront/src/assets/hero-cleaning.jpg"),
  ];
  for (const p of heroes) {
    if (fs.existsSync(p)) await emitHeroVariants(p);
  }

  // Other heavy CMS photos commonly painted on home.
  const cmsPhotos = [
    "about-history.jpg",
    "about-vision.jpg",
    "work-horeca.jpg",
    "work-regular.jpg",
    "work-oplevering.jpg",
    "work-floor.jpg",
    "work-glass.jpg",
    "about-mission.png",
  ];
  for (const name of cmsPhotos) {
    const p = path.join(root, "apps/storefront/public/images/cms", name);
    if (!fs.existsSync(p)) continue;
    if (/\.png$/i.test(name)) {
      await optimizePhotoLike(p, { maxEdge: 1200, preferJpeg: false });
    } else {
      await optimizePhotoLike(p, { maxEdge: 1280, preferJpeg: true });
    }
  }

  const partnersDir = path.join(root, "apps/storefront/public/images/partners");
  if (fs.existsSync(partnersDir)) await emitPartnerDisplayVariants(partnersDir);

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
