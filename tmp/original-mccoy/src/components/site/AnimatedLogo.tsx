import { motion } from "motion/react";
import logoAsset from "@/assets/logo-mccoy.png.asset.json";

type Props = {
  className?: string;
};

/** Real McCoy logo with a left-to-right wipe-reveal animation. */
export function AnimatedLogo({ className = "h-12 md:h-16 w-auto" }: Props) {
  return (
    <div className={`relative inline-block ${className}`}>
      <motion.img
        src={logoAsset.url}
        alt="McCoy Cleaning"
        className="h-full w-auto object-contain"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        draggable={false}
      />
    </div>
  );
}