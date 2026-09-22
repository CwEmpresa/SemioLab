"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Layers, NotebookPen, RotateCcw, Search } from "lucide-react";

type Deck = { id: string; title: string; quizTopic: string | null; kind: "semiologia" | "erros" | "pesquisa"; total: number; due: number; fresh: number };
type SessionCard = { id: string; deck: string; front: string; back: string; isNew: boolean };
type Grade = 0 | 1 | 2 | 3;

const DECK_KEY = "semiolab:flashcards-deck";

/** Pede à tela de Flashcards para abrir direto num baralho (usado pela
 * área de Semiologia). A tela lê e descarta o pedido ao montar. */
export function queueFlashcardDeck(deckId: string) {
  try { sessionStorage.setItem(DECK_KEY, deckId); } catch { /* abre na lista de baralhos */ }
}

function takeQueuedDeck() {
  try {
    const value = sessionStorage.getItem(DECK_KEY);
    sessionStorage.removeItem(DECK_KEY);
    return value;
  } catch {
    return null;
  }
}

const GRADES: { grade: Grade; label: string; hint: string; tone: string }[] = [
  { grade: 0, label: "Errei", hint: "volta em 10 min", tone: "again" },
  { grade: 1, label: "Difícil", hint: "volta em breve", tone: "hard" },
  { grade: 2, label: "Bom", hint: "intervalo normal", tone: "good" },
  { grade: 3, label: "Fácil", hint: "intervalo maior", tone: "easy" },
];

export default function FlashcardsExperience({ onQuiz }: { onQuiz: (topic: string) => void }) {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<SessionCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState<Record<Grade, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDecks = useCallback(() => {
    return fetch("/api/flashcards")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: Deck[] = data?.decks ?? [];
        setDecks(list);
        return list;
      })
      .catch(() => {
        setDecks([]);
        return [] as Deck[];
      });
  }, []);

  const openDeck = useCallback((target: Deck) => {
    setDeck(target);
    setLoadingSession(true);
    setIndex(0);
    setFlipped(false);
    setTally({ 0: 0, 1: 0, 2: 0, 3: 0 });
    fetch(`/api/flashcards?deck=${encodeURIComponent(target.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setCards(data?.cards ?? []);
        setNextDue(data?.nextDue ?? null);
      })
      .catch(() => setCards([]))
      .finally(() => setLoadingSession(false));
  }, []);

  useEffect(() => {
    const queued = takeQueuedDeck();
    loadDecks().then((list) => {
      const target = queued ? list.find((d) => d.id === queued) : null;
      if (target) openDeck(target);
    });
  }, [loadDecks, openDeck]);

  const card = cards[index];
  const finished = !!deck && !loadingSession && index >= cards.length;

  const answer = useCallback(
    (grade: Grade) => {
      if (!card || saving) return;
      setSaving(true);
      fetch("/api/flashcards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, grade }),
      })
        .catch(() => {})
        .finally(() => {
          setSaving(false);
          setTally((t) => ({ ...t, [grade]: t[grade] + 1 }));
          // "Errei" devolve a carta ao fim desta mesma sessão.
          if (grade === 0) setCards((list) => [...list, { ...card, isNew: false }]);
          setFlipped(false);
          setIndex((i) => i + 1);
        });
    },
    [card, saving],
  );

  // Atalhos só durante a sessão: espaço vira a carta, 1–4 responde.
  useEffect(() => {
    if (!deck || finished || !card) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(event.key)) {
        answer((Number(event.key) - 1) as Grade);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, finished, card, flipped, answer]);

  const backToDecks = () => {
    setDeck(null);
    setCards([]);
    loadDecks();
  };

  if (deck) {
    const reviewed = tally[0] + tally[1] + tally[2] + tally[3];
    return (
      <div className="page study-page">
        <header className="study-bar">
          <button className="study-back" onClick={backToDecks}><ArrowLeft /> Baralhos</button>
          <span className="study-bar-title">{deck.title}</span>
          {!finished && cards.length > 0 && <span className="study-bar-count">{Math.min(index + 1, cards.length)} de {cards.length}</span>}
        </header>

        {loadingSession ? (
          <div className="fc-stage"><div className="fc-card skeleton" aria-label="Carregando cartas" /></div>
        ) : finished ? (
          <section className="fc-done">
            <span className="fc-done-icon"><Check /></span>
            <h1>{reviewed ? "Sessão concluída" : "Nada para revisar agora"}</h1>
            <p>
              {reviewed
                ? `Você revisou ${reviewed} ${reviewed === 1 ? "carta" : "cartas"}. As mais difíceis voltam antes.`
                : nextDue
                  ? `A próxima revisão deste baralho é em ${new Date(nextDue).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}.`
                  : "Este baralho ainda não tem cartas."}
            </p>
            {reviewed > 0 && (
              <ul className="fc-tally">
                {GRADES.map((g) => <li key={g.grade} className={`tone-${g.tone}`}><b>{tally[g.grade]}</b><small>{g.label}</small></li>)}
              </ul>
            )}
            <div className="study-actions">
              <button className="study-btn primary" onClick={backToDecks}><Layers /> Outro baralho</button>
              {deck.quizTopic && <button className="study-btn ghost" onClick={() => onQuiz(deck.quizTopic!)}>Testar com quiz <ChevronRight /></button>}
            </div>
          </section>
        ) : card ? (
          <>
            <div className="fc-progress" aria-hidden="true"><i style={{ width: `${(index / cards.length) * 100}%` }} /></div>
            <div className="fc-stage">
              <button
                className={`fc-card ${flipped ? "flipped" : ""}`}
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? "Mostrar a pergunta" : "Mostrar a resposta"}
              >
                <span className="fc-face fc-front" aria-hidden={flipped}>
                  <small>{card.isNew ? "Carta nova" : "Revisão"}</small>
                  <b>{card.front}</b>
                  <em><RotateCcw /> Toque para ver a resposta</em>
                </span>
                <span className="fc-face fc-back" aria-hidden={!flipped}>
                  <small>Resposta</small>
                  <b>{card.back}</b>
                </span>
              </button>
            </div>
            <div className={`fc-grades ${flipped ? "visible" : ""}`}>
              {flipped ? (
                GRADES.map((g) => (
                  <button key={g.grade} className={`fc-grade tone-${g.tone}`} onClick={() => answer(g.grade)} disabled={saving}>
                    <b>{g.label}</b><small>{g.hint}</small>
                  </button>
                ))
              ) : (
                <button className="study-btn primary wide" onClick={() => setFlipped(true)}>Mostrar resposta</button>
              )}
            </div>
            <p className="fc-keys">Atalhos: espaço vira a carta, teclas 1 a 4 respondem.</p>
          </>
        ) : null}
      </div>
    );
  }

  const totalDue = (decks ?? []).reduce((sum, d) => sum + d.due, 0);
  return (
    <div className="page study-page">
      <header className="study-hero">
        <h1>Flashcards</h1>
        <p>
          {decks === null
            ? "Carregando seus baralhos…"
            : totalDue
              ? `${totalDue} ${totalDue === 1 ? "carta espera" : "cartas esperam"} revisão hoje. As que você erra voltam mais cedo.`
              : "Repetição espaçada: cada carta volta no momento certo para você não esquecer."}
        </p>
      </header>
      <div className="deck-grid">
        {(decks ?? []).map((d) => {
          const empty = d.total === 0;
          return (
            <button key={d.id} className={`deck-card ${d.kind}`} onClick={() => openDeck(d)} disabled={empty}>
              <span className="deck-icon">{d.kind === "erros" ? <NotebookPen /> : d.kind === "pesquisa" ? <Search /> : <Layers />}</span>
              <span className="deck-copy">
                <b>{d.title}</b>
                <small>
                  {empty
                    ? "Seus erros de quiz viram cartas aqui"
                    : [d.due ? `${d.due} para revisar` : null, d.fresh ? `${d.fresh} ${d.fresh === 1 ? "nova" : "novas"}` : null].filter(Boolean).join(", ") || "Em dia"}
                </small>
              </span>
              {d.due > 0 && <em className="deck-due">{d.due}</em>}
              <ChevronRight className="deck-arrow" />
            </button>
          );
        })}
        {decks === null && Array.from({ length: 4 }, (_, i) => <span key={i} className="deck-card skeleton" aria-hidden="true" />)}
      </div>
    </div>
  );
}
