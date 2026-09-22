"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpenCheck, Check, ChevronRight, ClipboardCheck, ExternalLink, History, Image as ImageIcon, Info, Layers, Lightbulb, Loader2, Network, Search, X } from "lucide-react";
import type { ResearchHistoryItem, ResearchImage, ResearchQuota, ResearchResult } from "@/lib/research-types";

const QUERY_KEY = "semiolab:research-query";
const SUGGESTIONS = ["Sopro sistólico", "Derrame pleural", "Sinal de Babinski", "Ascite", "Escala de Glasgow", "Estertores crepitantes", "Icterícia", "Turgência jugular"];
const STEPS = ["Buscando no conteúdo do SemioLab", "Consultando StatPearls, PubMed e MedlinePlus", "Selecionando imagens", "Montando resumo, mapa mental e flashcards"];

/** Pede à tela de Pesquisa para já buscar um tema (usado pela Home). */
export function queueResearchQuery(query: string) {
  try { sessionStorage.setItem(QUERY_KEY, query); } catch { /* abre só a busca */ }
}

function peekQueuedQuery() {
  try { return sessionStorage.getItem(QUERY_KEY); } catch { return null; }
}

function clearQueuedQuery() {
  try { sessionStorage.removeItem(QUERY_KEY); } catch { /* nada a limpar */ }
}

/** Só o nome do autor: o campo de autoria das imagens às vezes traz o
 * histórico de upload ("User X on en.wikipedia, Commons upload by Y"). */
function authorName(author: string) {
  const name = author
    .replace(/\s*\b(on|at|from)\s+[a-z]{2,3}\.wikipedia\b.*$/i, "")
    .replace(/\s*\b(Commons upload|Transferred|Edited|Uploaded) by\b.*$/i, "")
    .replace(/^User:?\s+/i, "")
    .replace(/[\s.,;]+$/, "");
  return name && !/wiki/i.test(name) ? name : "Autor não identificado";
}

function licenseName(license: string) {
  return /^public domain$/i.test(license) ? "Domínio público" : license;
}

type ResearchExperienceProps = {
  onFlashcards: (deckId: string) => void;
  onQuiz: (topic: string) => void;
  onSemiology: (moduleId: string) => void;
  onUpgrade: () => void;
};

type Opened = { id: string; result: ResearchResult; savedFlashcards: boolean };

export default function ResearchExperience({ onFlashcards, onQuiz, onSemiology, onUpgrade }: ResearchExperienceProps) {
  const [pendingQuery] = useState(() => (typeof window === "undefined" ? null : peekQueuedQuery()));
  const [query, setQuery] = useState(pendingQuery ?? "");
  const [history, setHistory] = useState<ResearchHistoryItem[] | null>(null);
  const [quota, setQuota] = useState<ResearchQuota | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);

  const loadHistory = useCallback(() => {
    fetch("/api/research")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setHistory(data?.history ?? []);
        setQuota(data?.quota ?? null);
      })
      .catch(() => setHistory([]));
  }, []);

  const run = useCallback((raw: string) => {
    const term = raw.trim();
    if (term.length < 3) {
      setError({ message: "Digite pelo menos 3 letras.", limit: false });
      return;
    }
    setError(null);
    setLoading(true);
    setStep(0);
    fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: term }) })
      .then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) {
          setError({ message: data.error || "Não foi possível pesquisar agora.", limit: !!data.limitReached });
          if (data.quota) setQuota(data.quota);
          return;
        }
        setOpened({ id: data.id, result: data.result, savedFlashcards: !!data.savedFlashcards });
        if (data.quota) setQuota(data.quota);
        window.scrollTo({ top: 0 });
      })
      .catch(() => setError({ message: "Sem conexão com o servidor. Tente de novo.", limit: false }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
    clearQueuedQuery();
    if (!pendingQuery) return;
    // Agendado e cancelável: se o componente montar duas vezes (Strict
    // Mode), só uma geração com IA é disparada.
    const timer = window.setTimeout(() => run(pendingQuery), 0);
    return () => window.clearTimeout(timer);
  }, [loadHistory, run, pendingQuery]);

  // Etapas do carregamento avançam enquanto o servidor trabalha (só visual).
  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4500);
    return () => window.clearInterval(timer);
  }, [loading]);

  const openSaved = (id: string) => {
    setLoading(true);
    setStep(STEPS.length - 1);
    fetch(`/api/research?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setOpened({ id: data.id, result: data.result, savedFlashcards: !!data.savedFlashcards }); })
      .finally(() => setLoading(false));
  };

  if (opened && !loading) {
    return (
      <ResearchView
        opened={opened}
        onBack={() => { setOpened(null); loadHistory(); }}
        onSaved={() => setOpened({ ...opened, savedFlashcards: true })}
        onFlashcards={onFlashcards}
        onQuiz={onQuiz}
        onSemiology={onSemiology}
      />
    );
  }

  const quotaText = quota
    ? `${Math.max(0, quota.limit - quota.used)} de ${quota.limit} ${quota.limit === 1 ? "pesquisa" : "pesquisas"} ${quota.window === "dia" ? "hoje" : "nesta semana"}`
    : null;

  return (
    <div className="page study-page">
      <header className="study-hero">
        <h1>Pesquisa por tema</h1>
        <p>Digite um tema e receba um resumo com referências, mapa mental, imagens, flashcards e um quiz para fechar.</p>
      </header>

      <form
        className="rs-search"
        onSubmit={(event) => { event.preventDefault(); if (!loading) run(query); }}
        role="search"
      >
        <label htmlFor="rs-query" className="rs-sr">Tema para pesquisar</label>
        <Search className="rs-search-icon" aria-hidden="true" />
        <input
          id="rs-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex.: sopro sistólico, derrame pleural, sinal de Murphy"
          maxLength={80}
          disabled={loading}
          autoComplete="off"
        />
        <button className="study-btn primary" type="submit" disabled={loading}>{loading ? <Loader2 className="rs-spin" /> : "Pesquisar"}</button>
      </form>
      {quotaText && <p className="rs-quota">{quotaText}. Abrir uma pesquisa salva não gasta.</p>}

      {error && (
        <div className={`rs-error ${error.limit ? "limit" : ""}`} role="alert">
          <span>{error.message}</span>
          {error.limit && quota?.tier !== "pro" && <button className="study-btn primary" onClick={onUpgrade}>Conhecer o Pro</button>}
        </div>
      )}

      {loading ? (
        <ol className="rs-steps" aria-live="polite">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? "done" : i === step ? "active" : ""}>
              <i>{i < step ? <Check /> : i === step ? <Loader2 className="rs-spin" /> : null}</i>
              {label}
            </li>
          ))}
        </ol>
      ) : (
        <>
          <section className="rs-suggest" aria-label="Sugestões de temas">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => { setQuery(s); run(s); }}>{s}</button>
            ))}
          </section>

          {history && history.length > 0 && (
            <section className="rs-history" aria-label="Pesquisas anteriores">
              <h2><History /> Suas pesquisas</h2>
              {history.map((item) => (
                <button key={item.id} className="rs-history-item" onClick={() => openSaved(item.id)}>
                  <span><b>{item.title}</b><small>{new Date(item.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}{item.savedFlashcards ? ", flashcards salvos" : ""}</small></span>
                  <ChevronRight />
                </button>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Texto com citações [n] viradas em links para a lista de referências. */
function Cited({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        return match ? (
          <a key={i} className="rs-cite" href={`#rs-ref-${match[1]}`} aria-label={`Referência ${match[1]}`}>{match[1]}</a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </>
  );
}

type ResearchViewProps = {
  opened: Opened;
  onBack: () => void;
  onSaved: () => void;
  onFlashcards: (deckId: string) => void;
  onQuiz: (topic: string) => void;
  onSemiology: (moduleId: string) => void;
};

function ResearchView({ opened, onBack, onSaved, onFlashcards, onQuiz, onSemiology }: ResearchViewProps) {
  const { result, id } = opened;
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<(number | null)[]>(() => result.quiz.map(() => null));
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<ResearchImage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const answered = answers.filter((a) => a !== null).length;
  const correct = answers.filter((a, i) => a === result.quiz[i].correctIndex).length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightbox && !dialog.open) dialog.showModal();
    if (!lightbox && dialog.open) dialog.close();
  }, [lightbox]);

  const saveFlashcards = () => {
    setSaving(true);
    fetch("/api/research", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, saveFlashcards: true }) })
      .then((r) => { if (r.ok) onSaved(); })
      .finally(() => setSaving(false));
  };

  const nav = [
    { id: "rs-resumo", label: "Resumo" },
    { id: "rs-mapa", label: "Mapa mental" },
    ...(result.images.length ? [{ id: "rs-imagens", label: "Imagens" }] : []),
    { id: "rs-flashcards", label: "Flashcards" },
    { id: "rs-quiz", label: "Quiz" },
    { id: "rs-refs", label: "Referências" },
  ];

  return (
    <div className="page study-page rs-page">
      <header className="study-bar">
        <button className="study-back" onClick={onBack}><ArrowLeft /> Pesquisas</button>
      </header>

      <header className="rs-head">
        <h1>{result.title}</h1>
        <p><Cited text={result.overview} /></p>
        <nav className="rs-nav" aria-label="Seções da pesquisa">
          {nav.map((item) => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
      </header>

      <section id="rs-resumo" className="rs-block">
        {result.sections.map((section) => (
          <div key={section.heading} className="rs-section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((p, i) => <p key={i}><Cited text={p} /></p>)}
          </div>
        ))}
        <div className="sem-keypoints">
          <h2><Lightbulb /> Pontos-chave</h2>
          <ul>{result.keyPoints.map((k) => <li key={k}><Cited text={k} /></li>)}</ul>
        </div>
        {result.semiologyModules.length > 0 && (
          <div className="rs-related">
            <span>No SemioLab:</span>
            {result.semiologyModules.map((m) => (
              <button key={m.id} onClick={() => onSemiology(m.id)}><BookOpenCheck /> {m.title}</button>
            ))}
          </div>
        )}
      </section>

      <section id="rs-mapa" className="rs-block">
        <h2 className="rs-title"><Network /> Mapa mental</h2>
        <div className="rs-map">
          <div className="rs-map-center">{result.mindMap.center}</div>
          <div className="rs-map-branches" style={{ ["--cols" as string]: result.mindMap.branches.length }}>
            {result.mindMap.branches.map((branch, i) => (
              <div key={branch.label} className={`rs-map-branch tone-${i % 6}`}>
                <b>{branch.label}</b>
                <ul>{branch.children.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {result.images.length > 0 && (
        <section id="rs-imagens" className="rs-block">
          <h2 className="rs-title"><ImageIcon /> Imagens</h2>
          <div className="rs-images">
            {result.images.map((img) => (
              <figure key={img.fullUrl} className="rs-image">
                <button onClick={() => setLightbox(img)} aria-label={`Ampliar imagem: ${img.title}`}>
                  {/* Imagens de licença livre; autoria e licença ficam nos Termos de Uso. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.thumbUrl} alt={img.description || img.title} loading="lazy" referrerPolicy="no-referrer" />
                </button>
                <figcaption>
                  <b>{img.title}</b>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section id="rs-flashcards" className="rs-block">
        <div className="rs-title-row">
          <h2 className="rs-title"><Layers /> Flashcards</h2>
          {opened.savedFlashcards ? (
            <button className="study-btn primary" onClick={() => onFlashcards(`pesq:${id}`)}>Estudar com repetição espaçada <ChevronRight /></button>
          ) : (
            <button className="study-btn primary" onClick={saveFlashcards} disabled={saving}>{saving ? "Salvando…" : "Salvar nos meus flashcards"}</button>
          )}
        </div>
        <div className="rs-cards">
          {result.flashcards.map((card, i) => {
            const isFlipped = flipped.has(i);
            return (
              <button
                key={i}
                className={`rs-card ${isFlipped ? "flipped" : ""}`}
                onClick={() => setFlipped((set) => { const next = new Set(set); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                aria-label={isFlipped ? "Mostrar a pergunta" : "Mostrar a resposta"}
              >
                <small>{isFlipped ? "Resposta" : "Pergunta"}</small>
                <b>{isFlipped ? card.back : card.front}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section id="rs-quiz" className="rs-block">
        <h2 className="rs-title"><ClipboardCheck /> Quiz sobre o tema</h2>
        <ol className="rs-quiz">
          {result.quiz.map((item, qi) => {
            const chosen = answers[qi];
            return (
              <li key={qi} className="rs-question">
                <b>{item.question}</b>
                <div className="rs-options">
                  {item.options.map((option, oi) => {
                    const state = chosen === null ? "" : oi === item.correctIndex ? "right" : oi === chosen ? "wrong" : "dim";
                    return (
                      <button
                        key={oi}
                        className={`rs-option ${state}`}
                        disabled={chosen !== null}
                        onClick={() => setAnswers((list) => list.map((a, i) => (i === qi ? oi : a)))}
                      >
                        <i>{String.fromCharCode(65 + oi)}</i>{option}
                      </button>
                    );
                  })}
                </div>
                {chosen !== null && <p className={`rs-feedback ${chosen === item.correctIndex ? "right" : "wrong"}`}>{chosen === item.correctIndex ? "Correto. " : "Não foi dessa vez. "}{item.explanation}</p>}
              </li>
            );
          })}
        </ol>
        {answered === result.quiz.length && (
          <div className="rs-score">
            <b>{correct} de {result.quiz.length} corretas</b>
            <div className="study-actions">
              {result.quizTopic && <button className="study-btn primary" onClick={() => onQuiz(result.quizTopic!)}>Mais questões de {result.quizTopic} <ChevronRight /></button>}
              {!opened.savedFlashcards && <button className="study-btn ghost" onClick={saveFlashcards} disabled={saving}>Salvar os flashcards</button>}
            </div>
          </div>
        )}
      </section>

      <section id="rs-refs" className="rs-block">
        <h2 className="rs-title">Referências</h2>
        <ol className="rs-refs">
          {result.sources.map((source) => (
            <li key={source.n} id={`rs-ref-${source.n}`}>
              <b>[{source.n}]</b>{" "}
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ExternalLink /></a>
              ) : source.moduleId ? (
                <button onClick={() => onSemiology(source.moduleId!)}>{source.title}</button>
              ) : (
                source.title
              )}
            </li>
          ))}
        </ol>
        {result.images.length > 0 && (
          <details className="rs-credits">
            <summary aria-label="Créditos das imagens"><Info /></summary>
            <ul>
              {result.images.map((img) => (
                <li key={img.fullUrl}>
                  {img.title}: {authorName(img.author)}, {img.licenseUrl ? <a href={img.licenseUrl} target="_blank" rel="noopener noreferrer">{licenseName(img.license)}</a> : licenseName(img.license)}.{" "}
                  <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer">Página da imagem</a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <dialog ref={dialogRef} className="rs-lightbox" onClose={() => setLightbox(null)} onClick={(e) => { if (e.target === dialogRef.current) setLightbox(null); }}>
        {lightbox && (
          <figure>
            <button className="rs-lightbox-close" onClick={() => setLightbox(null)} aria-label="Fechar imagem"><X /></button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.fullUrl} alt={lightbox.description || lightbox.title} referrerPolicy="no-referrer" />
            <figcaption>
              <b>{lightbox.title}</b>
              {lightbox.description && <span>{lightbox.description}</span>}
            </figcaption>
          </figure>
        )}
      </dialog>
    </div>
  );
}
