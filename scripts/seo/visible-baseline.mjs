#!/usr/bin/env node
/**
 * Visible-body baseline capture / compare for SEO Safe Mode.
 *
 * Fingerprints CMS page fixtures (section order, block IDs, text, links, images,
 * form labels) — not hypersensitive to runtime attrs.
 *
 *   node scripts/seo/visible-baseline.mjs write
 *   node scripts/seo/visible-baseline.mjs check
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "docs/seo/baselines");
const fixtureDirs = [
  path.join(root, "packages/cms-schema/src/migration/mg5-fixtures"),
  path.join(root, "packages/cms-schema/src/migration/fixtures-mg5"),
];

const TARGETS = [
  { id: "home", fileHints: ["page_home.json"], route: "/" },
  { id: "products", fileHints: ["page_products.json"], route: "/products" },
  { id: "contact", fileHints: ["page_contact.json", "page_about.json"], route: "/contact", optional: true },
  { id: "offerte", fileHints: ["page_offerte.json"], route: "/offerte" },
  { id: "vacatures", fileHints: ["page_vacatures.json", "page_about.json"], route: "/vacatures", optional: true },
  { id: "about_cms", fileHints: ["page_about.json"], route: "/about" },
  { id: "privacy_en_proxy", fileHints: ["page_privacy.json"], route: "/en/privacy" },
];

function walkStrings(value, acc) {
  if (value == null) return;
  if (typeof value === "string") {
    const t = value.replace(/\s+/g, " ").trim();
    if (t) acc.push(t);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    acc.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walkStrings(v, acc);
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "updatedAt" || k === "version" || k === "revisionId") continue;
      walkStrings(v, acc);
    }
  }
}

function extractFingerprint(page, route) {
  const sectionOrder = [];
  const blockIds = [];
  const links = [];
  const images = [];
  const formLabels = [];
  const headings = [];

  if (Array.isArray(page.layout)) {
    for (const item of page.layout) {
      if (item?.kind === "fixed" && item.key) sectionOrder.push(item.key);
      if (item?.kind === "block" && item.blockId) blockIds.push(item.blockId);
    }
  }
  if (Array.isArray(page.blocks)) {
    for (const b of page.blocks) {
      if (b?.id) blockIds.push(b.id);
    }
  }

  const texts = [];
  walkStrings(page.sectionContent ?? {}, texts);
  walkStrings(page.blocks ?? [], texts);
  walkStrings(page.localeContent ?? {}, texts);

  for (const t of texts) {
    if (/^https?:\/\//i.test(t) || t.startsWith("/")) {
      if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(t) || t.includes("/images/")) images.push(t);
      else links.push(t);
    }
    if (/^(h1|heading|title|label)/i.test(t) || t.length < 80) {
      /* keep generic */
    }
  }

  // Form labels from contact/offerte shapes
  const sc = page.sectionContent ?? {};
  for (const key of Object.keys(sc)) {
    const fields = sc[key]?.fields;
    if (Array.isArray(fields)) {
      for (const f of fields) {
        if (typeof f?.label === "string") formLabels.push(f.label);
        if (typeof f?.text === "string") formLabels.push(f.text);
      }
    }
    if (typeof sc[key]?.heading === "string") headings.push(sc[key].heading);
    if (typeof sc[key]?.title === "string") headings.push(sc[key].title);
  }

  const visibleText = texts
    .filter((t) => t.length > 1 && t.length < 500)
    .slice(0, 400);

  const payload = {
    route,
    sectionOrder: [...new Set(sectionOrder)],
    blockIds: [...new Set(blockIds)].sort(),
    headings: [...new Set(headings)],
    links: [...new Set(links)].sort(),
    images: [...new Set(images)].sort(),
    formLabels: [...new Set(formLabels)],
    visibleTextSample: visibleText,
  };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { hash, payload };
}

function findFixture(hints) {
  for (const dir of fixtureDirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir);
    for (const hint of hints) {
      const hit = files.find((f) => f === hint || f.endsWith(hint));
      if (hit) return path.join(dir, hit);
    }
  }
  return null;
}

function captureAll() {
  const results = {};
  for (const target of TARGETS) {
    const file = findFixture(target.fileHints);
    if (!file) {
      if (target.optional) {
        results[target.id] = {
          route: target.route,
          missingFixture: true,
          hash: "missing-optional",
          payload: { route: target.route, note: "optional fixture absent" },
        };
        continue;
      }
      throw new Error(`Missing fixture for ${target.id}: ${target.fileHints.join(", ")}`);
    }
    const page = JSON.parse(readFileSync(file, "utf8"));
    const fp = extractFingerprint(page, target.route);
    results[target.id] = { route: target.route, source: path.relative(root, file), ...fp };
  }
  return results;
}

const mode = process.argv[2] || "check";
mkdirSync(outDir, { recursive: true });

if (mode === "write") {
  const captured = captureAll();
  const beforePath = path.join(outDir, "visible-body.before.json");
  writeFileSync(beforePath, `${JSON.stringify(captured, null, 2)}\n`, "utf8");
  // AFTER starts equal to BEFORE for Safe Mode infra (no body edits).
  writeFileSync(path.join(outDir, "visible-body.after.json"), `${JSON.stringify(captured, null, 2)}\n`, "utf8");
  console.log(`Wrote ${beforePath}`);
  process.exit(0);
}

if (mode === "check") {
  const beforePath = path.join(outDir, "visible-body.before.json");
  if (!existsSync(beforePath)) {
    console.error("Missing docs/seo/baselines/visible-body.before.json — run write first");
    process.exit(1);
  }
  const before = JSON.parse(readFileSync(beforePath, "utf8"));
  const current = captureAll();
  const afterPath = path.join(outDir, "visible-body.after.json");
  writeFileSync(afterPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");

  const changed = [];
  for (const id of Object.keys(before)) {
    if (before[id]?.hash !== current[id]?.hash) changed.push(id);
  }
  const flag = changed.length === 0;
  console.log(
    JSON.stringify({
      VISIBLE_BODY_CHANGED: !flag,
      changed,
      afterPath: path.relative(root, afterPath),
    }),
  );
  process.exit(flag ? 0 : 1);
}

console.error("Usage: node scripts/seo/visible-baseline.mjs [write|check]");
process.exit(2);
