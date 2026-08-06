/**
 * Browser console helpers for the public storefront.
 * Production visitor consoles stay quiet; local/dev keeps diagnostics.
 */

export function clientDevError(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.error(...args);
  }
}

export function clientDevWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
}
