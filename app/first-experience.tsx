"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Sparkles, Stethoscope, Trophy, X } from "lucide-react";
import { useLearningSummary } from "./use-learning-summary";

function brasiliaDateKey(): string {
  const shifted = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}
function logEvent(eventName: "onboarding_started" | "onboarding_skipped" | "onboarding_completed", source: string) {
  fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName, source }) }).catch(() => {});
}
function completionShownKey(userId: string) { return `semiolab:${userId}:first-exp-completion-shown`; }
function skipDateKey(userId: string) { return `semiolab:${userId}:first-exp-skip-date`; }

/** Verdadeiro só depois que a comemoração de ativação já foi mostrada e
 * fechada — usado pelo onboarding de PWA para nunca abrir dois modais ao
 * mesmo tempo (sequência: 1º atendimento/quiz → comemoração → PWA). */
export function firstExperienceCompletionAcknowledged(userId: string): boolean {
  if (typeof window === "undefined") return true; // sem usuário ainda, não bloqueia
  return localStorage.getItem(completionShownKey(userId)) === "1";
}

export function FirstExperienceCard({ go, userId }: { go: (s: "patient" | "quiz") => void; userId: string }) {
  const { summary } = useLearningSummary();
  const activated = (summary?.stats?.activities ?? 0) > 0;
  const isFree = summary?.pro?.tier === "free";
  const skippedToday = typeof window !== "undefined" && localStorage.getItem(skipDateKey(userId)) === brasiliaDateKey();
  if (!summary || activated || !skippedToday) return null;
  return (
    <button className="first-exp-card" onClick={() => { if (isFree) sessionStorage.setItem("semiolab:first-quiz-amount", "5"); go(isFree ? "quiz" : "patient"); }}>
      <i><Sparkles /></i>
      <span><b>{isFree ? "Continuar meu primeiro quiz" : "Continuar primeira consulta"}</b><small>Sua primeira experiência guiada ainda está disponível</small></span>
      <ChevronRight />
    </button>
  );
}

export default function FirstExperience({
  userId, screen, go,
}: {
  userId: string;
  screen: string;
  go: (s: "patient" | "quiz" | "home") => void;
}) {
  const { summary } = useLearningSummary();
  const [showCompletion, setShowCompletion] = useState(false);
  const [skippedTodayState, setSkippedTodayState] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(skipDateKey(userId)) === brasiliaDateKey(),
  );
  const wasActivatedRef = useRef<boolean | null>(null);
  const startedLoggedRef = useRef(false);

  const activated = (summary?.stats?.activities ?? 0) > 0;
  const isFree = summary?.pro?.tier === "free";

  // Único setState-em-effect real: reage à transição genuína vinda do
  // servidor (não-ativado -> ativado) para disparar a comemoração 1x.
  useEffect(() => {
    if (!summary) return;
    const justActivated = wasActivatedRef.current === false && activated;
    wasActivatedRef.current = activated;
    if (justActivated) {
      setShowCompletion(true);
      logEvent("onboarding_completed", isFree ? "quiz" : "patient");
    }
  }, [summary, activated, isFree]);

  // Derivado (sem state próprio) — nunca dispara setState reagindo a si
  // mesmo, só computa a partir do que já existe.
  const showIntro = !!summary && !activated && !showCompletion && screen === "home" && !skippedTodayState;

  useEffect(() => {
    if (showIntro && !startedLoggedRef.current) {
      startedLoggedRef.current = true;
      logEvent("onboarding_started", isFree ? "quiz" : "patient");
    }
  }, [showIntro, isFree]);

  const phase: "hidden" | "intro" | "completion" = showCompletion ? "completion" : showIntro ? "intro" : "hidden";
  if (!summary || phase === "hidden") return null;
  if (typeof document === "undefined") return null;

  const skip = () => {
    localStorage.setItem(skipDateKey(userId), brasiliaDateKey());
    logEvent("onboarding_skipped", isFree ? "quiz" : "patient");
    setSkippedTodayState(true);
  };
  const closeCompletion = () => {
    localStorage.setItem(completionShownKey(userId), "1");
    setShowCompletion(false);
    window.dispatchEvent(new Event("semiolab:first-experience-completed"));
  };

  if (phase === "intro") {
    return createPortal(
      <div className="overlay pwa-modal-overlay first-exp-overlay">
        <section className="clinical-modal first-exp-modal">
          <i className="first-exp-icon">{isFree ? <Trophy /> : <Stethoscope />}</i>
          {isFree ? (
            <>
              <h2>Seu primeiro quiz já está esperando.</h2>
              <p>Responda 5 perguntas rápidas e veja como o SemioLab transforma teoria em prática.</p>
              <button className="primary" onClick={() => { sessionStorage.setItem("semiolab:first-quiz-amount", "5"); go("quiz"); }}>Fazer meu primeiro quiz <ChevronRight /></button>
            </>
          ) : (
            <>
              <h2>Seu primeiro paciente já está esperando.</h2>
              <p>Conduza uma consulta guiada e descubra como o SemioLab transforma teoria em prática.</p>
              <button className="primary" onClick={() => go("patient")}>Atender meu primeiro paciente <ChevronRight /></button>
            </>
          )}
          <button className="first-exp-skip" onClick={skip}>Explorar o app primeiro</button>
        </section>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="overlay pwa-modal-overlay">
      <section className="clinical-modal first-exp-modal">
        <button className="close" onClick={closeCompletion}><X /></button>
        <i className="first-exp-icon first-exp-icon-done"><Trophy /></i>
        <h2>{isFree ? "Primeiro quiz concluído" : "Primeiro atendimento concluído"}</h2>
        <p>Você já deu o primeiro passo real no SemioLab.</p>
        <div className="first-exp-stats">
          <span><b>{summary?.profile?.xp ?? 0}</b><small>XP total</small></span>
          <span><b>{summary?.stats?.activities ?? 0}</b><small>atividades concluídas</small></span>
        </div>
        <button className="primary" onClick={closeCompletion}>Continuar explorando o SemioLab <ChevronRight /></button>
      </section>
    </div>,
    document.body,
  );
}
