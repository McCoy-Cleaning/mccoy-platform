import * as React from "react";

export type EditMode = "off" | "edit" | "preview";

export type EditCtx = {
  mode: EditMode;
  pageId: string | null;
  get: (key: string, fallback: string) => string;
  set: (key: string, value: string) => void;
};

const defaultEdit: EditCtx = {
  mode: "off",
  pageId: null,
  get: (_key, fallback) => fallback,
  set: () => {},
};

export const EditModeCtx = React.createContext<EditCtx>(defaultEdit);

export function useEdit(): EditCtx {
  return React.useContext(EditModeCtx);
}

export function pageIdForPath(path: string): string | null {
  const p = path.replace(/\/$/, "") || "/";
  const map: Record<string, string> = {
    "/": "page_home",
    "/about": "page_about",
    "/services": "page_services",
    "/products": "page_products",
    "/contact": "page_contact",
    "/vacatures": "page_vacatures",
    "/offerte": "page_offerte",
  };
  return map[p] ?? null;
}
