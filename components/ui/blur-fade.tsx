"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Implementação mínima local — o projeto ainda não tinha este
 * componente. Fade + blur + leve deslocamento vertical na entrada,
 * com delay configurável. Respeita prefers-reduced-motion. */
export function BlurFade({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (reducedMotion) { setVisible(true); return; }
    const timer = window.setTimeout(() => setVisible(true), delay * 1000);
    return () => window.clearTimeout(timer);
  }, [delay, reducedMotion]);

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        filter: visible ? "blur(0px)" : "blur(6px)",
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: reducedMotion ? "none" : `opacity ${duration}s ease, filter ${duration}s ease, transform ${duration}s ease`,
      }}
    >
      {children}
    </div>
  );
}
