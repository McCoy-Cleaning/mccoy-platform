/**
 * Vite client remaps `react-dom/server` → shim with a default export.
 * TanStack renderRouterToString uses a default import; React 19's browser
 * build only exposes named exports.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHIM = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "shims/react-dom-server-default.mjs",
);

export function reactDomServerShimPlugin() {
  return {
    name: "mccoy-react-dom-server-shim",
    enforce: "pre",
    resolveId(source, _importer, options) {
      if (source === "react-dom/server" && !options?.ssr) {
        return SHIM;
      }
      return null;
    },
  };
}
