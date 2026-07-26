/**
 * Server env reader. No `node:*` imports — accidental client imports must not crash.
 *
 * Vite exposes only `VITE_*` on `import.meta.env`. Server secrets (e.g.
 * `SUPABASE_SECRET_KEY`) require the monorepo env plugin
 * (`scripts/vite-load-monorepo-env.mjs`) to copy root `.env` into `process.env`.
 */

type ProcessLike = {
  env?: Record<string, string | undefined>;
  cwd?: () => string;
};

function getProcess(): ProcessLike | undefined {
  try {
    return (globalThis as { process?: ProcessLike }).process;
  } catch {
    return undefined;
  }
}

export function readServerEnv(name: string): string {
  return getProcess()?.env?.[name]?.trim() || "";
}

/**
 * Resolve the monorepo root from a process cwd.
 *
 * Critical: admin (:5174) and storefront (:5173) each run with cwd `apps/<name>`.
 * Returning cwd alone made them write/read separate `.data/cms-published.json`
 * files, so Opslaan never reached the storefront hydrate path.
 */
export function findMonorepoRoot(startDir?: string): string {
  // Avoid bare `window` — this package's tsconfig has no DOM lib.
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") return "";
  try {
    const cwd = startDir || getProcess()?.cwd?.() || "";
    if (!cwd) return "";
    const trimmed = cwd.replace(/[\\/]+$/, "");
    const unix = trimmed.replace(/\\/g, "/");
    const appsMarker = "/apps/";
    const idx = unix.lastIndexOf(appsMarker);
    if (idx >= 0) {
      const after = unix.slice(idx + appsMarker.length);
      // `.../apps/admin` or `.../apps/storefront` (single segment) → parent is root
      if (after && !after.includes("/")) {
        const rootUnix = unix.slice(0, idx);
        if (!rootUnix) return trimmed;
        return trimmed.includes("\\") ? rootUnix.replace(/\//g, "\\") : rootUnix;
      }
    }
    return trimmed;
  } catch {
    return "";
  }
}

export function getDataDir(): string {
  const override = readServerEnv("MCCOY_DATA_DIR");
  if (override) return override;
  const root = findMonorepoRoot();
  if (!root) return ".data";
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root}${sep}.data`;
}
