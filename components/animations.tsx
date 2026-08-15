"use client";
import { useEffect, useRef, useCallback } from "react";

/* ─── GSAP loader (CDN, client-only) ─────────────────────────── */
declare global {
  interface Window {
    gsap: any;
    ScrollTrigger: any;
  }
}

let gsapLoaded = false;
let gsapPromise: Promise<void> | null = null;

function loadGSAP(): Promise<void> {
  if (gsapLoaded) return Promise.resolve();
  if (gsapPromise) return gsapPromise;
  gsapPromise = new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(); return; }
    const core = document.createElement("script");
    core.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
    core.onload = () => {
      const st = document.createElement("script");
      st.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
      st.onload = () => {
        window.gsap.registerPlugin(window.ScrollTrigger);
        gsapLoaded = true;
        resolve();
      };
      document.head.appendChild(st);
    };
    document.head.appendChild(core);
  });
  return gsapPromise;
}

/* ─── Screen transition ───────────────────────────────────────── */
export function useScreenTransition(screen: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      const gsap = window.gsap;
      gsap.fromTo(ref.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.42, ease: "power3.out", clearProps: "all" }
      );
    });
    return () => { cancelled = true; };
  }, [screen]);
  return ref;
}

/* ─── Stagger reveal on mount ────────────────────────────────── */
export function useStaggerReveal(selector: string, deps: any[] = []) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      const gsap = window.gsap;
      const items = ref.current.querySelectorAll(selector);
      if (!items.length) return;
      gsap.fromTo(items,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out", clearProps: "all" }
      );
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* ─── Animated counter ───────────────────────────────────────── */
export function useCountUp(target: number, suffix = "", decimals = 0) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      const gsap = window.gsap;
      const el = ref.current;
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.4,
        ease: "power2.out",
        onUpdate() {
          el.textContent = decimals > 0
            ? obj.val.toFixed(decimals) + suffix
            : Math.round(obj.val) + suffix;
        },
      });
    });
    return () => { cancelled = true; };
  }, [target, suffix, decimals]);
  return ref;
}

/* ─── Progress bar animated fill ────────────────────────────── */
export function useProgressBar(percent: number) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      window.gsap.fromTo(ref.current,
        { width: "0%" },
        { width: `${percent}%`, duration: 1.1, ease: "power3.out", delay: 0.2 }
      );
    });
    return () => { cancelled = true; };
  }, [percent]);
  return ref;
}

/* ─── Chart bars grow ────────────────────────────────────────── */
export function useChartBars(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !containerRef.current) return;
      const bars = containerRef.current.querySelectorAll(".chart span > i");
      if (!bars.length) return;
      window.gsap.fromTo(bars,
        { scaleY: 0, transformOrigin: "bottom" },
        { scaleY: 1, duration: 0.7, stagger: 0.07, ease: "power3.out", delay: 0.3 }
      );
    });
    return () => { cancelled = true; };
  }, [containerRef]);
}

/* ─── Floating card entrance (hero) ─────────────────────────── */
export function useFloatCards(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !containerRef.current) return;
      const gsap = window.gsap;
      const cards = containerRef.current.querySelectorAll(".heart-float");
      cards.forEach((card, i) => {
        gsap.fromTo(card,
          { opacity: 0, scale: 0.8, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.65, ease: "back.out(1.5)", delay: 0.6 + i * 0.18 }
        );
      });
    });
    return () => { cancelled = true; };
  }, [containerRef]);
}

/* ─── Sidebar nav stagger ────────────────────────────────────── */
export function useSidebarReveal(open: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      if (!open) return;
      const buttons = ref.current.querySelectorAll("nav button, .side-extra button");
      window.gsap.fromTo(buttons,
        { opacity: 0, x: -14 },
        { opacity: 1, x: 0, duration: 0.38, stagger: 0.06, ease: "power2.out", clearProps: "all" }
      );
    });
    return () => { cancelled = true; };
  }, [open]);
  return ref;
}

/* ─── Streak day pop ─────────────────────────────────────────── */
export function useStreakPop(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !containerRef.current) return;
      const dots = containerRef.current.querySelectorAll(".days span");
      window.gsap.fromTo(dots,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, stagger: 0.07, ease: "back.out(1.8)", delay: 0.2 }
      );
    });
    return () => { cancelled = true; };
  }, [containerRef]);
}

/* ─── Modal bounce entrance ──────────────────────────────────── */
export function useModalEntrance(
  ref: React.RefObject<HTMLElement | null>,
  options: { fromY?: number; fromScale?: number; duration?: number; ease?: string } = {},
) {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      window.gsap.fromTo(ref.current,
        { scale: options.fromScale ?? 0.88, opacity: 0, y: options.fromY ?? 20 },
        { scale: 1, opacity: 1, y: 0, duration: options.duration ?? 0.52, ease: options.ease ?? "back.out(1.6)" }
      );
    });
    return () => { cancelled = true; };
  }, [ref, options.fromY, options.fromScale, options.duration, options.ease]);
}

/* ─── Pulse glow on element ──────────────────────────────────── */
export function usePulseGlow(ref: React.RefObject<HTMLElement | null>, color = "#35c9b1") {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      window.gsap.to(ref.current, {
        boxShadow: `0 0 28px ${color}55, 0 0 0px ${color}00`,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
    return () => {
      cancelled = true;
      if (ref.current) window.gsap?.killTweensOf(ref.current);
    };
  }, [ref, color]);
}

/* ─── Button hover magnetic effect (attach to button element) ── */
export function useButtonHover() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      const el = ref.current;
      const gsap = window.gsap;
      const onEnter = () => gsap.to(el, { scale: 1.04, duration: 0.22, ease: "power2.out" });
      const onLeave = () => gsap.to(el, { scale: 1, duration: 0.28, ease: "power2.out" });
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
      return () => { el.removeEventListener("mouseenter", onEnter); el.removeEventListener("mouseleave", onLeave); };
    });
    return () => { cancelled = true; };
  }, []);
  return ref;
}

/* ─── Mastery bars scroll-triggered ──────────────────────────── */
export function useMasteryBars(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !containerRef.current) return;
      const gsap = window.gsap;
      const ST = window.ScrollTrigger;
      const bars = containerRef.current.querySelectorAll<HTMLElement>(".mastery span > div > i, .priorities button > div > i");
      bars.forEach((bar) => {
        const w = bar.style.width;
        gsap.fromTo(bar,
          { width: "0%" },
          {
            width: w,
            duration: 1.0,
            ease: "power3.out",
            scrollTrigger: {
              trigger: bar,
              start: "top 92%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    });
    return () => {
      cancelled = true;
      window.ScrollTrigger?.getAll().forEach((t: any) => t.kill());
    };
  }, [containerRef]);
}

/* ─── Heartbeat image pulse ──────────────────────────────────── */
export function useHeartbeatPulse(ref: React.RefObject<HTMLImageElement | null>) {
  useEffect(() => {
    let cancelled = false;
    loadGSAP().then(() => {
      if (cancelled || !ref.current) return;
      window.gsap.to(ref.current, {
        scale: 1.04,
        duration: 0.45,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
    return () => {
      cancelled = true;
      if (ref.current) window.gsap?.killTweensOf(ref.current);
    };
  }, [ref]);
}
