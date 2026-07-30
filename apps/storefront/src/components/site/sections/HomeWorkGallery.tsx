import wRegular from "@/assets/work-regular.jpg";
import wHoreca from "@/assets/work-horeca-new.jpg";
import wOpl from "@/assets/work-oplevering.jpg";
import wFloor from "@/assets/work-floor.jpg";
import wGlass from "@/assets/work-glass.jpg";
/** Prefer JPEG (~140KB) over the 1.8MB PNG sibling — same frame, far less mobile payload. */
import aboutVision from "@/assets/mccoy-about-vision.jpg";
import { useI18n } from "@/lib/i18n";
import { GALLERY_IMAGE_SIZES } from "@/lib/image-delivery";
import { DeliveryImage } from "../DeliveryImage";
import { useTypedSectionContent } from "@/lib/cms/use-section-content";
import { localizedWorkGalleryCopy } from "@/lib/cms-i18n";
import { WorkMosaicGallery } from "@mccoy/cms-renderer";

function isCmsPlaceholderSrc(src: string | undefined): boolean {
  return !src || src.includes("placeholder");
}

/** Exact order from the legacy Sections.tsx WorkGallery */
const HOME_GALLERY_FALLBACKS = [wRegular, wHoreca, wOpl, wFloor, aboutVision, wGlass];

export function WorkGallery() {
  const { t } = useI18n();
  const content = useTypedSectionContent("page_home", "home.workGallery");
  const copy = localizedWorkGalleryCopy(content, t);
  const fallbackImages = HOME_GALLERY_FALLBACKS;
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

  return (
    <WorkMosaicGallery
      eyebrow={copy.eyebrow}
      heading={copy.heading}
      body={copy.body}
      items={galleryItems}
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
    />
  );
}
