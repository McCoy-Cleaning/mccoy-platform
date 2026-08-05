import fs from "node:fs";
import path from "node:path";
import { readJson, normalizeSlashes, unique } from "./io.mjs";

export function listFiles(root, options = {}) {
  const extensions = new Set(options.extensions ?? []);
  const sourceRoots = options.sourceRoots ?? ["apps", "packages", "src"];
  const ignoredParts = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "target", ".state"]);
  const output = [];
  const roots = sourceRoots.map((entry) => path.join(root, entry)).filter((entry) => fs.existsSync(entry));

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignoredParts.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (!extensions.size || extensions.has(path.extname(entry.name))) output.push(absolute);
      if (output.length >= (options.maxFiles ?? 8000)) return;
    }
  }
  for (const dir of roots) walk(dir);
  return output;
}

export function packageScripts(root) {
  return readJson(path.join(root, "package.json"), {})?.scripts ?? {};
}

export function boundaryFor(root, file) {
  const rel = normalizeSlashes(path.relative(root, file));
  const parts = rel.split("/");
  if (["apps", "packages", "services", "crates"].includes(parts[0]) && parts[1]) return `${parts[0]}/${parts[1]}`;
  if (parts[0] === "src") return "src";
  return parts[0] || ".";
}

export function changedFilesFromState(state) {
  return unique((state?.changedFiles ?? []).map((file) => path.resolve(file)));
}
