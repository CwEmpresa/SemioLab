"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PlayerRef } from "@remotion/player";
import { ArrowLeft, BookOpenCheck, ChevronRight, CircleAlert, Clock3, Lightbulb, ListChecks, Play, RotateCcw, Target, Trophy } from "lucide-react";
import { formatReviewDuration, FPS, getQuestionStartFrames, getSmartReviewDuration } from "@/remotion/smart-review/timeline";
import type { ReviewQuestion, SmartReviewProps } from "@/remotion/smart-review/types";

const SmartReviewPlayer = dynamic(() => import("./smart-review-player"), {
  ssr: false,
  loading: () => <div className="sr-player-loading" role="status">Preparando sua revisão…</div>,
});

const SIMULADOS_HREF = "/?screen=quiz";

function accuracyTone(accuracy: number) {
  return accuracy < 60 ? "low" : accuracy < 75 ? "mid" : "high";
}

/** O app guarda o tema em localStorage; esta rota fica fora do shell
 * principal, então aplica o mesmo atributo aqui. */
function useAppTheme() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("semiolab.theme");
      document.documentElement.dataset.semiolabTheme = saved === "dark" ? "dark" : "light";
    } catch {
      document.documentElement.dataset.semiolabTheme = "light";
    }
  }, []);
}

export function SmartReviewView({ review }: { review: SmartReviewProps }) {
  useAppTheme();
  const playerRef = useRef<PlayerRef | null>(null);
  const playerSectionRef = useRef<HTMLElement>(null);
  const [ended, setEnded] = useState(false);
  const perfect = review.wrongAnswers === 0;
  const durationInFrames = useMemo(() => getSmartReviewDuration(review, FPS), [review]);
  const questionStarts = useMemo(() => getQuestionStartFrames(review, FPS), [review]);
  const topicsToReview = review.topics.filter((t) => t.accuracy < 100).length;
  const onEnded = useCallback(() => setEnded(true), []);

  const playFrom = (frame: number) => {
    setEnded(false);
    playerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    playerRef.current?.seekTo(frame);
    playerRef.current?.play();
  };

  const stats = [
    { icon: ListChecks, value: `${review.answeredQuestions}`, label: `de ${review.totalQuestions} respondidas` },
    { icon: perfect ? Trophy : CircleAlert, value: perfect ? `${review.score}%` : `${review.wrongAnswers}`, label: perfect ? "de acerto" : review.wrongAnswers === 1 ? "erro encontrado" : "erros encontrados" },
    { icon: Target, value: `${topicsToReview}`, label: topicsToReview === 1 ? "assunto para revisar" : "assuntos para revisar" },
    { icon: Clock3, value: formatReviewDuration(durationInFrames), label: "de revisão" },
  ];

  return (
    <main className="sr-page">
      <div className="sr-wrap">
        <nav className="sr-nav">
          <Link href={SIMULADOS_HREF} prefetch={false} className="sr-back"><ArrowLeft /> Simulados</Link>
          <span className="sr-nav-brand">Revisão Inteligente</span>
        </nav>

        <header className="sr-hero">
          <small className="sr-eyebrow">{perfect ? "SIMULADO GABARITADO" : "REVISÃO PERSONALIZADA"}</small>
          <h1>{perfect ? "Você acertou tudo" : "Sua revisão está pronta"}</h1>
          <p>
            {perfect
              ? "Nenhum erro para corrigir. Veja seu desempenho por assunto e o próximo passo para manter o nível."
              : "Seus erros deste simulado viraram uma revisão visual, do assunto mais fraco para o mais forte."}
          </p>
          <ul className="sr-stats">
            {stats.map((stat) => (
              <li key={stat.label}>
                <stat.icon />
                <b>{stat.value}</b>
                <small>{stat.label}</small>
              </li>
            ))}
          </ul>
        </header>

        <div className="sr-layout">
          <section className="sr-player-card" ref={playerSectionRef} aria-label="Vídeo da revisão">
            <div className="sr-player-frame">
              <SmartReviewPlayer review={review} playerRef={playerRef} onEnded={onEnded} />
            </div>
            <div className={`sr-player-actions ${ended ? "is-ended" : ""}`}>
              <button className="sr-btn sr-btn-primary" onClick={() => playFrom(0)}>
                {ended ? <><RotateCcw /> Revisar novamente</> : <><Play /> Assistir desde o início</>}
              </button>
              <Link prefetch={false} className="sr-btn sr-btn-ghost" href={SIMULADOS_HREF}>Voltar para meus simulados</Link>
            </div>
          </section>

          <aside className="sr-topics" aria-label="Desempenho por assunto">
            <header>
              <h2>Desempenho por assunto</h2>
              <small>Do pior para o melhor</small>
            </header>
            <ol>
              {review.topics.map((topic, index) => (
                <li key={topic.topic} className={`tone-${accuracyTone(topic.accuracy)}`}>
                  <span>
                    <b>{topic.topic}</b>
                    {index === 0 && !perfect ? <em>Prioridade</em> : null}
                  </span>
                  <strong>{topic.accuracy}%</strong>
                  <i style={{ ["--value" as string]: `${Math.max(topic.accuracy, 2)}%` }} />
                  <small>{topic.correct} de {topic.total} corretas</small>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        {perfect ? null : (
          <section className="sr-errors" aria-label="Erros em ordem de prioridade">
            <header>
              <h2>Seus erros, por prioridade</h2>
              <small>Toque em uma questão para vê-la no vídeo.</small>
            </header>
            {review.sections.map((section) =>
              section.kind === "group" ? (
                <div key={`group-${section.title}`} className="sr-group">
                  <div className="sr-group-head">
                    <BookOpenCheck />
                    <span>
                      <b>Você precisa revisar: {section.title}</b>
                      <small>{section.questions.length} erros · {section.accuracy}% de acerto em {section.topic}</small>
                    </span>
                  </div>
                  {section.questions.map((q) => <ErrorItem key={q.number} question={q} onPlay={questionStarts[q.number] === undefined ? undefined : () => playFrom(questionStarts[q.number])} />)}
                </div>
              ) : (
                <ErrorItem key={section.question.number} question={section.question} onPlay={questionStarts[section.question.number] === undefined ? undefined : () => playFrom(questionStarts[section.question.number])} />
              ),
            )}
          </section>
        )}

        <section className="sr-next">
          <small className="sr-eyebrow">PRÓXIMO PASSO RECOMENDADO</small>
          <p>{review.nextStep}</p>
          {review.priorityConcepts.length > 0 ? (
            <ul>
              {review.priorityConcepts.map((concept) => <li key={concept}><Lightbulb />{concept}</li>)}
            </ul>
          ) : null}
          <div className="sr-next-actions">
            <button className="sr-btn sr-btn-primary" onClick={() => playFrom(0)}><RotateCcw /> Revisar novamente</button>
            <Link prefetch={false} className="sr-btn sr-btn-ghost" href={SIMULADOS_HREF}>Voltar para meus simulados <ChevronRight /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function ErrorItem({ question, onPlay }: { question: ReviewQuestion; onPlay?: () => void }) {
  const body = (
    <>
      <span className="sr-error-num">Q{question.number}</span>
      <span className="sr-error-body">
        <small>{question.subtopic ? `${question.topic} · ${question.subtopic}` : question.topic}</small>
        <b>{question.statement}</b>
        <span className="sr-error-answers">
          <em className="wrong">Sua resposta: {question.selectedLetter ?? "não respondida"}</em>
          <em className="right">Correta: {question.correctLetter}</em>
        </span>
        <span className="sr-error-key"><Lightbulb />{question.keyPoint}</span>
      </span>
      {onPlay ? <Play className="sr-error-play" /> : null}
    </>
  );
  return onPlay ? (
    <button className="sr-error" onClick={onPlay} aria-label={`Ver a questão ${question.number} no vídeo`}>{body}</button>
  ) : (
    <div className="sr-error">{body}</div>
  );
}

/** Estados sem revisão disponível (tentativa inexistente/de outro usuário,
 * ou simulado ainda em andamento). */
export function SmartReviewUnavailable({ kind }: { kind: "not_found" | "in_progress" }) {
  useAppTheme();
  const inProgress = kind === "in_progress";
  return (
    <main className="sr-page">
      <div className="sr-wrap sr-empty">
        <CircleAlert />
        <h1>{inProgress ? "Este simulado ainda não terminou" : "Revisão não encontrada"}</h1>
        <p>
          {inProgress
            ? "Finalize o simulado para gerar sua Revisão Inteligente com base nas suas respostas."
            : "Esta revisão não existe ou não pertence à sua conta."}
        </p>
        <Link prefetch={false} className="sr-btn sr-btn-primary" href={SIMULADOS_HREF}>{inProgress ? "Continuar simulado" : "Voltar para meus simulados"}</Link>
      </div>
    </main>
  );
}
