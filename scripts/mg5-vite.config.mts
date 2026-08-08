import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Minimal Vite config for MG5 operator CLI (vite-node).
 * Avoids loading root TanStack Start app config.
 */
export default defineConfig({
  root,
  resolve: {
    alias: {
      "@mccoy/cms-schema": path.join(root, "packages/cms-schema/src/index.ts"),
      "@mccoy/database/server": path.join(root, "packages/database/src/server.ts"),
      "@mccoy/security/load-monorepo-env": path.join(
        root,
        "packages/security/src/load-monorepo-env.server.ts",
      ),
      "@mccoy/domain": path.join(root, "packages/domain/src/index.ts"),
    },
  },
});
