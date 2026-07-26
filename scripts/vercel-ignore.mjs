#!/usr/bin/env node
/**
 * Vercel Ignored Build Step helper for the McCoy monorepo.
 *
 * Usage (from app Root Directory, e.g. apps/storefront):
 *   node ../../scripts/vercel-ignore.mjs storefront
 *   node ../../scripts/vercel-ignore.mjs admin
 *
 * Exit codes (Vercel contract):
 *   0 → skip this deployment
 *   1 → proceed with install/build
 *
 * When VERCEL_GIT_PREVIOUS_SHA is missing (first deploy / empty clone),
 * always build.
 */

import { execSync } from "node:child_process";

const target = process.argv[2];

/** Paths that force a Storefront rebuild when changed. */
const STOREFRONT_PATHS = [
  "apps/storefront/",
  "packages/cms-schema/",
  "packages/cms-renderer/",
  "packages/database/",
  "packages/domain/",
  "packages/email/",
  "packages/security/",
  "packages/ui/",
  "packages/validation/",
  "supabase/",
  "package.json",
  "package-lock.json",
  "scripts/",
];

/** Paths that force an Admin rebuild when changed. */
const ADMIN_PATHS = [
  "apps/admin/",
  "packages/cms-editor/",
  "packages/content-ai/",
  "packages/cms-schema/",
  "packages/cms-renderer/",
  "packages/database/",
  "packages/domain/",
  "packages/email/",
  "packages/security/",
  "packages/ui/",
  "packages/validation/",
  "supabase/",
  "package.json",
  "package-lock.json",
  "scripts/",
];

if (target !== "storefront" && target !== "admin") {
  console.error("Usage: node scripts/vercel-ignore.mjs storefront|admin");
  process.exit(1);
}

const patterns = target === "storefront" ? STOREFRONT_PATHS : ADMIN_PATHS;
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();

if (!previousSha) {
  console.log(`[vercel-ignore] No VERCEL_GIT_PREVIOUS_SHA — building ${target}.`);
  process.exit(1);
}

let diff = "";
try {
  diff = execSync(`git diff --name-only ${previousSha} HEAD`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  console.log(`[vercel-ignore] git diff failed — building ${target}.`, error);
  process.exit(1);
}

const changed = diff
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const hit = changed.find((file) =>
  patterns.some((pattern) => (pattern.endsWith("/") ? file.startsWith(pattern) : file === pattern)),
);

if (hit) {
  console.log(`[vercel-ignore] ${target} affected by ${hit} — building.`);
  process.exit(1);
}

console.log(`[vercel-ignore] ${target} unaffected (${changed.length} files) — skipping.`);
process.exit(0);
