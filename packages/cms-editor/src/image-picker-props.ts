import type { CmsImage, LogoBackdropResolved } from "@mccoy/cms-schema";
import type { CmsImageCompressProfile } from "./compress-image";

/**
 * Shared props for CMS image pickers / block image fields.
 * When `uploadToMediaLibrary` is set, new file picks must go to Storage (no data: embeds).
 * When `resolveProjectImage` returns a Storage image, project-path clicks prefer Supabase.
 */
export type CmsImagePickerProps = {
  projectImages?: Array<{ path: string; label: string; tags?: string[] }>;
  assetBaseUrl?: string;
  uploadToMediaLibrary?: (input: {
    file: File;
    profile: CmsImageCompressProfile;
    tags: string[];
    alt?: string;
  }) => Promise<
    | {
        ok: true;
        image: CmsImage;
        label: string;
        reused?: boolean;
        /** Set when profile is logo: plate color from background removal (hex). */
        logoBackdrop?: LogoBackdropResolved;
      }
    | { ok: false; reason: string }
  >;
  /** Active Supabase media-library assets for quick pick (optional). */
  mediaLibraryItems?: Array<{ image: CmsImage; label: string }>;
  /**
   * Resolve a storefront `/images/...` project path to a Storage `CmsImage`
   * when the asset was seeded (`source:` tag). Return null to keep local path.
   */
  resolveProjectImage?: (path: string) => CmsImage | null;
};
