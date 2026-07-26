import { useEffect, useState } from "react";

/**
 * True on narrow viewports (or when matchMedia is unavailable during SSR → false).
 * Used to skip decorative Motion / infinite loops on the mobile LCP path.
 */
export function useMobileLiteMotion(breakpointPx = 768): boolean {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const sync = () => setLite(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpointPx]);

  return lite;
}
