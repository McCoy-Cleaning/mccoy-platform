import type { Plugin } from "vite";
import { loadEnv } from "vite";

/**
 * Vite only exposes `VITE_*` via `import.meta.env`. Server secrets such as
 * `SUPABASE_SECRET_KEY` live in the monorepo-root `.env` and must be copied
 * into `process.env` for TanStack `createServerFn` / SSR.
 *
 * Vite's own env loading is scoped to `process.cwd()`, which misses the root
 * `.env` when the app cwd is `apps/admin` or `apps/storefront`. This plugin
 * forces both `process.env` and `import.meta.env.VITE_*` from `monorepoRoot`.
 */
export function loadMonorepoEnvPlugin(monorepoRoot: string): Plugin {
  return {
    name: "mccoy-load-monorepo-env",
    config(_userConfig, { mode }) {
      const allEnv = loadEnv(mode, monorepoRoot, "");
      for (const [key, value] of Object.entries(allEnv)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      const viteEnv = loadEnv(mode, monorepoRoot, "VITE_");
      const define: Record<string, string> = {};
      for (const [key, value] of Object.entries(viteEnv)) {
        define[`import.meta.env.${key}`] = JSON.stringify(value);
      }

      return {
        envDir: monorepoRoot,
        define,
      };
    },
  };
}
