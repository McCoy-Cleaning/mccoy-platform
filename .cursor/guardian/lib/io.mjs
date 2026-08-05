import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return fallback; }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export async function readStdinJson() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  // Cursor may prefix hook stdin with a UTF-8 BOM
  raw = raw.replace(/^\uFEFF/, "");
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); }
  catch (error) { throw new Error(`Invalid hook JSON input: ${error.message}`); }
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function safeRead(file, maxBytes = 2_000_000) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    return fs.readFileSync(file, "utf8");
  } catch { return null; }
}

export function appendJsonLine(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(value) + "\n");
}

export function normalizeSlashes(value) {
  return String(value ?? "").replaceAll("\\", "/");
}

export function unique(values) {
  return [...new Set(values)];
}
