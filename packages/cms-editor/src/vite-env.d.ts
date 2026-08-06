/**
 * Vite/Vitest `import.meta.env` typings.
 * Required when TypeScript follows workspace imports into `@mccoy/cms-renderer`
 * (and other Vite packages) that reference `import.meta.env`.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
