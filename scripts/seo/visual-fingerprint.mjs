#!/usr/bin/env node
/**
 * Phase 11 — public visual fingerprint check (structural, not pixels).
 *
 * Compares live storefront source against
 * docs/seo/baselines/public-visual-fingerprint.after.json
 * (intentional Phase 6–10 SEO edits). Phase 0 historical baseline remains
 * docs/seo/baselines/public-visual-fingerprint.before.json.
 *
 *   node scripts/seo/visual-fingerprint.mjs check
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const afterPath = path.join(root, "docs/seo/baselines/public-visual-fingerprint.after.json");
const beforePath = path.join(root, "docs/seo/baselines/public-visual-fingerprint.before.json");

/** Component export name → preferred relative source file. */
const COMPONENT_FILES = {
  HomeSections: "apps/storefront/src/components/site/sections/HomeSections.tsx",
  ServicesMain: "apps/storefront/src/components/site/sections/ServicesSections.tsx",
  ServicesCards: "apps/storefront/src/components/site/sections/ServicesSections.tsx",
  ProductsBlockViews: "apps/storefront/src/components/site/sections/ProductsBlockViews.tsx",
  AboutSections: "apps/storefront/src/components/site/sections/AboutSections.tsx",
  AboutBlockViews: "apps/storefront/src/components/site/sections/AboutBlockViews.tsx",
  FormPageChrome: "apps/storefront/src/components/site/FormPageChrome.tsx",
};

/** Markers that are documentation notes, not source substrings. */
function isDocOnlyMarker(marker) {
  return /^(SSR note:|Phase |JobPosting |ItemList |primaryShell|ServicesCards grid)/i.test(marker);
}

function countH1Occurrences(source) {
  const re = /<(?:motion\.)?h1\b/g;
  return (source.match(re) ?? []).length;
}

function resolveComponentPath(route) {
  const mapped = route.h1?.component ? COMPONENT_FILES[route.h1.component] : null;
  if (mapped) {
    const abs = path.join(root, mapped);
    if (existsSync(abs)) return abs;
  }
  if (route.h1?.sourceFile) {
    const abs = path.join(root, route.h1.sourceFile);
    if (existsSync(abs)) return abs;
  }
  return path.join(root, route.routeFile);
}

function collectRouteHaystack(route, componentPath) {
  const files = new Set([componentPath, path.join(root, route.routeFile)]);
  // Form chrome pages also need section attribute from FormPageChrome / route.
  if (route.h1?.component === "FormPageChrome") {
    files.add(path.join(root, COMPONENT_FILES.FormPageChrome));
  }
  if (route.h1?.component === "ServicesMain") {
    files.add(path.join(root, COMPONENT_FILES.ServicesMain));
    files.add(path.join(root, "apps/storefront/src/components/site/sections/ServiceDetailPanel.tsx"));
  }
  let out = "";
  for (const f of files) {
    if (existsSync(f)) out += `\n${readFileSync(f, "utf8")}`;
  }
  return out;
}

function checkStructuralMarkers(routePath, markers, haystack, failures) {
  for (const marker of markers ?? []) {
    if (isDocOnlyMarker(marker)) continue;

    // Explicit required substrings for known Phase 0/7 markers.
    const required = [];
    if (marker.includes("min-h-[100svh]")) required.push("min-h-[100svh]");
    if (marker.includes("bg-grid")) required.push("bg-grid");
    if (marker.includes("SECTION_PAGE_RAIL") || marker.includes("lg:grid-cols-12")) {
      if (marker.includes("lg:grid-cols-12")) required.push("lg:grid-cols-12");
    }
    if (marker.includes("main.pt-24") || marker === "main.pt-24") required.push("pt-24");
    if (marker.includes("data-cms-section=")) {
      const m = /data-cms-section=([^\s]+)/.exec(marker);
      if (m) required.push(`data-cms-section="${m[1]}"`, `data-cms-section='${m[1]}'`, m[1]);
    }
    if (marker.includes("ServiceDetailPanel")) required.push("ServiceDetailPanel");
    if (marker.includes("BodyPortal")) required.push("BodyPortal");
    if (marker.includes("section#about") || marker.includes('id="about"')) required.push('id="about"');
    if (marker.includes("section#home")) required.push('id="home"');

    if (required.length === 0) continue;

    // data-cms-section: pass if any variant or the section key appears.
    if (marker.includes("data-cms-section=")) {
      const key = /data-cms-section=([^\s]+)/.exec(marker)?.[1];
      if (key && (haystack.includes(`data-cms-section="${key}"`) || haystack.includes(key))) {
        continue;
      }
      failures.push(`${routePath}: structural marker missing for ${marker}`);
      continue;
    }

    for (const needle of required) {
      if (needle.includes("data-cms-section")) continue;
      if (!haystack.includes(needle)) {
        failures.push(`${routePath}: structural marker token missing: ${needle}`);
      }
    }
  }
}

function checkRoute(routePath, route, failures) {
  const routeFile = path.join(root, route.routeFile);
  if (!existsSync(routeFile)) {
    failures.push(`${routePath}: missing routeFile ${route.routeFile}`);
    return;
  }

  const componentPath = resolveComponentPath(route);
  if (!existsSync(componentPath)) {
    failures.push(`${routePath}: missing h1 component file ${path.relative(root, componentPath)}`);
    return;
  }

  const source = readFileSync(componentPath, "utf8");
  const h1Count = countH1Occurrences(source);
  // FormPageChrome is shared — one H1 in the chrome file is the invariant.
  if (h1Count !== 1) {
    failures.push(
      `${routePath}: expected exactly one <h1>/<motion.h1> in ${path.relative(root, componentPath)}, found ${h1Count}`,
    );
  }

  const className = route.h1?.className;
  if (className && !source.includes(className)) {
    failures.push(
      `${routePath}: h1.className not found in ${path.relative(root, componentPath)}`,
    );
  }

  if (route.h1?.tag === "h1" && !/<(?:motion\.)?h1\b/.test(source)) {
    failures.push(`${routePath}: h1 tag missing in ${path.relative(root, componentPath)}`);
  }

  if (route.h1?.h2Scent?.className && !source.includes(route.h1.h2Scent.className)) {
    failures.push(`${routePath}: h2Scent.className missing (Phase 6 products demotion)`);
  }

  const haystack = collectRouteHaystack(route, componentPath);
  checkStructuralMarkers(routePath, route.markers, haystack, failures);
}

function main() {
  const mode = process.argv[2] || "check";
  if (mode !== "check") {
    console.error("Usage: node scripts/seo/visual-fingerprint.mjs check");
    process.exit(2);
  }

  if (!existsSync(beforePath)) {
    console.error(`Missing Phase 0 baseline: ${path.relative(root, beforePath)}`);
    process.exit(1);
  }
  if (!existsSync(afterPath)) {
    console.error(
      `Missing current fingerprint after.json: ${path.relative(root, afterPath)}`,
    );
    process.exit(1);
  }

  const after = JSON.parse(readFileSync(afterPath, "utf8"));
  const failures = [];
  const routes = after.routes ?? {};
  for (const [routePath, route] of Object.entries(routes)) {
    checkRoute(routePath, route, failures);
  }

  if (failures.length) {
    console.error(
      JSON.stringify(
        {
          VISUAL_FINGERPRINT_OK: false,
          failures,
          after: path.relative(root, afterPath),
          phaseNotes: after.phaseNotes ?? null,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      VISUAL_FINGERPRINT_OK: true,
      routes: Object.keys(routes).length,
      after: path.relative(root, afterPath),
      phaseNotes: after.phaseNotes ?? null,
    }),
  );
  process.exit(0);
}

main();