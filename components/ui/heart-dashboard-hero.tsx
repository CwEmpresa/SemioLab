"use client";

import { useRef, useEffect } from "react";
import { Activity, ArrowRight, Check, HeartPulse, Target } from "lucide-react";
import { useFloatCards, useHeartbeatPulse, useProgressBar } from "@/components/animations";

type HeartDashboardHeroProps = {
  onContinue: () => void;
  streakDays: number;
  progressPercent: number;
  activitiesToday: number;
  activitiesGoal: number;
};

export function HeartDashboardHero({ onContinue, streakDays, progressPercent, activitiesToday, activitiesGoal }: HeartDashboardHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const barRef = useProgressBar(progressPercent);

  useFloatCards(heroRef);
  useHeartbeatPulse(imgRef);

  // Hero copy stagger on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (typeof window === "undefined") return;
      await new Promise<void>((res) => {
        if ((window as any).gsap) { res(); return; }
        const id = setInterval(() => { if ((window as any).gsap) { clearInterval(id); res(); } }, 50);
        setTimeout(() => { clearInterval(id); res(); }, 3000);
      });
      if (cancelled || !heroRef.current) return;
      const gsap = (window as any).gsap;
      const items = heroRef.current.querySelectorAll(".heart-hero-copy > *");
      gsap.fromTo(items,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.09, ease: "power3.out", clearProps: "all" }
      );
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="heart-dashboard-hero" ref={heroRef}>
      <div className="heart-hero-copy">
        <span className="heart-eyebrow">
          <Target /> MISSÃO DE HOJE
        </span>
        <h1>Treine seu olhar clínico todos os dias.</h1>
        <p>
          Continue sua rotina personalizada e evolua no raciocínio clínico em
          aproximadamente 18 minutos.
        </p>
        <div className="heart-progress-row">
          <div>
            <i ref={barRef as any} style={{ width: "0%" }} />
          </div>
          <b>{activitiesToday} de {activitiesGoal} atividades</b>
        </div>
        <button onClick={onContinue} className="hero-cta-btn">
          Continuar missão <ArrowRight />
        </button>
      </div>

      <div className="heart-visual" aria-label="Coração anatômico em 3D">
        <span className="heart-orbit orbit-one" />
        <span className="heart-orbit orbit-two" />
        <img ref={imgRef} src="/semiolab-heart-3d.png" alt="Coração humano anatômico em 3D" />

        <aside className="heart-float heart-rate-card">
          <i><HeartPulse /></i>
          <span>
            <small>RITMO DE ESTUDO</small>
            <b>{streakDays} {streakDays === 1 ? "dia" : "dias"}</b>
          </span>
        </aside>

        <aside className="heart-float heart-progress-card">
          <i><Activity /></i>
          <span>
            <small>PROGRESSO GERAL</small>
            <b>{progressPercent}%</b>
          </span>
          <Check />
        </aside>
      </div>
    </section>
  );
}
