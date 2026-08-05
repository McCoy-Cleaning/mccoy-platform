/**
 * Shared CMS primitives. Image and button live in dedicated modules so
 * RegisteredBlockView / galleries do not form an import cycle through a
 * dynamic import of RegisteredBlockView.
 */
export type { LinkResolverPages } from "./CmsImageView";
export { CmsImageView } from "./CmsImageView";
export { CmsButtonView } from "./CmsButtonView";
