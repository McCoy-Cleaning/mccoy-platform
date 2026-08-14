/**
 * Imperative GA4 (gtag) loader. Call only after analytics consent is granted.
 * Idempotent for a given measurement ID within the page lifetime.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const loadedIds = new Set<string>();

export function loadGoogleAnalyticsGtag(measurementId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (loadedIds.has(measurementId)) return;
  loadedIds.add(measurementId);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
  });

  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-mccoy-ga4="${measurementId}"]`,
  );
  if (existing) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.mccoyGa4 = measurementId;
  document.head.appendChild(script);
}

/** Test helper — clears in-memory load guard. */
export function resetGtagLoadStateForTests(): void {
  loadedIds.clear();
}
