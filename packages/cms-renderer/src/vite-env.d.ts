/**
 * Minimal Vite/Vitest `import.meta.env` typings for this package (no vite dependency).
 * Keep this in `src/` so `tsc -p tsconfig.json` (include: src/**) always sees it.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
