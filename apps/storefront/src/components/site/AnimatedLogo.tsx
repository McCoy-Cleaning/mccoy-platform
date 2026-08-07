import type { CSSProperties } from "react";
import logoUrl from "@/assets/logo-mccoy.png";
import logoWebpUrl from "@/assets/logo-mccoy.webp";
import { NAV_LOGO_HEIGHT, NAV_LOGO_WIDTH } from "@/lib/image-delivery";

type Props = {
  className?: string;
  style?: CSSProperties;
};

/**
 * McCoy wordmark — static image (no Motion) so the navbar stays off the
 * homepage JS / TBT critical path.
 */
export function AnimatedLogo({ className = "h-12 md:h-16 w-auto", style }: Props) {
  return (
    <div className={`relative inline-block ${className}`} style={style}>
      <picture>
        <source type="image/webp" srcSet={logoWebpUrl} />
        <img
          src={logoUrl}
          alt="McCoy Cleaning"
          width={NAV_LOGO_WIDTH}
          height={NAV_LOGO_HEIGHT}
          decoding="async"
          fetchPriority="low"
          className="h-full w-auto object-contain"
          style={{ aspectRatio: "auto" }}
          draggable={false}
        />
      </picture>
    </div>
  );
}
