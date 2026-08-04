import { useEffect, useState } from "react";

/**
 * True on narrow viewports — skip decorative Motion / infinite loops on the
 * mobile LCP path.
 *
 * SSR defaults to `true` so the first HTML paint is fully visible (no
 * opacity:0 Framer initials). After hydrate, matchMedia refines for desktop
 * entrance motion. Starting at `false` caused mobile Speed Index blank frames.
 */
export function useMobileLiteMotion(breakpointPx = 768): boolean {
  const [lite, setLite] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const sync = () => setLite(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpointPx]);

  return lite;
}
