"use client";

import { useEffect, useState } from "react";

export const SPLASH_STORAGE_KEY = "semiolab:first-open-splash:v2";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const finish = () => {
      // Grava a chave só DEPOIS que a animação (ou a permanência mínima,
      // em reduced-motion) terminou — nunca antes.
      localStorage.setItem(SPLASH_STORAGE_KEY, "1");
      onDone();
    };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    if (reduced) {
      const t0 = window.setTimeout(() => setReducedMotion(true), 0);
      const t1 = window.setTimeout(finish, 300);
      return () => { window.clearTimeout(t0); window.clearTimeout(t1); };
    }
    const t1 = window.setTimeout(() => setPhase("hold"), 350);
    const t2 = window.setTimeout(() => setPhase("out"), 1400);
    const t3 = window.setTimeout(finish, 2000);
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
