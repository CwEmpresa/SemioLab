"use client";

import Image from "next/image";
import { ArrowRight, Check, Flame, Target, TrendingUp } from "lucide-react";
import type { DailyMission, MissionAction } from "@/app/use-learning-summary";

type MissionHeroProps = {
  mission: DailyMission | undefined;
  loading: boolean;
  streakDays: number;
  generalMastery: number | null;
  onAction: (action: MissionAction) => void;
};

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function MissionHero({ mission, loading, streakDays, generalMastery, onAction }: MissionHeroProps) {
  const total = mission?.total ?? 3;
  const completed = mission?.completed ?? 0;
  const allDone = !!mission && completed >= total;
  const nextTask = mission?.tasks.find((task) => !task.done);
  const ratio = total ? completed / total : 0;
  const remaining = total - completed;

  return (
    <section className="mission-hero" aria-busy={loading && !mission}>
      <header className="mission-hero-head">
        <span>
          <small><Target /> MISSÃO DE HOJE</small>
          <h1>
            {loading && !mission
              ? "Preparando sua missão…"
              : allDone
                ? "Missão cumprida"
                : `Faltam ${remaining} ${remaining === 1 ? "tarefa" : "tarefas"}`}
          </h1>
          <p>
            {allDone
              ? "Você fechou o dia — volte amanhã para manter a sequência."
              : mission
                ? `Foco do dia: ${mission.focusTopic}.`
                : "Tarefas escolhidas a partir do seu desempenho real."}
          </p>
        </span>
        <div className={`mission-ring ${allDone ? "done" : ""}`} role="img" aria-label={`${completed} de ${total} tarefas concluídas`}>
          <span className="mission-ring-glow" aria-hidden="true" />
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="mission-ring-track" cx="50" cy="50" r={RING_RADIUS} />
            <circle
              className="mission-ring-fill"
              cx="50"
              cy="50"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - ratio)}
            />
          </svg>
          <Image src="/semiolab-heart-3d.png" alt="" width={96} height={96} priority />
          <b>{completed}/{total}</b>
        </div>
      </header>

      <ol className="mission-tasks">
        {loading && !mission
          ? Array.from({ length: 3 }, (_, index) => <li key={index} className="mission-task skeleton" aria-hidden="true" />)
          : mission?.tasks.map((task) => {
              const isNext = task.id === nextTask?.id;
              return (
                <li key={task.id}>
                  <button
                    className={`mission-task ${task.done ? "done" : ""} ${isNext ? "next" : ""}`}
                    onClick={() => onAction(task.action)}
                  >
                    <i className="mission-check">{task.done ? <Check /> : null}</i>
                    <span className="mission-task-copy">
                      <b>{task.title}</b>
                      <small>{task.detail}</small>
                    </span>
                    {task.target > 1 && (
                      <span className="mission-task-meter" aria-label={`${task.progress} de ${task.target}`}>
                        <i><em style={{ width: `${Math.round((task.progress / task.target) * 100)}%` }} /></i>
                        <small>{task.progress}/{task.target}</small>
                      </span>
                    )}
                    {isNext ? <em className="mission-task-cta">Começar <ArrowRight /></em> : <ArrowRight className="mission-task-arrow" />}
                  </button>
                </li>
              );
            })}
      </ol>

      <footer className="mission-hero-stats">
        <span><Flame /><b>{streakDays}</b> {streakDays === 1 ? "dia de sequência" : "dias de sequência"}</span>
        <span>
          <TrendingUp />
          {generalMastery === null ? <>Domínio geral <b>em calibração</b></> : <>Domínio geral <b>{generalMastery}%</b></>}
        </span>
      </footer>
    </section>
  );
}
