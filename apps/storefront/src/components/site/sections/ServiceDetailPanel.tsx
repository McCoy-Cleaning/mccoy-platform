/**
 * Single service detail panel — one DOM instance of `full` copy.
 * Always present in the React tree (SSR + client); open state is CSS/hidden/inert only.
 */

import { motion } from "motion/react";
import { ArrowRight, X, type LucideIcon } from "lucide-react";
import type { CmsButton } from "@mccoy/cms-schema";
import { CmsButtonView } from "@mccoy/cms-renderer";
import { DeliveryImage } from "@/components/site/DeliveryImage";
import type { ServiceDetailAnchor } from "./service-detail-anchors";

export type ServiceDetailCard = {
  id: string;
  title: string;
  full: readonly string[];
  imageSrc: string;
  cta: CmsButton | null;
  Icon: LucideIcon;
};

type ServiceDetailPanelProps = {
  card: ServiceDetailCard;
  anchor: ServiceDetailAnchor;
  open: boolean;
  eyebrow: string;
  closeLabel: string;
  onClose: () => void;
};

export function ServiceDetailPanel({
  card,
  anchor,
  open,
  eyebrow,
  closeLabel,
  onClose,
}: ServiceDetailPanelProps) {
  const Icon = card.Icon;
  const titleId = `service-modal-title-${anchor}`;
  // Remount motion nodes when opening so entrance animation matches the prior modal UX,
  // while closed SSR still emits the same text nodes (no crawler-only duplicate copy).
  const motionKey = open ? "open" : "ssr";

  return (
    <div
      id={anchor}
      hidden={!open}
      inert={!open ? true : undefined}
      aria-hidden={!open}
      className="fixed inset-0 z-[100] overflow-hidden bg-background/92"
    >
      <div
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="service-modal-panel fixed z-[101] grid max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-[0_40px_120px_-20px_rgba(63,182,242,0.5)] sm:rounded-[2rem] md:grid-cols-2 md:grid-rows-1"
      >
        <div className="relative h-40 shrink-0 overflow-hidden bg-black/35 sm:h-64 md:h-auto">
          <DeliveryImage
            src={card.imageSrc}
            alt={card.title}
            variant="gallery"
            width={800}
            height={1000}
            loading={open ? "eager" : "lazy"}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent md:bg-gradient-to-r" />
          <div className="absolute left-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/50 sm:left-6 sm:top-6 sm:h-14 sm:w-14">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
        <div className="relative min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8 md:p-10">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-primary/50 hover:text-white sm:right-5 sm:top-5"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </button>
          <motion.p
            key={`${motionKey}-eyebrow`}
            initial={open ? { opacity: 0, x: 20 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: open ? 0.2 : 0, duration: open ? 0.5 : 0 }}
            className="pr-12 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary sm:text-xs"
          >
            {eyebrow}
          </motion.p>
          <motion.h3
            key={`${motionKey}-title`}
            id={titleId}
            initial={open ? { opacity: 0, x: 20 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: open ? 0.28 : 0, duration: open ? 0.5 : 0 }}
            className="font-display mt-2 text-2xl text-white sm:mt-3 sm:text-3xl md:text-4xl"
          >
            {card.title}
          </motion.h3>
          <motion.div
            key={`${motionKey}-rule`}
            initial={open ? { scaleX: 0 } : false}
            animate={{ scaleX: 1 }}
            transition={{ delay: open ? 0.45 : 0, duration: open ? 0.6 : 0, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 h-0.5 w-16 origin-left rounded-full bg-primary"
          />
          <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-white/75 sm:mt-6 sm:space-y-4 sm:text-[15px]">
            {card.full.map((p, idx) => (
              <motion.p
                key={`${motionKey}-p-${idx}`}
                initial={open ? { opacity: 0, y: 14 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: open ? 0.5 + idx * 0.08 : 0, duration: open ? 0.45 : 0 }}
              >
                {p}
              </motion.p>
            ))}
          </div>
          {card.cta ? (
            <motion.div
              key={`${motionKey}-cta`}
              initial={open ? { opacity: 0, y: 14 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: open ? 0.7 : 0, duration: open ? 0.5 : 0 }}
              className="mt-6 sm:mt-8"
              onClick={onClose}
            >
              <CmsButtonView
                button={card.cta}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-[1.03] sm:px-6"
              >
                {card.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </CmsButtonView>
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}