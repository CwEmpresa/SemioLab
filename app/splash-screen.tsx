"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "semiolab:seen-splash";

export function shouldSkipSplash(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, "1");
    if (reducedMotion) {
      const t = window.setTimeout(onDone, 300);
      return () => window.clearTimeout(t);
    }
    const t1 = window.setTimeout(() => setPhase("hold"), 350);
    const t2 = window.setTimeout(() => setPhase("out"), 1400);
    const t3 = window.setTimeout(onDone, 2000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="splash-screen">
      <img
        src="/semiolab-logo.png"
        alt="SemioLab"
        className={`splash-logo splash-${reducedMotion ? "static" : phase}`}
      />
    </div>
  );
}
