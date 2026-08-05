import * as React from "react";
import {
  resolveCmsButtonAction,
  resolveCmsLinkHref,
  linkRel,
  linkTarget,
  isCmsButtonInteractive,
  type CmsButton,
  type CmsLink,
} from "@mccoy/cms-schema";
import type { LinkResolverPages } from "./CmsImageView";
import { getPopupBlockView } from "./popupBlockRenderer";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function ButtonPopupDialog({
  button,
  pages,
  open,
  onClose,
}: {
  button: CmsButton;
  pages: LinkResolverPages;
  open: boolean;
  onClose: () => void;
}) {
  const titleId = React.useId();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const popup = button.popup;
  const BlockView = getPopupBlockView();

  React.useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !popup) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Sluit popup"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-[81] max-h-[min(90vh,880px)] w-full max-w-3xl overflow-y-auto",
          "rounded-2xl border border-white/15 bg-[#0b1220] p-5 shadow-2xl sm:p-7",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={titleId} className="sr-only">
            {button.label}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg px-2.5 py-1.5 text-sm text-white/55 hover:bg-white/10 hover:text-white"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>
        <div className="cms-button-popup-body">
          {BlockView ? (
            <BlockView
              block={{
                id: `button-popup-${popup.type}`,
                type: popup.type,
                data: popup.data,
              }}
              pages={pages}
              adminMode={false}
            />
          ) : (
            <p className="text-sm text-white/50">Laden…</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CmsButtonView({
  button,
  pages = [],
  className,
  onNavigate,
  children,
}: {
  button: CmsButton;
  pages?: LinkResolverPages;
  className?: string;
  onNavigate?: (link: CmsLink) => void;
  /** Optional custom content (e.g. label + arrow icon). Defaults to button.label. */
  children?: React.ReactNode;
}) {
  const [popupOpen, setPopupOpen] = React.useState(false);
  const action = resolveCmsButtonAction(button);
  const content = children ?? button.label;

  if (action === "popup" && button.popup) {
    return (
      <>
        <button
          type="button"
          className={className}
          aria-haspopup="dialog"
          aria-expanded={popupOpen}
          onClick={() => setPopupOpen(true)}
        >
          {content}
        </button>
        <ButtonPopupDialog
          button={button}
          pages={pages}
          open={popupOpen}
          onClose={() => setPopupOpen(false)}
        />
      </>
    );
  }

  if (!isCmsButtonInteractive(button)) {
    return null;
  }

  const href = resolveCmsLinkHref(button.link, pages) ?? "#";
  if (onNavigate) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          onNavigate(button.link);
        }}
      >
        {content}
      </button>
    );
  }
  if (button.link.type === "none") {
    return null;
  }
  return (
    <a
      href={href}
      className={className}
      target={linkTarget(button.link)}
      rel={linkRel(button.link)}
    >
      {content}
    </a>
  );
}
