/** Minimal `node:path` surface for client bundles that transitively import server env helpers. */

export function join(...parts) {
  return parts
    .filter((p) => p !== undefined && p !== null && String(p).length > 0)
    .join("/")
    .replace(/\/{2,}/g, "/");
}

export function resolve(...parts) {
  return join(...parts);
}

export function dirname(p) {
  const s = String(p);
  const i = s.lastIndexOf("/");
  return i <= 0 ? "." : s.slice(0, i);
}

export function basename(p) {
  const s = String(p).replace(/\/+$/, "");
  const i = s.lastIndexOf("/");
  return i < 0 ? s : s.slice(i + 1);
}

export function extname(p) {
  const base = basename(p);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i);
}

export function normalize(p) {
  return join(p);
}

export function isAbsolute(p) {
  return String(p).startsWith("/") || /^[A-Za-z]:[\\/]/.test(String(p));
}

export const sep = "/";
export const delimiter = ":";

export default {
  join,
  resolve,
  dirname,
  basename,
  extname,
  normalize,
  isAbsolute,
  sep,
  delimiter,
};
