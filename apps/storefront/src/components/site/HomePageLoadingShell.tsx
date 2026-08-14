/**
 * Stable route-level fallback. It reserves the final Hero viewport without
 * fabricating CMS copy or briefly showing a real below-fold section.
 */
export function HomePageLoadingShell() {
  return (
    <main data-page-loading-shell="home" aria-busy="true">
      <div className="min-h-[100svh] bg-background pt-24" aria-hidden="true" />
      <span className="sr-only" role="status">
        Pagina laden
      </span>
    </main>
  );
}
