import type { ComponentType } from "react";
import type { Block } from "@mccoy/cms-schema";
import type { LinkResolverPages } from "./CmsImageView";

export type PopupBlockViewProps = {
  block: Block;
  pages?: LinkResolverPages;
  adminMode?: boolean;
};

type PopupBlockView = ComponentType<PopupBlockViewProps>;

let popupBlockView: PopupBlockView | null = null;

/** Register the block renderer used inside button popups (avoids import cycles). */
export function registerPopupBlockView(view: PopupBlockView): void {
  popupBlockView = view;
}

export function getPopupBlockView(): PopupBlockView | null {
  return popupBlockView;
}

/** Clears the bridge — for unit tests that assert re-registration on load. */
export function clearPopupBlockView(): void {
  popupBlockView = null;
}
