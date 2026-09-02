import { createContext, useContext, type ReactNode } from "react";
import {
  planOverlayH1,
  resolveOverlayHeading,
  type EdgePagePatch,
} from "./aether-edge-overlay";

const EdgeSeoOverlayCtx = createContext<EdgePagePatch | null>(null);

export function EdgeSeoOverlayProvider(props: {
  patch: EdgePagePatch | null;
  children: ReactNode;
}) {
  return createProvider(props.patch, props.children);
}

function createProvider(patch: EdgePagePatch | null, children: ReactNode) {
  return (
    <EdgeSeoOverlayCtx.Provider value={patch}>{children}</EdgeSeoOverlayCtx.Provider>
  );
}

export function useEdgePagePatch(): EdgePagePatch | null {
  return useContext(EdgeSeoOverlayCtx);
}

export function useOverlayHeading(existingHeading: string): string {
  const patch = useEdgePagePatch();
  return resolveOverlayHeading(existingHeading, patch?.h1);
}

export function useOverlayH1Plan(input: {
  hasExistingH1: boolean;
  existingHeading?: string | null;
  pageTitle?: string | null;
}) {
  const patch = useEdgePagePatch();
  return planOverlayH1({ ...input, patchH1: patch?.h1 });
}
export function EdgeInjectedH1(props: { pageTitle?: string | null; className?: string }) {
  const plan = useOverlayH1Plan({
    hasExistingH1: false,
    pageTitle: props.pageTitle,
  });
  if (plan.mode !== "inject") return null;
  return <h1 className={props.className}>{plan.text}</h1>;
}
