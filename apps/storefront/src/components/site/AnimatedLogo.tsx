import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import logoUrl from "@/assets/logo-mccoy.png";
import logoWebpUrl from "@/assets/logo-mccoy.webp";
import { NAV_LOGO_HEIGHT, NAV_LOGO_WIDTH } from "@/lib/image-delivery";
import { useMobileLiteMotion } from "@/lib/use-mobile-lite-motion";

type Props = {
  className?: string;
  style?: CSSProperties;
};

/**
 * Real McCoy logo with a left-to-right reveal.
 * Uses opacity + translateX (compositor-friendly) — never clip-path, which
 * Lighthouse flags as non-composited and can stutter on mobile Safari.
 */
export function AnimatedLogo({ className = "h-12 md:h-16 w-auto", style }: Props) {
  const reducedMotion = useReducedMotion();
  const mobileLite = useMobileLiteMotion();
  const skip = Boolean(reducedMotion) || mobileLite;

  return (
    <div className={`relative inline-block ${className}`} style={style}>
      <picture>
        <source type="image/webp" srcSet={logoWebpUrl} />
        <motion.img
          src={logoUrl}
          alt="McCoy Cleaning"
          width={NAV_LOGO_WIDTH}
          height={NAV_LOGO_HEIGHT}
          decoding="async"
          className="h-full w-auto object-contain"
          initial={skip ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: skip ? 0 : 0.7,
            ease: [0.22, 1, 0.36, 1],
            delay: skip ? 0 : 0.05,
          }}
          draggable={false}
        />
      </picture>
    </div>
  );
}
