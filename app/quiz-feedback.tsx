"use client";

import { useState } from "react";
import confetti from "canvas-confetti";
import { Check, ChevronDown, CircleAlert, Lightbulb, X } from "lucide-react";

export const letterOf = (index: number) => String.fromCharCode(65 + index);

/** Limpa sobras de geração nos textos do banco/IA: tags como
 * "</Explanation>" e rótulos "ERRADA:" / "CORRETA:" no início. */
export function cleanExplanation(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<\/?[A-Za-z][\w-]*\s*\/?>/g, " ")
    .replace(/^\s*(?:alternativa\s+)?(?:[A-E]\s*[)\-:.]\s*)?(?:errad[ao]|incorret[ao]|corret[ao]|cert[ao])\s*[:\-–—]\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Mesma chuva de confete do fim do cadastro (primeira experiência). */
export function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const end = Date.now() + 1200;
  const colors = ["#35c9b1", "#ffffff", "#f0c14e"];
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export type AnswerFeedbackData = {
  correct: boolean;
  correctText: string;
  explanation: string;
  correctWhy: string | null;
  whyWrong: string | null;
  whyLoading?: boolean;
};

/** Correção que aparece logo abaixo da questão, assim que o aluno responde:
 * por que a correta é a certa e, se errou, por que a marcada não é. */
export function AnswerFeedback({
  data,
  selectedLetter,
  correctLetter,
}: {
  data: AnswerFeedbackData;
  selectedLetter: string;
  correctLetter: string;
}) {
  const explanation = cleanExplanation(data.explanation);
  const correctWhy = cleanExplanation(data.correctWhy);
  const whyWrong = cleanExplanation(data.whyWrong);
  return (
    <section className={`qf-feedback ${data.correct ? "is-correct" : "is-wrong"}`} aria-live="polite">
      <header className="qf-verdict">
        <i>{data.correct ? <Check /> : <X />}</i>
        <span>
          <b>{data.correct ? "Resposta correta!" : "Resposta incorreta"}</b>
          <small>
            {data.correct
              ? `Você marcou a letra ${correctLetter}.`
              : `Você marcou a letra ${selectedLetter}. A correta é a letra ${correctLetter}.`}
          </small>
        </span>
      </header>
      <article className="qf-block qf-right">
        <small><Lightbulb /> Por que a letra {correctLetter} está certa</small>
        <p>{correctWhy || explanation}</p>
        {correctWhy && explanation && correctWhy !== explanation && <p className="qf-extra">{explanation}</p>}
      </article>
      {!data.correct && (
        <article className="qf-block qf-wrong">
          <small><CircleAlert /> Por que a letra {selectedLetter} não está certa</small>
          {whyWrong ? (
            <p>{whyWrong}</p>
          ) : data.whyLoading ? (
            <p className="qf-skeleton" aria-label="Carregando explicação"><span /><span /><span /></p>
          ) : (
            <p>A alternativa que você marcou não responde ao que o enunciado pede. Compare com a explicação da letra {correctLetter} acima.</p>
          )}
        </article>
      )}
    </section>
  );
}

export type ReviewItem = {
  id: string;
  index: number;
  topic: string;
  text: string;
  correct: boolean;
  selectedText: string;
  correctText: string;
  explanation: string;
  correctWhy?: string | null;
  whyWrong?: string | null;
};

/** Card do resumo final. Clicável: abre a explicação completa. */
export function ReviewCard({ item }: { item: ReviewItem }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`qf-review ${item.correct ? "correct" : "wrong"} ${open ? "open" : ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <b>{item.index + 1}</b>
        <span>
          <small>{item.correct ? "ACERTOU" : "ERROU"} · {item.topic.toUpperCase()}</small>
          <p>{item.text}</p>
        </span>
        <ChevronDown className="qf-chevron" />
      </button>
      {open && (
        <div className="qf-review-body">
          {!item.correct && (
            <p className="qf-line wrong"><X /> <span><b>Sua resposta:</b> {item.selectedText || "Sem resposta"}</span></p>
          )}
          <p className="qf-line right"><Check /> <span><b>Resposta correta:</b> {item.correctText}</span></p>
          <p><b>Explicação:</b> {cleanExplanation(item.correctWhy) || cleanExplanation(item.explanation)}</p>
          {item.correctWhy && item.explanation && cleanExplanation(item.correctWhy) !== cleanExplanation(item.explanation) && <p>{cleanExplanation(item.explanation)}</p>}
          {!item.correct && item.whyWrong && <p><b>Por que sua resposta não está certa:</b> {cleanExplanation(item.whyWrong)}</p>}
        </div>
      )}
    </article>
  );
}

export type TopicStat = { topic: string; total: number; correct: number };

/** Tabela "onde você mais erra": temas ordenados pela taxa de erro. */
export function TopicErrorTable({ stats, title = "Onde você mais erra" }: { stats: TopicStat[]; title?: string }) {
  const rows = stats
    .filter((s) => s.total > 0)
    .map((s) => ({ ...s, wrong: s.total - s.correct, errorRate: Math.round(((s.total - s.correct) / s.total) * 100) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.wrong - a.wrong);
  if (rows.length === 0) return null;
  return (
    <section className="qf-topic-table">
      <header>
        <small>Desempenho por tema</small>
        <h2>{title}</h2>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Tema</th>
            <th scope="col">Questões</th>
            <th scope="col">Erros</th>
            <th scope="col">Taxa de erro</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.topic} className={row.errorRate >= 50 ? "bad" : row.errorRate >= 25 ? "mid" : "good"}>
              <th scope="row">{row.topic}</th>
              <td>{row.total}</td>
              <td>{row.wrong}</td>
              <td>
                <span className="qf-rate">
                  <i style={{ width: `${row.errorRate}%` }} />
                </span>
                <b>{row.errorRate}%</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Soma os resultados por tema de várias tentativas (quiz, simulados). */
export function aggregateTopicStats(attempts: { topic_results?: { topic: string; total: number; correct: number }[] | null }[]): TopicStat[] {
  const map = new Map<string, TopicStat>();
  for (const attempt of attempts) {
    for (const tr of attempt.topic_results ?? []) {
      if (!tr?.topic) continue;
      const current = map.get(tr.topic) ?? { topic: tr.topic, total: 0, correct: 0 };
      current.total += tr.total || 0;
      current.correct += tr.correct || 0;
      map.set(tr.topic, current);
    }
  }
  return [...map.values()];
}
