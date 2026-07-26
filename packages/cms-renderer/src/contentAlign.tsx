import * as React from "react";
import {
  DEFAULT_CONTENT_ALIGN,
  type ContentAlign,
} from "@mccoy/cms-schema";

const ContentAlignContext = React.createContext<ContentAlign>(DEFAULT_CONTENT_ALIGN);

export function ContentAlignProvider({
  align,
  children,
}: {
  align?: ContentAlign | null;
  children: React.ReactNode;
}) {
  const value = align ?? DEFAULT_CONTENT_ALIGN;
  return <ContentAlignContext.Provider value={value}>{children}</ContentAlignContext.Provider>;
}

export function useContentAlign(): ContentAlign {
  return React.useContext(ContentAlignContext);
}
