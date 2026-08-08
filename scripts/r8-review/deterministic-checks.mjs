/**
 * Deterministic R8 static checks (report-only aggregation input).
 * Scans production source trees; never mutates application code.
 */
import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOTS = ["apps", "packages"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cts"]);
const IGNORE_PARTS = new Set([
  "node_modules",
  "dist",
  ".output",
  "coverage",
  ".git",
  "e2e",
  "scripts",
  ".data",
]);

/**
 * @param {string} root
 * @param {{ fixtureDir?: string }} [options]
 */
export function runDeterministicChecks(root, options = {}) {
  const findings = [];
  const files = listSourceFiles(root);
  for (const file of files) {
    const rel = normalize(path.relative(root, file));
    const text = fs.readFileSync(file, "utf8");
    findings.push(...checkForbiddenImports(rel, text));
    findings.push(...checkAdminPersistSession(rel, text));
    findings.push(...checkWindowConfirm(rel, text));
    findings.push(...checkServiceRoleClient(rel, text));
  }

  if (options.fixtureDir) {
    findings.push(...scanFixtureDir(root, options.fixtureDir));
  }

  return findings;
}

function listSourceFiles(root) {
  const out = [];
  for (const sourceRoot of SOURCE_ROOTS) {
    const abs = path.join(root, sourceRoot);
    if (!fs.existsSync(abs)) continue;
    walk(abs, out);
  }
  return out;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_PARTS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
}

function checkForbiddenImports(rel, text) {
  const findings = [];
  const importRe = /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of text.matchAll(importRe)) {
    const spec = match[1];
    if (rel.startsWith("apps/storefront/") && (spec === "@mccoy/cms-editor" || spec.startsWith("@mccoy/cms-editor/"))) {
      findings.push(finding({
        id: `arch-storefront-cms-editor-${hash(rel)}`,
        ruleId: "arch.forbid.storefront-cms-editor",
        review: "architecture",
        severity: "blocker",
        confidence: "high",
        package: "@mccoy/storefront",
        path: rel,
        title: "Storefront imports cms-editor",
        evidence: [`Import specifier: ${spec}`],
        impact: "Breaks package boundary; pulls admin authoring into public app.",
        recommendation: "Remove the import; keep storefront on cms-renderer/schema only.",
        status: "open",
      }));
    }
    if (rel.startsWith("packages/cms-renderer/") && (spec === "@mccoy/cms-editor" || spec.startsWith("@mccoy/cms-editor/"))) {
      findings.push(finding({
        id: `arch-renderer-cms-editor-${hash(rel)}`,
        ruleId: "arch.forbid.renderer-cms-editor",
        review: "architecture",
        severity: "blocker",
        confidence: "high",
        package: "@mccoy/cms-renderer",
        path: rel,
        title: "Renderer imports cms-editor",
        evidence: [`Import specifier: ${spec}`],
        impact: "Renderer must stay presentation-only and shared with storefront.",
        recommendation: "Move editor-only code into cms-editor.",
        status: "open",
      }));
    }
    if (rel.startsWith("packages/cms-schema/") && (spec === "react" || spec.startsWith("react/") || spec === "react-dom")) {
      findings.push(finding({
        id: `arch-schema-react-${hash(rel)}`,
        ruleId: "arch.forbid.schema-react",
        review: "architecture",
        severity: "high",
        confidence: "high",
        package: "@mccoy/cms-schema",
        path: rel,
        title: "cms-schema imports React",
        evidence: [`Import specifier: ${spec}`],
        impact: "Schema package must remain framework-free domain contracts.",
        recommendation: "Remove React dependency from schema.",
        status: "open",
      }));
    }
  }
  return findings;
}

function checkAdminPersistSession(rel, text) {
  if (!rel.startsWith("apps/admin/")) return [];
  if (!/persistSession\s*:\s*true/.test(text)) return [];
  // Allow comments mentioning the forbidden pattern
  const lines = text.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, index) => {
    if (/persistSession\s*:\s*true/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
      hits.push(index + 1);
    }
  });
  if (!hits.length) return [];
  return [finding({
    id: `sec-admin-persist-${hash(rel)}`,
    ruleId: "sec.admin.persist-session-true",
    review: "security",
    severity: "blocker",
    confidence: "high",
    package: "@mccoy/admin",
    path: rel,
    lineStart: hits[0],
    title: "Admin client enables persistSession",
    evidence: hits.map((line) => `${rel}:${line} persistSession: true`),
    impact: "Reintroduces persistent Supabase JWT storage against cookie-authoritative Admin auth.",
    recommendation: "Keep Admin realtime/browser clients at persistSession: false.",
    verification: ["npm run test -w @mccoy/admin -- src/lib/supabase-browser.test.ts"],
    status: "open",
  })];
}

function checkWindowConfirm(rel, text) {
  if (!rel.includes("cms-editor") && !rel.startsWith("apps/admin/src/")) return [];
  if (!/\bwindow\.confirm\s*\(/.test(text)) return [];
  if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx") || rel.includes(".confirm.test.")) return [];
  const line = text.split(/\r?\n/).findIndex((l) => /\bwindow\.confirm\s*\(/.test(l)) + 1;
  return [finding({
    id: `ux-window-confirm-${hash(rel)}`,
    ruleId: "ux.native-window-confirm",
    review: "ui-ux",
    severity: "high",
    confidence: "high",
    path: rel,
    lineStart: line || undefined,
    title: "Native window.confirm used in Admin/CMS path",
    evidence: [`${rel}:${line} contains window.confirm(`],
    impact: "Breaks accessible confirmation pattern and E2E expectations for custom dialogs.",
    recommendation: "Use injected confirmOverwrite / appConfirm dialogs.",
    status: "open",
  })];
}

function checkServiceRoleClient(rel, text) {
  if (!rel.startsWith("apps/storefront/") && !rel.startsWith("apps/admin/src/components/") && !rel.startsWith("apps/admin/src/routes/")) {
    return [];
  }
  // Browser-facing UI trees must not reference service role key env names.
  if (!/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|supabaseServiceRole/i.test(text)) return [];
  if (rel.includes(".server.") || rel.includes("/server/") || rel.endsWith(".server.ts") || rel.endsWith(".server.tsx")) {
    return [];
  }
  return [finding({
    id: `sec-service-role-ui-${hash(rel)}`,
    ruleId: "sec.service-role-in-ui",
    review: "security",
    severity: "high",
    confidence: "medium",
    path: rel,
    title: "Possible service-role reference in UI module",
    evidence: [`Pattern match in ${rel}`],
    impact: "Service-role credentials must remain server-only.",
    recommendation: "Move privileged access behind server functions.",
    status: "open",
  })];
}

function scanFixtureDir(root, fixtureDir) {
  const abs = path.isAbsolute(fixtureDir) ? fixtureDir : path.join(root, fixtureDir);
  if (!fs.existsSync(abs)) return [];
  const findings = [];
  for (const name of fs.readdirSync(abs)) {
    const file = path.join(abs, name);
    if (!fs.statSync(file).isFile()) continue;
    const rel = normalize(path.relative(root, file));
    const text = fs.readFileSync(file, "utf8");
    // Synthetic production-like path for detector targeting (fixtures are never imported).
    const pathLine = text.split(/\r?\n/).find((l) => l.startsWith("// @r8-path:"));
    const syntheticPath = pathLine ? pathLine.replace("// @r8-path:", "").trim() : rel;
    findings.push(...checkForbiddenImports(syntheticPath, text));
    findings.push(...checkAdminPersistSession(syntheticPath, text));
    findings.push(...checkWindowConfirm(syntheticPath, text));
  }
  return findings.map((f) => ({
    ...f,
    id: `fixture-${f.id}`,
    evidence: [...f.evidence, `fixture:${normalize(path.relative(root, abs))}`],
  }));
}

function finding(partial) {
  return {
    package: partial.package,
    symbol: partial.symbol,
    lineStart: partial.lineStart,
    lineEnd: partial.lineEnd,
    verification: partial.verification ?? [],
    relatedFindings: partial.relatedFindings ?? [],
    ...partial,
  };
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0, 8);
}
