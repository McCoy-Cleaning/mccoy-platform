/**
 * Image primitive re-exports only. Keep the button in its own module so
 * registry section views importing this barrel cannot close an import cycle.
 */
export type { LinkResolverPages } from "./CmsImageView";
export { CmsImageView } from "./CmsImageView";
