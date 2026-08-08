#!/usr/bin/env node
/**
 * Deterministic SEO Safe Mode diff guard.
 * Fails if SEO-related changes touch protected composition / Producten / Aanvragen / auth
 * without an explicit authorization marker.
 *
 * Usage:
 *   node scripts/seo/safe-mode-diff-guard.mjs [--base <ref>]
 *
 * Env:
 *   SEO_SAFE_MODE_BASE   baseline git ref (default: origin/development or HEAD~1)
 *   SEO_SAFE_MODE_ALLOW=1  emergency bypass (logged)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const PROTECTED_PATH_PATTERNS = [
  /^packages\/cms-renderer\//,
  /RegisteredBlockView/,
  /SitePageSections/,
  /packages\/cms-schema\/src\/block-types\.ts$/,
  /packages\/cms-schema\/src\/blocks\/registry/,
  /packages\/cms-schema\/src\/migration\//,
  /packages\/cms-schema\/src\/en-field-/,
  /packages\/cms-schema\/src\/translation-/,
  /e2e\/forms-aanvragen/,
  /Aanvragen/,
  /packages\/security\/src\/session\.ts$/,
  /packages\/security\/src\/mfa/,
  /apps\/admin\/src\/.*auth/,
  /apps\/storefront\/src\/.*auth/,
];

/** Technical head-only edits on Producten route are SEO-safe; body/content edits are not. */
const PRODUCTS_ROUTE = "apps/storefront/src/routes/products.tsx";
const PRODUCTS_SEO_ALLOW =
  /absoluteCanonicalLink|absoluteOgUrl|absolute-head|og:url|canonical/;

const SEO_TOUCH_HINTS = [
  /^docs\/seo\//,
  /^scripts\/seo\//,
  /indexing\.ts$/,
  /resolve-seo\.ts$/,
  /indexnow\.ts$/,
  /robots\[\.\]txt/,
  /sitemap\[\.\]xml/,
  /frozen-deployed-seo/,
  /absolute-head/,
  /\.cursor\/rules\/seo-safe-mode/,
];

const ALLOW_MARKER = "SEO_SAFE_MODE_AUTHORIZED";

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: "utf8" }).trim();
}

function resolveBase(cliBase) {
  if (cliBase) return cliBase;
  if (process.env.SEO_SAFE_MODE_BASE) return process.env.SEO_SAFE_MODE_BASE;
  try {
    run("git rev-parse --verify origin/development");
    return "origin/development";
  } catch {
    return "HEAD~1";
  }
}

function listChangedFiles(base) {
  const names = new Set();
  try {
    for (const line of run(`git diff --name-only ${base}...HEAD`).split("\n")) {
      if (line) names.add(line.replace(/\\/g, "/"));
    }
  } catch {
    /* empty */
  }
  try {
    for (const line of run("git diff --name-only").split("\n")) {
      if (line) names.add(line.replace(/\\/g, "/"));
    }
    for (const line of run("git diff --name-only --cached").split("\n")) {
      if (line) names.add(line.replace(/\\/g, "/"));
    }
    for (const line of run("git ls-files --others --exclude-standard").split("\n")) {
      if (line) names.add(line.replace(/\\/g, "/"));
    }
  } catch {
    /* empty */
  }
  return [...names];
}

function isSeoTouch(file) {
  return SEO_TOUCH_HINTS.some((re) => re.test(file));
}

function isProtected(file) {
  return PROTECTED_PATH_PATTERNS.some((re) => re.test(file));
}

function hasAuthorization() {
  if (process.env.SEO_SAFE_MODE_ALLOW === "1") return true;
  const markerPath = path.join(root, "docs/seo/SEO-SAFE-MODE-AUTHORIZATION.md");
  if (!existsSync(markerPath)) return false;
  const text = readFileSync(markerPath, "utf8");
  return text.includes(ALLOW_MARKER);
}

const args = process.argv.slice(2);
let baseArg;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base" && args[i + 1]) baseArg = args[++i];
}

const base = resolveBase(baseArg);
const files = listChangedFiles(base);
const seoFiles = files.filter(isSeoTouch);
const protectedHits = files.filter(isProtected);

// Guard only when this tranche includes SEO work, or when protected paths appear with SEO docs.
const shouldEnforce = seoFiles.length > 0 || protectedHits.some((f) => f.includes("cms-renderer") || f.includes("migration"));

if (!shouldEnforce) {
  console.log(JSON.stringify({ ok: true, reason: "no_seo_tranche_changes", base, files: files.length }));
  process.exit(0);
}

const blocked = [];
for (const f of protectedHits) {
  if (f === PRODUCTS_ROUTE) {
    try {
      const diff = run(`git diff ${base} -- ${PRODUCTS_ROUTE}`) + run(`git diff -- ${PRODUCTS_ROUTE}`);
      const nonSeo = diff
        .split("\n")
        .filter((l) => l.startsWith("+") || l.startsWith("-"))
        .filter((l) => !l.startsWith("+++") && !l.startsWith("---"))
        .filter((l) => l.trim() && !PRODUCTS_SEO_ALLOW.test(l) && !/^[-+]import /.test(l) && !/^[-+]\s*$/.test(l));
      if (nonSeo.length > 0) blocked.push(f);
    } catch {
      blocked.push(f);
    }
    continue;
  }
  blocked.push(f);
}

if (blocked.length > 0 && !hasAuthorization()) {
  console.error("SEO Safe Mode diff guard FAILED");
  console.error(`Base: ${base}`);
  console.error("Protected paths touched without authorization:");
  for (const f of blocked) console.error(`  - ${f}`);
  console.error(
    `Add docs/seo/SEO-SAFE-MODE-AUTHORIZATION.md containing ${ALLOW_MARKER}, or set SEO_SAFE_MODE_ALLOW=1 only with explicit approval.`,
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    base,
    seoFiles: seoFiles.length,
    protectedHits: protectedHits.length,
    authorized: hasAuthorization(),
  }),
);
process.exit(0);
