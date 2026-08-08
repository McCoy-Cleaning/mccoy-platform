/**
 * Compatibility barrel for fixed about/services/products section views.
 *
 * R7: page orchestration lives in `PageLayoutRenderer` + `pageSectionRenderers`.
 * Prefer importing from the page-specific modules below.
 */

export { About } from "./AboutSections";
export { Services, ServicesMain, ServicesCards } from "./ServicesSections";
export { Products, ProductsMain, ProductsInfo } from "./ProductsFixedSections";
