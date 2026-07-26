import * as React from "react";
import type { CmsImage } from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "@mccoy/cms-editor";
import { CMS_PROJECT_IMAGES, storefrontOrigin } from "@/lib/cms/project-images";
import {
  assetToCmsImage,
  buildSourcePathImageMap,
  listCmsMediaLibrary,
  uploadCmsMediaFromFile,
  type CmsMediaAssetDto,
} from "@/lib/cms/media-client";

/** Admin wiring: Supabase Storage upload + seeded path → Storage resolution. */
export function useCmsImagePickerProps(): CmsImagePickerProps {
  const assetBaseUrl = React.useMemo(() => storefrontOrigin(), []);
  const [mediaLibraryItems, setMediaLibraryItems] = React.useState<
    NonNullable<CmsImagePickerProps["mediaLibraryItems"]>
  >([]);
  const [projectStorageByPath, setProjectStorageByPath] = React.useState<Record<string, CmsImage>>(
    {},
  );

  React.useEffect(() => {
    let cancelled = false;
    void listCmsMediaLibrary({ status: "active" }).then((result) => {
      if (cancelled || !result.ok) return;
      const assets = result.items as CmsMediaAssetDto[];
      const pathMap = buildSourcePathImageMap(assets);
      setProjectStorageByPath(pathMap);
      setMediaLibraryItems(
        assets.map((asset) => ({
          image: assetToCmsImage(asset),
          label: asset.originalFilename?.replace(/\.[^.]+$/, "") || asset.altDefault || asset.id,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const uploadToMediaLibrary = React.useCallback(
    async (input: {
      file: File;
      profile: "photo" | "logo";
      tags: string[];
      alt?: string;
    }) => {
      const result = await uploadCmsMediaFromFile({
        file: input.file,
        profile: input.profile,
        tags: input.tags,
        altDefault: input.alt,
      });
      if (!result.ok) return { ok: false as const, reason: result.error };
      // Refresh library map so new uploads appear in picker grids.
      void listCmsMediaLibrary({ status: "active" }).then((listed) => {
        if (!listed.ok) return;
        const assets = listed.items as CmsMediaAssetDto[];
        setProjectStorageByPath(buildSourcePathImageMap(assets));
        setMediaLibraryItems(
          assets.map((asset) => ({
            image: assetToCmsImage(asset),
            label: asset.originalFilename?.replace(/\.[^.]+$/, "") || asset.altDefault || asset.id,
          })),
        );
      });
      return {
        ok: true as const,
        image: result.image,
        label: result.asset.originalFilename?.replace(/\.[^.]+$/, "") || input.file.name,
        reused: result.reused,
        ...(result.logoBackdrop ? { logoBackdrop: result.logoBackdrop } : {}),
      };
    },
    [],
  );

  const resolveProjectImage = React.useCallback(
    (path: string): CmsImage | null => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      return projectStorageByPath[normalized] ?? null;
    },
    [projectStorageByPath],
  );

  return React.useMemo(
    () => ({
      projectImages: CMS_PROJECT_IMAGES,
      assetBaseUrl,
      uploadToMediaLibrary,
      mediaLibraryItems,
      resolveProjectImage,
    }),
    [assetBaseUrl, uploadToMediaLibrary, mediaLibraryItems, resolveProjectImage],
  );
}
