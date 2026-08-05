import path from "node:path";
import { listFiles, boundaryFor } from "../lib/project.mjs";
import { safeRead, normalizeSlashes } from "../lib/io.mjs";

const COMPONENT_EXTS = new Set([".jsx", ".tsx", ".vue", ".svelte"]);

export function checkReuse(root, guardian, policy, changedFiles = []) {
  const files = listFiles(root, { extensions: [...COMPONENT_EXTS], sourceRoots: guardian.sourceRoots, maxFiles: 5000 });
  const changed = new Set(changedFiles.map((file) => path.resolve(file)));
  const components = [];
  const findings = [];
  const fingerprints = new Map();

  for (const file of files) {
    const text = safeRead(file);
    if (text == null) continue;
    const rel = normalizeSlashes(path.relative(root, file));
    const names = componentNames(text, file);
    const lines = text.split(/\r?\n/).filter((line) => line.trim()).length;

    for (const name of names) components.push({ name, file, boundary: boundaryFor(root, file), changed: changed.has(path.resolve(file)) });
    if (changed.has(path.resolve(file)) && lines > (policy.maxComponentLines ?? 350)) {
      findings.push(warn("oversized-component", file, `${rel} has ${lines} non-empty lines; consider extracting focused reusable components.`));
    }

    const blocks = codeBlocks(text, policy.duplicateBlockMinLines ?? 12);
    for (const block of blocks) {
      const prior = fingerprints.get(block.hash);
      if (prior && prior.file !== file && (changed.has(path.resolve(file)) || changed.has(path.resolve(prior.file)))) {
        findings.push(warn("duplicate-component-block", file, `Exact repeated component block also appears in ${normalizeSlashes(path.relative(root, prior.file))}.`));
      } else if (!prior) fingerprints.set(block.hash, { file });
    }
  }

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i], b = components[j];
      if (a.boundary !== b.boundary || (!a.changed && !b.changed)) continue;
      if (a.name === b.name && path.basename(a.file) !== "index.tsx" && path.basename(b.file) !== "index.tsx") {
        findings.push(warn("duplicate-component-name", a.changed ? a.file : b.file, `Component '${a.name}' exists twice inside ${a.boundary}. Review before creating a parallel implementation.`));
      } else {
        const score = nameSimilarity(a.name, b.name);
        if (score >= (policy.similarNameThreshold ?? 0.82)) {
          findings.push(warn("similar-component-name", a.changed ? a.file : b.file, `Components '${a.name}' and '${b.name}' are ${Math.round(score * 100)}% name-similar; consider reuse or consolidation.`));
        }
      }
    }
  }
  return dedupe(findings);
}

function componentNames(text, file) {
  const names = new Set();
  const patterns = [
    /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/g,
    /export\s+(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/g,
    /export\s+class\s+([A-Z][A-Za-z0-9_]*)/g,
    /(?:name\s*:\s*["']|defineOptions\(\{\s*name\s*:\s*["'])([A-Z][A-Za-z0-9_]*)/g
  ];
  for (const re of patterns) for (const match of text.matchAll(re)) names.add(match[1]);
  if (!names.size) {
    const base = path.basename(file, path.extname(file));
    if (/^[A-Z]/.test(base)) names.add(base);
  }
  return [...names];
}

function codeBlocks(text, minLines) {
  const normalized = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  for (let i = 0; i + minLines <= normalized.length; i += Math.max(1, Math.floor(minLines / 2))) {
    const chunk = normalized.slice(i, i + minLines).join("\n")
      .replace(/["'`][^"'`]{0,80}["'`]/g, '"$"')
      .replace(/\b\d+\b/g, "0");
    if (chunk.length > 180) blocks.push({ hash: simpleHash(chunk) });
  }
  return blocks;
}
function nameSimilarity(a, b) {
  const A = new Set(splitName(a)), B = new Set(splitName(b));
  const union = new Set([...A, ...B]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const item of A) if (B.has(item)) intersection++;
  return intersection / union.size;
}
function splitName(value) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); }
function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}
function warn(rule, file, message) { return { severity: "warning", category: "reuse", rule, file, message }; }
function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.rule}|${item.file}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
