/**
 * Root Vite shim for tooling that still expects a config at the repo root
 * (e.g. editor/IDE auto-detection). Prefer running apps via workspaces:
 *   npm run dev:storefront | npm run dev:admin
 */
export { default } from "./apps/storefront/vite.config.ts";
