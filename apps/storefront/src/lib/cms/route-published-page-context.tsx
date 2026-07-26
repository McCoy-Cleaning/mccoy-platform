import * as React from "react";
import type { CmsPage } from "@mccoy/cms-schema";

/**
 * Loader-resolved page for the active route. Section hooks must prefer this over
 * the in-memory CMS seed so SSR HTML matches the client's first paint
 * (`useCmsPageForView ?? snapshot.page` never falls through because seed always
 * contains builtin page ids).
 */
const RoutePublishedPageCtx = React.createContext<CmsPage | null>(null);

export function RoutePublishedPageProvider({
  page,
  children,
}: {
  page: CmsPage;
  children: React.ReactNode;
}) {
  return (
    <RoutePublishedPageCtx.Provider value={page}>{children}</RoutePublishedPageCtx.Provider>
  );
}

export function useRoutePublishedPage(): CmsPage | null {
  return React.useContext(RoutePublishedPageCtx);
}
