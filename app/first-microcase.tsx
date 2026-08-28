"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Stethoscope, Volume2, ZoomIn, ZoomOut, RotateCcw, Sun, Contrast } from "lucide-react";
import { useLearningSummary } from "./use-learning-summary";
import { useUser } from "./user-context";
import { safeDisplayName } from "@/lib/level";

export type Step = "intro" | "conversation" | "exam" | "xray_request" | "xray_viewer" | "interpretation" | "hypothesis" | "completed";

function logEvent(eventName: string, source: string, step?: string) {
  fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventName, source, safeMetadata: step ? { step } : undefined }) }).catch(() => {});
}
function saveProgress(step: Step) {
  fetch("/api/first-experience/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ step }) }).catch(() => {});
}

const QUESTIONS = [
  { id: "start", q: "Quando os sintomas começaram?", a: "Há três dias, doutor. Começou com febre e foi piorando, agora sinto falta de ar." },
  { id: "cough", q: "Como está a tosse?", a: "É uma tosse com catarro, e dói no lado direito do peito quando respiro fundo." },
  { id: "breath", q: "Está com falta de ar?", a: "Sim, principalmente quando me movimento. Parece que não consigo respirar fundo direito." },
];

const XRAY_OPTIONS = ["Radiografia de tórax", "Tomografia de crânio", "Ultrassonografia abdominal"];
const INTERPRETATION_OPTIONS = ["Consolidação na base pulmonar direita", "Pneumotórax bilateral", "Derrame pleural volumoso", "Sem alterações"];
const HYPOTHESIS_OPTIONS = ["Pneumonia adquirida na comunidade", "Embolia pulmonar", "Insuficiência cardíaca descompensada", "Crise asmática"];

export default function FirstMicrocase({ initialStep, onComplete }: { initialStep: Step; onComplete: () => void }) {
  const { summary } = useLearningSummary();
  const user = useUser();
  const doctorName = safeDisplayName(user.name, user.email);
  const tier: "free" | "trial" | "pro" = (summary?.pro?.tier as "free" | "trial" | "pro") ?? "trial";
  const [step, setStep] = useState<Step>(initialStep === "completed" ? "intro" : initialStep);
  const [typedText, setTypedText] = useState("");
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [examRevealed, setExamRevealed] = useState<string[]>([]);
  const [xrayChoice, setXrayChoice] = useState<string | null>(null);
  const [xrayWrongHint, setXrayWrongHint] = useState(false);
  const [xrayProcessing, setXrayProcessing] = useState(false);
  const [interpretationChoice, setInterpretationChoice] = useState<string | null>(null);
  const [interpretationFeedback, setInterpretationFeedback] = useState<"correct" | "wrong" | null>(null);
  const [hypothesisChoice, setHypothesisChoice] = useState<string | null>(null);
  const [hypothesisAttempts, setHypothesisAttempts] = useState(0);
  const [hypothesisResult, setHypothesisResult] = useState<"correct" | "incorrect" | null>(null);
  const [xpAwarded, setXpAwarded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const changeStep = (next: Step) => { setStep(next); saveProgress(next); };

  useEffect(() => {
    logEvent("first_experience_viewed", "first_microcase");
  }, []);

  useEffect(() => {
    if (step !== "conversation") return;
    const opening = "Oi, doutor. Não estou muito bem... Estou com falta de ar e um mal-estar forte há alguns dias.";
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setTypedText(opening.slice(0, i));
      if (i >= opening.length) window.clearInterval(timer);
    }, 22);
    logEvent("first_challenge_started", "first_microcase");
    return () => window.clearInterval(timer);
  }, [step]);

  const askQuestion = (id: string) => {
    const item = QUESTIONS.find((q) => q.id === id);
    if (!item) return;
    setLastAnswer(null);
    setAskedIds((prev) => [...prev, id]);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setLastAnswer(item.a.slice(0, i));
      if (i >= item.a.length) window.clearInterval(timer);
    }, 16);
    logEvent("first_question_answered", "first_microcase", id);
  };

  const revealExam = () => {
    const items = ["temp", "fr", "spo2", "estertores"];
    items.forEach((item, idx) => {
      window.setTimeout(() => setExamRevealed((prev) => (prev.includes(item) ? prev : [...prev, item])), idx * 500);
    });
  };

  const chooseXray = (option: string) => {
    setXrayChoice(option);
    if (option !== "Radiografia de tórax") { setXrayWrongHint(true); return; }
    setXrayWrongHint(false);
    setXrayProcessing(true);
    window.setTimeout(() => { setXrayProcessing(false); changeStep("xray_viewer"); }, 1200);
  };

  const answerInterpretation = (option: string) => {
    setInterpretationChoice(option);
    setInterpretationFeedback(option === INTERPRETATION_OPTIONS[0] ? "correct" : "wrong");
  };

  const answerHypothesis = (option: string) => {
    if (hypothesisResult) return; // já concluiu (acerto ou 2ª tentativa) — trava a escolha
    setHypothesisChoice(option);
    const attempt = hypothesisAttempts + 1;
    setHypothesisAttempts(attempt);
    const isCorrect = option === HYPOTHESIS_OPTIONS[0];
    if (isCorrect) {
      setHypothesisResult("correct");
      logEvent("first_question_answered", "first_microcase", "hypothesis_correct");
      return;
    }
    if (attempt >= 2) {
      // Duas erradas: nunca mostra acerto — revela a alternativa certa.
      setHypothesisResult("incorrect");
      logEvent("first_question_answered", "first_microcase", "hypothesis_incorrect");
    }
    // 1ª errada: não fixa resultado, permite tentar de novo.
  };

  const finish = async () => {
    changeStep("completed");
    logEvent("first_challenge_completed", "first_microcase");
    try {
      const response = await fetch("/api/first-experience/complete", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      setXpAwarded(!!data.xpAwarded);
    } catch { /* segue mesmo se a rede falhar momentaneamente */ }
  };

  const nextActivityHref = tier === "free" ? "quiz" : "patient";
  const nextActivityLabel = tier === "free" ? "Fazer um quiz de Semiologia" : "Atender meu primeiro Paciente IA";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fmc-shell">
      {step !== "intro" && step !== "completed" && (
        <div className="fmc-progress"><i style={{ width: `${{conversation:14,exam:28,xray_request:42,xray_viewer:57,interpretation:71,hypothesis:85}[step] ?? 0}%` }} /></div>
      )}

      {step === "intro" && (
        <section className="fmc-intro">
          <small>SEMIOLAB</small>
          <h1>Os mapas ajudam você a lembrar.<br />O SemioLab prepara você para decidir.</h1>
          <p>Seu primeiro paciente chegou. Em aproximadamente 2 minutos, você vai investigar um caso, analisar achados e tomar uma decisão clínica.</p>
          <button className="primary fmc-cta" onClick={() => changeStep("conversation")}>Iniciar primeiro atendimento <ChevronRight /></button>
        </section>
      )}

      {(step === "conversation" || step === "exam" || step === "xray_request") && (
        <section className="fmc-stage fmc-timeline">
          <header className="fmc-patient-header">
            <i className="fmc-avatar">AM</i>
            <span><b>Ana Maria</b><small>34 anos · Motivo informado na recepção: dor no peito e falta de ar</small></span>
          </header>

          <div className="fmc-bubble fmc-bubble-doctor">Oi, Ana Maria! Prazer, sou o Dr. {doctorName}. Tudo bem? O que você está sentindo?</div>
          <div className="fmc-bubble fmc-bubble-patient">{typedText}<i className="fmc-caret" /></div>

          {typedText.length >= 30 && (
            <div className="fmc-questions">
              {QUESTIONS.filter((q) => !askedIds.includes(q.id)).map((q) => (
                <button key={q.id} onClick={() => askQuestion(q.id)}>{q.q}</button>
              ))}
              {lastAnswer !== null && <div className="fmc-bubble fmc-bubble-patient">{lastAnswer}</div>}
            </div>
          )}

          {/* Só aparece depois da ÚLTIMA pergunta configurada ser respondida. */}
          {step === "conversation" && askedIds.length >= QUESTIONS.length && (
            <button className="primary fmc-cta" onClick={() => changeStep("exam")}>Examinar paciente <ChevronRight /></button>
          )}

          {(step === "exam" || step === "xray_request") && (
            <div className="fmc-timeline-block">
              <h2>Exame físico</h2>
              {examRevealed.length === 0 ? (
                <button className="primary fmc-cta" onClick={revealExam}><Stethoscope /> Examinar paciente</button>
              ) : (
                <div className="fmc-vitals">
                  {examRevealed.includes("temp") && <div className="fmc-vital"><small>Temperatura</small><b>38,6 °C</b></div>}
                  {examRevealed.includes("fr") && <div className="fmc-vital"><small>Frequência respiratória</small><b>26 irpm</b></div>}
                  {examRevealed.includes("spo2") && <div className="fmc-vital"><small>Saturação</small><b>93%</b></div>}
                  {examRevealed.includes("estertores") && (
                    <div className="fmc-vital fmc-vital-audio">
                      <small>Ausculta pulmonar — base direita</small>
                      <b>Estertores</b>
                      <button onClick={() => audioRef.current?.play()}><Volume2 /> Ouvir</button>
                      <audio ref={audioRef} src="/media/auscultation/f158a62caa3880d4.mp3" preload="none" />
                    </div>
                  )}
                </div>
              )}
              {step === "exam" && examRevealed.includes("estertores") && (
                <button className="primary fmc-cta" onClick={() => changeStep("xray_request")}>Solicitar exame <ChevronRight /></button>
              )}
            </div>
          )}

          {step === "xray_request" && (
            <div className="fmc-timeline-block">
              <h2>Qual exame você solicita?</h2>
              <div className="fmc-options">
                {XRAY_OPTIONS.map((o) => (
                  <button key={o} className={xrayChoice === o ? "selected" : ""} onClick={() => chooseXray(o)}>{o}</button>
                ))}
              </div>
              {xrayWrongHint && <p className="fmc-hint">Esse exame não é o mais indicado para este quadro. Pense no que a ausculta sugeriu.</p>}
              {xrayProcessing && <p className="fmc-processing">Processando radiografia...</p>}
            </div>
          )}
        </section>
      )}

      {step === "xray_viewer" && <XrayViewer onContinue={() => changeStep("interpretation")} />}

      {step === "interpretation" && (
        <section className="fmc-stage">
          <h2>Qual achado está presente na radiografia?</h2>
          <div className="fmc-options">
            {INTERPRETATION_OPTIONS.map((o) => (
              <button key={o} disabled={!!interpretationFeedback} className={interpretationChoice === o ? "selected" : ""} onClick={() => answerInterpretation(o)}>{o}</button>
            ))}
          </div>
          {interpretationFeedback && (
            <>
              <p className={interpretationFeedback === "correct" ? "fmc-feedback-ok" : "fmc-feedback-info"}>
                {interpretationFeedback === "correct" ? "Correto — a opacidade na base direita é compatível com consolidação." : "Observe novamente a base pulmonar direita: a área mais opaca indica a consolidação."}
              </p>
              <button className="primary fmc-cta" onClick={() => changeStep("hypothesis")}>Continuar <ChevronRight /></button>
            </>
          )}
        </section>
      )}

      {step === "hypothesis" && (
        <section className="fmc-stage">
          <h2>Qual é a principal hipótese clínica?</h2>
          <div className="fmc-options">
            {HYPOTHESIS_OPTIONS.map((o) => (
              <button
                key={o}
                disabled={!!hypothesisResult}
                className={hypothesisChoice === o ? "selected" : ""}
                onClick={() => answerHypothesis(o)}
              >
                {o}
              </button>
            ))}
          </div>
          {!hypothesisResult && hypothesisAttempts === 1 && (
            <p className="fmc-feedback-info">Não foi essa. Você tem mais uma tentativa.</p>
          )}
          {hypothesisResult === "correct" && (
            <p className="fmc-feedback-ok">Correto — o quadro é compatível com pneumonia adquirida na comunidade.</p>
          )}
          {hypothesisResult === "incorrect" && (
            <p className="fmc-feedback-info">
              Não foi dessa vez. A hipótese correta é <b>{HYPOTHESIS_OPTIONS[0]}</b> — febre, tosse produtiva, dor ventilatório-dependente e consolidação na base direita formam esse quadro clássico.
            </p>
          )}
          {hypothesisResult && <button className="primary fmc-cta" onClick={finish}>Concluir atendimento <ChevronRight /></button>}
        </section>
      )}

      {step === "completed" && (
        <section className="fmc-completion">
          <div className="fmc-ring"><span>{xpAwarded ? "+25" : "✓"}</span></div>
          <b className="fmc-badge">Primeiro atendimento concluído</b>
          <h1>Você acabou de transformar teoria em decisão clínica.</h1>
          <ul className="fmc-checklist">
            <li>Conversou com o paciente</li>
            <li>Realizou exame físico</li>
            <li>Ouviu uma ausculta</li>
            <li>Solicitou uma radiografia</li>
            <li>Interpretou os achados</li>
            <li>Formulou uma hipótese</li>
          </ul>
          <p className="fmc-note">E isso foi apenas um atendimento guiado. No Paciente IA, cada conversa e decisão muda de acordo com o caso.</p>
          <button className="primary fmc-cta" onClick={() => { logEvent("next_activity_selected", "first_microcase", nextActivityHref); onComplete(); }}>{nextActivityLabel} <ChevronRight /></button>
          <button className="fmc-secondary" onClick={onComplete}>Explorar o SemioLab</button>
        </section>
      )}
    </div>,
    document.body,
  );
}

function XrayViewer({ onContinue }: { onContinue: () => void }) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch("/api/first-experience/exam")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setAvailable(!!data?.available); setUrl(data?.url ?? null); })
      .catch(() => setAvailable(false))
      .finally(() => setLoading(false));
  }, []);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setBrightness(100); setContrast(100); };

  return (
    <section className="fmc-stage fmc-xray-stage">
      <h2>Radiografia de tórax</h2>
      <div
        className="fmc-xray-frame"
        onPointerDown={(e) => { dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }}
        onPointerMove={(e) => { if (dragRef.current) setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y }); }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerLeave={() => { dragRef.current = null; }}
      >
        {loading ? (
          <div className="fmc-xray-skeleton" />
        ) : available && url ? (
          <img
            src={url}
            alt="Radiografia de tórax — incidência PA"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
            draggable={false}
          />
        ) : (
          <div className="fmc-xray-fallback">
            <p><b>Laudo (imagem indisponível no momento):</b></p>
            <p>Radiografia de tórax em incidência PA: consolidação com broncogramas aéreos na base pulmonar direita, compatível com pneumonia adquirida na comunidade. Demais campos pulmonares sem alterações agudas.</p>
          </div>
        )}
        {answered && available && <div className="fmc-xray-marker" style={{ left: "62%", top: "68%" }} />}
      </div>
      {answered && <p className="fmc-xray-caption">Observe a opacidade localizada na base pulmonar direita.</p>}
      {available && (
        <div className="fmc-xray-controls">
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Ampliar"><ZoomIn /></button>
          <button onClick={() => setZoom((z) => Math.max(1, z - 0.25))} aria-label="Reduzir"><ZoomOut /></button>
          <button onClick={() => setBrightness((b) => Math.min(160, b + 10))} aria-label="Mais brilho"><Sun /></button>
          <button onClick={() => setContrast((c) => Math.min(160, c + 10))} aria-label="Mais contraste"><Contrast /></button>
          <button onClick={reset} aria-label="Restaurar"><RotateCcw /></button>
        </div>
      )}
      <button className="primary fmc-cta" onClick={() => { setAnswered(true); window.setTimeout(onContinue, 900); }}>Interpretar achados</button>
    </section>
  );
}
