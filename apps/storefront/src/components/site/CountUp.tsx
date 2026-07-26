import { useEffect, useRef } from "react";

export function CountUp({
  value,
  duration = 2.4,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const match = value.match(/^(\d+)(.*)$/);
  const target = match ? parseInt(match[1], 10) : 0;
  const suffix = match ? match[2] : value;

  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    if (startedRef.current) {
      el.textContent = `${target}${suffix}`;
      return;
    }
    el.textContent = `0${suffix}`;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion || target === 0) {
        el.textContent = `${target}${suffix}`;
        return;
      }

      const startTime = window.performance.now();
      const totalMs = duration * 1000;
      let timer = 0;
      const tick = () => {
        const now = window.performance.now();
        const progress = Math.min((now - startTime) / totalMs, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        el.textContent = `${Math.round(target * eased)}${suffix}`;
        if (progress < 1) {
          timer = window.setTimeout(tick, 50);
        } else {
          el.textContent = `${target}${suffix}`;
        }
      };
      tick();
      return () => window.clearTimeout(timer);
    };

    let stop: (() => void) | undefined;

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            stop = start();
            io.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      io.observe(el);
      const t = window.setTimeout(() => {
        stop = start();
        io.disconnect();
      }, 1200);
      return () => {
        io.disconnect();
        window.clearTimeout(t);
        stop?.();
      };
    } else {
      stop = start();
      return () => stop?.();
    }
  }, [target, suffix, duration]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
