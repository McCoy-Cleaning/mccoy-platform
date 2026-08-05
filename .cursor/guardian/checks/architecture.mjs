import fs from "node:fs";
import path from "node:path";
import { listFiles, boundaryFor } from "../lib/project.mjs";
import { safeRead, normalizeSlashes } from "../lib/io.mjs";

const IMPORT_RE = /(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g;

export function checkArchitecture(root, guardian, policy, changedFiles = []) {
  const extensions = (guardian.sourceExtensions ?? []).filter((ext) => [".js",".jsx",".ts",".tsx",".mjs",".cjs"].includes(ext));
  const files = listFiles(root, { extensions, sourceRoots: guardian.sourceRoots, maxFiles: 6000 });
  const fileSet = new Set(files.map((file) => path.resolve(file)));
  const changedSet = new Set(changedFiles.map((file) => path.resolve(file)));
  const graph = new Map();
  const findings = [];

  for (const file of files) {
    const text = safeRead(file);
    if (text == null) continue;
    const imports = parseImports(text);
    const fromBoundary = boundaryFor(root, file);
    const edges = [];

    for (const specifier of imports) {
      if (policy.forbidPackageSourceDeepImports !== false &&
          (/(^|\/)packages\/[^/]+\/src\//.test(specifier) || /^@[^/]+\/[^/]+\/src\//.test(specifier))) {
        findings.push(finding("error", "deep-package-import", file, `Deep import into package source: ${specifier}`));
      }

      if (policy.enforceAppIsolation !== false && fromBoundary.startsWith("apps/")) {
        const match = specifier.match(/(?:^|\/)apps\/([^/]+)/);
        if (match && `apps/${match[1]}` !== fromBoundary) {
          findings.push(finding("error", "app-isolation", file, `Direct import from another app: ${specifier}`));
        }
      }

      if (specifier.startsWith(".")) {
        const resolved = resolveImport(file, specifier, fileSet);
        if (resolved) {
          edges.push(resolved);
          if (policy.forbidRelativeBoundaryEscape !== false) {
            const toBoundary = boundaryFor(root, resolved);
            if (isManagedBoundary(fromBoundary) && isManagedBoundary(toBoundary) && fromBoundary !== toBoundary) {
              findings.push(finding("error", "boundary-escape", file, `Relative import crosses '${fromBoundary}' into '${toBoundary}': ${specifier}`));
            }
          }
        }
      }

      for (const zone of policy.zones ?? []) {
        if (zone.enabled === false || !matchesAny(normalizeSlashes(path.relative(root, file)), zone.from ?? [])) continue;
        if ((zone.deny ?? []).some((rule) => matchSpecifier(specifier, rule))) {
          findings.push(finding("error", `zone:${zone.name}`, file, `Import '${specifier}' violates zone '${zone.name}'`));
        }
      }
    }
    graph.set(path.resolve(file), edges);
  }

  if (guardian.architecture?.reportCircularDependencies !== false) {
    for (const cycle of findCycles(graph)) {
      if (!isAllowedCycle(root, cycle, policy.allowCycles ?? [])) {
        const relevant = cycle.some((file) => changedSet.has(file));
        findings.push({
          severity: relevant ? "error" : "warning",
          category: "architecture",
          rule: "circular-dependency",
          file: cycle[0],
          message: `Circular dependency: ${cycle.map((f) => normalizeSlashes(path.relative(root, f))).join(" -> ")}`
        });
      }
    }
  }

  return dedupe(findings);
}

function parseImports(text) {
  const output = [];
  IMPORT_RE.lastIndex = 0;
  for (const match of text.matchAll(IMPORT_RE)) output.push(match[1] ?? match[2] ?? match[3]);
  return output.filter(Boolean);
}

function resolveImport(fromFile, specifier, fileSet) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base, ...[".ts",".tsx",".js",".jsx",".mjs",".cjs"].map((ext) => base + ext),
    ...["index.ts","index.tsx","index.js","index.jsx"].map((name) => path.join(base, name))
  ];
  return candidates.find((candidate) => fileSet.has(path.resolve(candidate))) ?? null;
}

function findCycles(graph) {
  const visiting = new Set(), visited = new Set(), stack = [], cycles = [];
  function dfs(node) {
    if (visiting.has(node)) {
      const index = stack.indexOf(node);
      if (index >= 0) cycles.push([...stack.slice(index), node]);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node); stack.push(node);
    for (const next of graph.get(node) ?? []) dfs(next);
    stack.pop(); visiting.delete(node); visited.add(node);
  }
  for (const node of graph.keys()) dfs(node);
  return cycles;
}

function isAllowedCycle(root, cycle, patterns) {
  const joined = cycle.map((f) => normalizeSlashes(path.relative(root, f))).join(" -> ");
  return patterns.some((pattern) => new RegExp(pattern).test(joined));
}
function isManagedBoundary(value) { return /^(apps|packages|services|crates)\//.test(value); }
function matchesAny(value, patterns) { return patterns.some((p) => globLike(value, p)); }
function globLike(value, pattern) {
  const re = "^" + String(pattern).split("**").map((part) => part.split("*").map(escapeRegex).join("[^/]*")).join(".*") + "$";
  return new RegExp(re).test(value);
}
function matchSpecifier(value, rule) {
  if (rule.includes("*")) return globLike(value, rule);
  return value === rule || value.startsWith(rule + "/") || value.includes(rule);
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function finding(severity, rule, file, message) { return { severity, category: "architecture", rule, file, message }; }
function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.rule}|${item.file}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
