import * as React from "react";
import type { PreviewSnapshot } from "@mccoy/cms-schema";

const SnapshotCtx = React.createContext<PreviewSnapshot | null>(null);

export function PreviewSnapshotProvider({
  snapshot,
  children,
}: {
  snapshot: PreviewSnapshot | null;
  children: React.ReactNode;
}) {
  return <SnapshotCtx.Provider value={snapshot}>{children}</SnapshotCtx.Provider>;
}

export function usePreviewSnapshot() {
  return React.useContext(SnapshotCtx);
}
