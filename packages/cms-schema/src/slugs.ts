export const RESERVED_SLUGS = new Set([
  "",
  "admin",
  "login",
  "api",
  "about",
  "services",
  "products",
  "contact",
  "vacatures",
  "offerte",
  "en",
  "cms-preview",
  "cms-sync",
  "preview",
  "assets",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function normalizeSlug(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^\/+/, "").replace(/\/+$/, "");
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[^a-z0-9-_]/g, "");
  s = s.replace(/-+/g, "-");
  return s;
}

export function slugToPath(normalized: string): string {
  if (!normalized) return "/";
  return `/${normalized}`;
}

export function validateCustomSlug(
  input: string,
  existingPaths: string[],
  options?: { currentPath?: string },
): { ok: true; path: string } | { ok: false; error: string } {
  const normalized = normalizeSlug(input);
  if (!normalized) {
    return { ok: false, error: "Slug mag niet leeg zijn." };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return { ok: false, error: `Slug “${normalized}” is gereserveerd.` };
  }
  if (normalized.includes("/") || normalized.includes("..") || normalized.includes("%")) {
    return { ok: false, error: "Slug bevat ongeldige tekens." };
  }
  const path = slugToPath(normalized);
  const clash = existingPaths.some(
    (p) => p === path && p !== options?.currentPath,
  );
  if (clash) {
    return { ok: false, error: "Slug bestaat al." };
  }
  return { ok: true, path };
}
