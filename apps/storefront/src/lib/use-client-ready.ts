import { useEffect, useState } from "react";

/**
 * False during SSR and the first client paint; true after mount.
 * Use to disable submit controls until React listeners (preventDefault) are attached,
 * so a premature click cannot trigger a native GET navigation with query params.
 */
export function useClientReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready;
}
