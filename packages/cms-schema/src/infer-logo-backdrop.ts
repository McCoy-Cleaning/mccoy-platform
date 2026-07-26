/**
 * Partner logo card (mat) color.
 *
 * Product rules:
 * - Existing / seeded logos default to a white box (`#ffffff`).
 * - New uploads: after plate stripping, the mat color is the solid plate
 *   that was removed (not ink luminance → light/dark).
 * - Editors may force white (`light`) or black (`dark`); `auto` uses the
 *   cached plate color in {@link LogoBackdropResolved}.
 */

export const LOGO_BACKDROP_WHITE = "#ffffff";
export const LOGO_BACKDROP_BLACK = "#000000";

/** Cached CSS color for the logo box (`#rrggbb`). */
export type LogoBackdropResolved = string;

/**
 * Editor preference. `light`/`dark` are white/black overrides (legacy names).
 * `white`/`black` accepted as aliases and normalized on migrate.
 */
export type LogoBackdropPreference = "auto" | "light" | "dark" | "white" | "black";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hex2(n: number): string {
  return clampByte(n).toString(16).padStart(2, "0");
}

/** RGB → normalized `#rrggbb`. */
export function rgbToLogoBackdropHex(rgb: { r: number; g: number; b: number }): string {
  return `#${hex2(rgb.r)}${hex2(rgb.g)}${hex2(rgb.b)}`;
}

/**
 * Normalize a stored/legacy backdrop value to `#rrggbb`, or null if unusable.
 * Accepts `#rgb`, `#rrggbb`, `light`/`white`, `dark`/`black`.
 */
export function normalizeLogoBackdropColor(color: string | null | undefined): string | null {
  if (color == null) return null;
  const raw = color.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "light" || raw === "white" || raw === "#fff" || raw === "#ffffff") {
    return LOGO_BACKDROP_WHITE;
  }
  if (raw === "dark" || raw === "black" || raw === "#000" || raw === "#000000") {
    return LOGO_BACKDROP_BLACK;
  }

  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (hex.length === 3) {
    const r = parseInt(hex[0]! + hex[0]!, 16);
    const g = parseInt(hex[1]! + hex[1]!, 16);
    const b = parseInt(hex[2]! + hex[2]!, 16);
    if (![r, g, b].every((n) => Number.isFinite(n))) return null;
    return rgbToLogoBackdropHex({ r, g, b });
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (![r, g, b].every((n) => Number.isFinite(n))) return null;
    return rgbToLogoBackdropHex({ r, g, b });
  }
  return null;
}

/** True when value is already a plate/CSS hex (not a legacy light|dark token). */
export function isPlateCssColor(value: string | null | undefined): boolean {
  if (value == null) return false;
  const raw = value.trim().toLowerCase();
  if (raw === "light" || raw === "dark" || raw === "white" || raw === "black") return false;
  return normalizeLogoBackdropColor(value) != null;
}

/**
 * Card color from the solid plate removed by {@link removeSolidLogoBackground}.
 * No matte → white (safe default matching existing logos).
 */
export function logoBackdropFromPlateMatte(
  matte: { r: number; g: number; b: number } | null | undefined,
): LogoBackdropResolved {
  if (!matte) return LOGO_BACKDROP_WHITE;
  return rgbToLogoBackdropHex(matte);
}

/**
 * @deprecated Prefer {@link logoBackdropFromPlateMatte}. Kept for callers that
 * still pass post-strip ImageData; returns white (no ink-luminance mats).
 */
export function inferLogoBackdrop(
  _imageData: Pick<ImageData, "data" | "width" | "height">,
): LogoBackdropResolved {
  return LOGO_BACKDROP_WHITE;
}

/**
 * Map a CSS / keyword color to a normalized resolved backdrop hex.
 */
export function logoBackdropFromCssColor(color: string): LogoBackdropResolved {
  return normalizeLogoBackdropColor(color) ?? LOGO_BACKDROP_WHITE;
}

/** CSS background for storefront / admin logo cards. */
export function logoBackdropCss(backdrop: LogoBackdropResolved): string {
  return normalizeLogoBackdropColor(backdrop) ?? LOGO_BACKDROP_WHITE;
}

function normalizePreference(
  pref: LogoBackdropPreference | null | undefined,
): "auto" | "light" | "dark" {
  if (pref === "light" || pref === "white") return "light";
  if (pref === "dark" || pref === "black") return "dark";
  return "auto";
}

/**
 * Resolve the card color to render: manual override wins; otherwise cached plate.
 * Legacy luminance tokens (`light`|`dark` in resolved) are treated as white so
 * existing logos do not keep auto dark mats after the product change.
 */
export function resolveLogoBackdrop(input: {
  logoBackdrop?: LogoBackdropPreference | null;
  resolvedBackdrop?: LogoBackdropResolved | null;
}): LogoBackdropResolved {
  const pref = normalizePreference(input.logoBackdrop);
  if (pref === "light") return LOGO_BACKDROP_WHITE;
  if (pref === "dark") return LOGO_BACKDROP_BLACK;
  if (isPlateCssColor(input.resolvedBackdrop)) {
    return normalizeLogoBackdropColor(input.resolvedBackdrop)!;
  }
  return LOGO_BACKDROP_WHITE;
}
