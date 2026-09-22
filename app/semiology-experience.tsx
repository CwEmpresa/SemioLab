"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ClipboardCheck, Layers, Lightbulb, ShieldCheck } from "lucide-react";
import { getSemiologyModule, SEMIOLOGY_MODULES } from "@/lib/content/semiology";
import { CURATED_CARDS } from "@/lib/flashcards";

const MODULE_KEY = "semiolab:semiology-module";

/** Pede à tela de Semiologia para abrir direto num módulo (usado pela
 * Pesquisa por tema). A tela lê o pedido ao montar e o descarta. */
export function queueSemiologyModule(moduleId: string) {
  try { sessionStorage.setItem(MODULE_KEY, moduleId); } catch { /* abre a lista */ }
}

function peekQueuedModule() {
  try { return sessionStorage.getItem(MODULE_KEY); } catch { return null; }
}

type SemiologyExperienceProps = {
  onFlashcards: (deckId: string) => void;
  onQuiz: (topic: string) => void;
};

export default function SemiologyExperience({ onFlashcards, onQuiz }: SemiologyExperienceProps) {
  const [openId, setOpenId] = useState<string | null>(() => (typeof window === "undefined" ? null : peekQueuedModule()));
  useEffect(() => {
    try { sessionStorage.removeItem(MODULE_KEY); } catch { /* nada a limpar */ }
  }, []);
  const current = openId ? getSemiologyModule(openId) : null;

  if (current) {
    const cardCount = CURATED_CARDS.filter((card) => card.deck === current.id).length;
    return (
      <div className="page study-page">
        <header className="study-bar">
          <button className="study-back" onClick={() => setOpenId(null)}><ArrowLeft /> Semiologia</button>
        </header>

        <article className="sem-article">
          <header className="sem-head">
            <h1>{current.title}</h1>
            <p>{current.summary}</p>
            <div className="study-actions">
              <button className="study-btn primary" onClick={() => onFlashcards(current.id)}><Layers /> Revisar com {cardCount} flashcards</button>
              <button className="study-btn ghost" onClick={() => onQuiz(current.quizTopic)}><ClipboardCheck /> Testar com quiz</button>
            </div>
          </header>

          <ol className="sem-sections">
            {current.sections.map((section) => (
              <li key={section.title} className="sem-section">
                <h2>{section.title}</h2>
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </li>
            ))}
          </ol>

          {current.patterns && (
            <section className="sem-block">
              <h2>Padrões de achados</h2>
              <div className="sem-patterns">
                {current.patterns.map((pattern) => (
                  <div key={pattern.condition} className="sem-pattern">
                    <b>{pattern.condition}</b>
                    <ul>{pattern.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {current.maneuvers.length > 0 && (
            <section className="sem-block">
              <h2>Sinais e manobras</h2>
              <div className="sem-maneuvers">
                {current.maneuvers.map((maneuver) => (
                  <div key={maneuver.name} className="sem-maneuver">
                    <b>{maneuver.name}</b>
                    <p><span>Como pesquisar</span>{maneuver.how}</p>
                    <p><span>Se positivo</span>{maneuver.positive}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="sem-keypoints">
            <h2><Lightbulb /> Para não esquecer</h2>
            <ul>{current.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
          </section>

          <p className="sem-note"><ShieldCheck /> Conteúdo educacional de semiologia do adulto. Não substitui livro-texto nem conduta clínica.</p>
        </article>
      </div>
    );
  }

  return (
    <div className="page study-page">
      <header className="study-hero">
        <h1>Semiologia</h1>
        <p>Roteiros de anamnese e exame físico, com as manobras que caem na prova e no plantão.</p>
      </header>
      <div className="sem-grid">
        {SEMIOLOGY_MODULES.map((item) => {
          const cards = CURATED_CARDS.filter((card) => card.deck === item.id).length;
          return (
            <button key={item.id} className="sem-card" onClick={() => setOpenId(item.id)}>
              <b>{item.title}</b>
              <small>{item.summary}</small>
              <span className="sem-card-meta">
                <em>{item.sections.length} tópicos</em>
                {item.maneuvers.length > 0 && <em>{item.maneuvers.length} {item.maneuvers.length === 1 ? "manobra" : "manobras"}</em>}
                <em>{cards} flashcards</em>
              </span>
              <ChevronRight className="sem-card-arrow" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
