import wRegular from "@/assets/work-regular.webp";
import wHoreca from "@/assets/work-horeca-new.webp";
import wOpl from "@/assets/work-oplevering.webp";
import wFloor from "@/assets/work-floor.webp";
import wGlass from "@/assets/work-glass.webp";
/** Prefer optimized JPEG/WebP over the large PNG sibling — same frame, far less mobile payload. */
import aboutVision from "@/assets/mccoy-about-vision.webp";
import { useI18n } from "@/lib/i18n";
import { GALLERY_IMAGE_SIZES } from "@/lib/image-delivery";
import { DeliveryImage } from "../DeliveryImage";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedWorkGalleryCopy } from "@/lib/cms-i18n";
import { WorkMosaicGallery } from "@mccoy/cms-renderer";
import type { GalleryItem, WorkGalleryContent } from "@mccoy/cms-schema";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { WysiwygInlineText } from "../cms-editor/WysiwygInlineText";
import {
  WysiwygGalleryAddTileButton,
  WysiwygGalleryTileChrome,
} from "../cms-editor/WysiwygGalleryTile";

function isCmsPlaceholderSrc(src: string | undefined): boolean {
  return !src || src.includes("placeholder");
}

/** Exact order from the legacy Sections.tsx WorkGallery */
const HOME_GALLERY_FALLBACKS = [wRegular, wHoreca, wOpl, wFloor, aboutVision, wGlass];

export function WorkGallery() {
  const { t } = useI18n();
  const { showEditorChrome, sendMutation } = useLiveEditApi();
  const content = useTypedSectionContent("page_home", "home.workGallery");
  const copy = localizedWorkGalleryCopy(content, t);
  const fallbackImages = HOME_GALLERY_FALLBACKS;
  const sourceItems: GalleryItem[] = content.items;
  const galleryItems = copy.items.map((item, i) => {
    const src = isCmsPlaceholderSrc(item.image.src)
      ? fallbackImages[i] || HOME_GALLERY_FALLBACKS[0]
      : item.image.src;
    return {
      id: item.id,
      title: item.title || "McCoy work",
      caption: item.caption?.trim() || "",
      shape: item.shape,
      image: {
        ...item.image,
        src,
        alt: item.image.alt || item.title || "McCoy work",
      },
    };
  });

  const patchItem = (id: string, patch: Partial<GalleryItem>) => {
    sendMutation({
      kind: "section",
      sectionKey: "home.workGallery",
      patch: {
        items: sourceItems.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      } satisfies Partial<WorkGalleryContent>,
    });
  };

  return (
    <WorkMosaicGallery
      eyebrow={copy.eyebrow}
      heading={copy.heading}
      body={copy.body}
      items={galleryItems}
      renderEyebrow={
        copy.eyebrow != null || showEditorChrome ? (
          <WysiwygInlineText
            label="Eyebrow"
            value={copy.eyebrow ?? ""}
            enFieldPath="section:home.workGallery:eyebrow"
            target={{ kind: "section", sectionKey: "home.workGallery", field: "eyebrow" }}
          />
        ) : undefined
      }
      renderHeading={
        <WysiwygInlineText
          as="span"
          label="Kop"
          value={copy.heading}
          enFieldPath="section:home.workGallery:heading"
          target={{ kind: "section", sectionKey: "home.workGallery", field: "heading" }}
        />
      }
      renderBody={
        copy.body != null || showEditorChrome ? (
          <WysiwygInlineText
            as="span"
            multiline
            label="Tekst"
            value={copy.body ?? ""}
            enFieldPath="section:home.workGallery:body"
            target={{ kind: "section", sectionKey: "home.workGallery", field: "body" }}
          />
        ) : undefined
      }
      renderImage={(item, className) => (
        <DeliveryImage
          variant="gallery"
          src={item.image.src}
          alt={item.caption ? `${item.title} — ${item.caption}` : item.title}
          width={1200}
          height={900}
          loading="lazy"
          decoding="async"
          sizes={GALLERY_IMAGE_SIZES}
          className={className}
        />
      )}
      renderFigcaption={(item) => (
        <>
          <p className="font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-white sm:text-xl">
            <WysiwygInlineText
              as="span"
              label="Titel"
              value={item.title}
              target={{
                kind: "custom",
                onCommit: (next) => patchItem(item.id, { title: next }),
              }}
            />
          </p>
          {(item.caption || showEditorChrome) && (
            <p className="mt-1.5 text-sm leading-snug text-white/68">
              <WysiwygInlineText
                as="span"
                multiline
                label="Bijschrift"
                value={item.caption ?? ""}
                target={{
                  kind: "custom",
                  onCommit: (next) => patchItem(item.id, { caption: next }),
                }}
              />
            </p>
          )}
        </>
      )}
      renderTile={
        showEditorChrome
          ? ({ item, spanClass, figure }) => {
              const source = sourceItems.find((g) => g.id === item.id) ?? {
                id: item.id,
                title: item.title,
                caption: item.caption,
                image: item.image,
                shape: item.shape,
              };
              return (
                <WysiwygGalleryTileChrome item={source} items={sourceItems} spanClass={spanClass}>
                  {figure}
                </WysiwygGalleryTileChrome>
              );
            }
          : undefined
      }
      renderAfterItems={
        showEditorChrome ? <WysiwygGalleryAddTileButton items={sourceItems} /> : null
      }
    />
  );
}
