/** Shared CMS image model (leaf — no imports from content/types). */
export type CmsImage = {
  assetId: string;
  src: string;
  alt: string;
  decorative: boolean;
  width?: number;
  height?: number;
  focalPoint?: { x: number; y: number };
};
