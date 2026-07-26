import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { loadMonorepoEnvPlugin } from "../../scripts/vite-load-monorepo-env";
// @ts-expect-error local JS vite plugin without bundled types
import { reactDomServerShimPlugin } from "../../scripts/vite-react-dom-server-shim.mjs";
// @ts-expect-error local JS vite plugin without bundled types
import { nodeBuiltinClientShimPlugin } from "../../scripts/vite-node-builtin-client-shim.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

// No Nitro/Cloudflare build step — same as storefront: local `vite preview` /
// Playwright need `dist/server/server.js`, not a Cloudflare Nitro output.
export default defineConfig(({ command, mode }) => {
  const isDevBuild = command === "build" && mode === "development";

  return {
    envDir: monorepoRoot,
    // `build:dev` (used by Playwright E2E via E2E_BUILD_MODE=development)
    // needs a build that behaves like dev mode: real NODE_ENV branches and
    // readable function/class names for debugging.
    ...(isDevBuild
      ? {
          environments: {
            client: { define: { "process.env.NODE_ENV": JSON.stringify("development") } },
          },
          esbuild: { keepNames: true },
        }
      : {}),
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        // Fails the build if server-only code (or anything importing
        // `server-only`) is pulled into the client bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      viteReact(),
      loadMonorepoEnvPlugin(monorepoRoot),
      reactDomServerShimPlugin(),
      nodeBuiltinClientShimPlugin(),
    ],
    server: {
      port: 5174,
      fs: {
        allow: [monorepoRoot],
      },
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      },
    },
    preview: {
      port: 4174,
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
  };
});
