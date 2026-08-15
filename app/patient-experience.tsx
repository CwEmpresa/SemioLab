"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  DoorOpen,
  History,
  FileHeart,
  Lightbulb,
  NotebookPen,
  Plus,
  Send,
  ShieldCheck,
  Stethoscope,
  Video,
  X,
} from "lucide-react";

type Phase = "wait" | "chat" | "finish" | "result";
type LabRow = {
  name: string;
  value: string;
  unit: string;
  reference: string;
  status?: "normal" | "high" | "low";
};
type ExamImage = {
  title: string;
  image?: string;
  findings: string;
  comparison: string;
  caption?: string;
  source?: string;
  sourceUrl?: string;
  license?: string;
};
type ExamReport = {
  summary: string;
  labs: LabRow[];
  imaging: ExamImage[];
};
type Message = {
  who: "patient" | "student" | "exam";
  text: string;
  report?: ExamReport;
  createdAt: number;
};
type ConsultHistory = {
  id: string;
  finishedAt: number;
  score: number;
  level: string;
  title: string;
  hypothesis: string;
  strengths: string[];
  gaps: string[];
  examLearning: string[];
};
const PATIENT_SESSION_KEY = "semiolab:patient-session:v2";
const PATIENT_HISTORY_KEY = "semiolab:consult-history:v1";

function messageTime(timestamp: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
const Brand = () => (
  <div className="logo logo-signature">
    <img
      className="brand-wordmark"
      src="/semiolab-wordmark.png"
      alt="SemioLab"
    />
  </div>
);

export default function PatientExperience({
  go,
}: {
  go: (screen: "home" | "study") => void;
}) {
  const [phase, setPhase] = useState<Phase>("wait"),
    [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [asked, setAsked] = useState<Record<string, number>>({}),
    [physical, setPhysical] = useState(false),
    [physicalOpen, setPhysicalOpen] = useState(false),
    [physicalFindings, setPhysicalFindings] = useState<Record<string, string>>({}),
    [examOpen, setExamOpen] = useState(false),
    [examText, setExamText] = useState(""),
    [examOrder, setExamOrder] = useState(""),
    [typing, setTyping] = useState(false),
    [pendingReply, setPendingReply] = useState(""),
    [notes, setNotes] = useState(""),
    [notesOpen, setNotesOpen] = useState(false),
    [history, setHistory] = useState<ConsultHistory[]>([]),
    [selectedHistory, setSelectedHistory] = useState<ConsultHistory | null>(null),
    [restored, setRestored] = useState(false),
    [today, setToday] = useState("Hoje"),
    [clock, setClock] = useState("--:--"),
    [hypothesis, setHypothesis] = useState(""),
    [differentials, setDifferentials] = useState(""),
    [conduct, setConduct] = useState(""),
    [sessionId, setSessionId] = useState<string | null>(null),
    [caseInfo, setCaseInfo] = useState<{ title: string; specialty: string } | null>(null),
    [blocked, setBlocked] = useState<{ checkoutUrls: { monthly: string; annual: string } } | null>(null),
    [loadError, setLoadError] = useState(""),
    [finishing, setFinishing] = useState(false),
    [serverEvaluation, setServerEvaluation] = useState<{
      score: number; historyScore: number; physicalScore: number; examsScore: number; reasoningScore: number;
      strengths: string[]; gaps: string[]; examLearning: string[]; feedback: string;
    } | null>(null);
  const chatRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PATIENT_SESSION_KEY);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.phase && session.phase !== "result") setPhase(session.phase);
        if (Array.isArray(session.messages)) {
          const base = Date.now() - session.messages.length * 60_000;
          setMessages(session.messages.map((message: Message, index: number) => ({
            ...message,
            createdAt: message.createdAt || base + index * 60_000,
          })));
        }
        if (session.asked) setAsked(session.asked);
        if (typeof session.input === "string") setInput(session.input);
        if (typeof session.physical === "boolean") setPhysical(session.physical);
        if (typeof session.examText === "string") setExamText(session.examText);
        if (typeof session.examOrder === "string") setExamOrder(session.examOrder);
        if (typeof session.pendingReply === "string") setPendingReply(session.pendingReply);
        if (typeof session.notes === "string") setNotes(session.notes);
        if (typeof session.hypothesis === "string") setHypothesis(session.hypothesis);
        if (typeof session.differentials === "string") setDifferentials(session.differentials);
        if (typeof session.conduct === "string") setConduct(session.conduct);
      }
      const savedHistory = window.localStorage.getItem(PATIENT_HISTORY_KEY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 12));
      }
    } catch {
      window.localStorage.removeItem(PATIENT_SESSION_KEY);
    } finally {
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    if (phase === "result") {
      window.localStorage.removeItem(PATIENT_SESSION_KEY);
      return;
    }
    if (phase === "wait" && messages.length === 0) return;
    window.localStorage.setItem(
      PATIENT_SESSION_KEY,
      JSON.stringify({
        phase,
        messages,
        asked,
        input,
        physical,
        examText,
        examOrder,
        pendingReply,
        notes,
        hypothesis,
        differentials,
        conduct,
      }),
    );
  }, [
    restored,
    phase,
    messages,
    asked,
    input,
    physical,
    examText,
    examOrder,
    pendingReply,
    notes,
    hypothesis,
    differentials,
    conduct,
  ]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const date = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(now);
      setToday(date.charAt(0).toUpperCase() + date.slice(1));
      setClock(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(now));
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);
  useEffect(() => {
    if (!restored || !pendingReply) return;
    setTyping(true);
    const timer = window.setTimeout(() => {
      setMessages((m) => [...m, { who: "patient", text: pendingReply, createdAt: Date.now() }]);
      setPendingReply("");
      setTyping(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [restored, pendingReply]);
  const score = serverEvaluation?.score ?? 0,
    level =
      score >= 85
        ? "Excelente condução"
        : score >= 70
          ? "Boa condução"
          : score >= 50
            ? "Condução parcial"
            : "Precisa aprofundar",
    title =
      score >= 85
        ? "Você construiu um raciocínio clínico consistente."
        : score >= 70
          ? "Você chegou perto de uma investigação completa."
          : score >= 50
            ? "Alguns dados importantes ficaram de fora."
            : "A consulta terminou antes de reunir dados essenciais.";
  async function start() {
    setAsked({});
    setTyping(false);
    setPhysical(false);
    setExamOrder("");
    setExamText("");
    setPendingReply("");
    setHypothesis("");
    setDifferentials("");
    setConduct("");
    setNotes("");
    setServerEvaluation(null);
    setLoadError("");
    setBlocked(null);
    setMessages([]);
    setPhase("chat");
    try {
      const response = await fetch("/api/patient/session", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403 && data.requiresPro) {
        setBlocked({ checkoutUrls: data.checkoutUrls });
        return;
      }
      if (!response.ok) {
        setLoadError(data.error || "Não foi possível iniciar o atendimento.");
        return;
      }
      setSessionId(data.sessionId);
      setCaseInfo({ title: data.caseTitle, specialty: data.specialty });
      setMessages([{ who: "patient", text: data.openingLine, createdAt: Date.now() }]);
    } catch {
      setLoadError("Não foi possível conectar ao servidor. Tente novamente.");
    }
  }
  async function send() {
    const question = input.trim();
    if (!question || !sessionId || typing) return;
    setMessages((m) => [...m, { who: "student", text: question, createdAt: Date.now() }]);
    setInput("");
    setTyping(true);
    try {
      const response = await fetch("/api/patient/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, message: question }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setMessages((m) => [...m, { who: "patient", text: data.error || "Não consegui responder agora.", createdAt: Date.now() }]);
        setTyping(false);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      const createdAt = Date.now();
      setMessages((m) => [...m, { who: "patient", text: "", createdAt }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.who === "patient" && last.createdAt === createdAt) next[next.length - 1] = { ...last, text: full };
          return next;
        });
      }
    } catch {
      setMessages((m) => [...m, { who: "patient", text: "Desculpa, tive um problema para responder.", createdAt: Date.now() }]);
    } finally {
      setTyping(false);
    }
  }
  async function requestExam() {
    const order = examText.trim();
    if (!order || !sessionId) return;
    setExamOrder(order);
    setExamOpen(false);
    setExamText("");
    try {
      const response = await fetch("/api/patient/exam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, order }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessages((m) => [...m, { who: "patient", text: data.error || "Não foi possível liberar o exame.", createdAt: Date.now() }]);
        return;
      }
      setMessages((m) => [...m, { who: "exam", text: "RESULTADOS LIBERADOS", report: data.report, createdAt: Date.now() }]);
    } catch {
      setMessages((m) => [...m, { who: "patient", text: "Não foi possível liberar o exame agora.", createdAt: Date.now() }]);
    }
  }
  async function requestPhysicalExam() {
    if (!sessionId) return;
    setPhysical(true);
    setPhysicalOpen(true);
    try {
      const response = await fetch("/api/patient/exam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, physical: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setPhysicalFindings(data.physicalExam || {});
    } catch {
      /* mantém o modal com estado vazio; não é crítico */
    }
  }
  function finishConsult() {
    if (!hypothesis.trim() || !conduct.trim() || !sessionId || finishing) return;
    setFinishing(true);
    fetch("/api/patient/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, hypothesis, differentials, conduct }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setLoadError(data.error || "Não foi possível avaliar o atendimento.");
          setFinishing(false);
          return;
        }
        setServerEvaluation(data);
        const record: ConsultHistory = {
          id: `${Date.now()}`,
          finishedAt: Date.now(),
          score: data.score,
          level: data.score >= 85 ? "Excelente condução" : data.score >= 70 ? "Boa condução" : data.score >= 50 ? "Condução parcial" : "Precisa aprofundar",
          title: caseInfo?.title || "Atendimento",
          hypothesis: hypothesis.trim(),
          strengths: data.strengths,
          gaps: data.gaps,
          examLearning: data.examLearning,
        };
        const next = [record, ...history].slice(0, 12);
        setHistory(next);
        window.localStorage.setItem(PATIENT_HISTORY_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("semiolab:learning-updated"));
        setFinishing(false);
        setPhase("result");
      })
      .catch(() => {
        setLoadError("Não foi possível conectar ao servidor para avaliar o atendimento.");
        setFinishing(false);
      });
  }
  if (blocked)
    return (
      <div className="patient-wait">
        <div className="patient-wait-shade" />
        <header className="patient-wait-header">
          <button aria-label="Voltar ao início" onClick={() => go("home")}>
            <ArrowLeft />
          </button>
          <Brand />
          <span />
        </header>
        <main className="patient-wait-content">
          <section className="patient-wait-intro">
            <small><i /> RECURSO PRO</small>
            <h1>A simulação com paciente-IA é exclusiva do plano Pro.</h1>
            <p>Assine para conversar com pacientes virtuais gerados por IA, com casos clínicos reais e avaliação de raciocínio, comunicação, diagnóstico e conduta.</p>
          </section>
          <section className="patient-call-panel">
            <a className="primary" href={blocked.checkoutUrls.monthly} target="_blank" rel="noopener noreferrer">
              <span>Assinar mensal</span>
            </a>
            <a className="primary" href={blocked.checkoutUrls.annual} target="_blank" rel="noopener noreferrer">
              <span>Assinar anual</span>
            </a>
            <button onClick={() => go("home")}>Voltar ao início</button>
          </section>
        </main>
      </div>
    );
  if (phase === "wait")
    return (
      <div className="patient-wait">
        <div className="patient-wait-shade" />
        <header className="patient-wait-header">
          <button aria-label="Voltar ao início" onClick={() => go("home")}>
            <ArrowLeft />
          </button>
          <Brand />
          <button aria-label="Ajuda sobre a simulação">
            <CircleHelp />
          </button>
        </header>

        <main className="patient-wait-content">
          <section className="patient-wait-intro">
            <small>
              <i /> PRONTO PARA ATENDER
            </small>
            <h1>Um novo paciente está aguardando atendimento.</h1>
            <p>
              Conduza a consulta sem pistas. Investigue, examine e tome sua
              decisão clínica.
            </p>
          </section>

          <aside className="patient-door-status">
            <DoorOpen />
            <span>
              <b>Paciente aguardando</b>
              <small>Do outro lado da porta</small>
            </span>
          </aside>

          <section className="patient-call-panel">
            <button className="primary" onClick={start}>
              <span>Chamar próximo paciente</span>
              <DoorOpen />
            </button>
            {loadError && <div role="alert" className="patient-load-error">{loadError}</div>}
            <em>
              <ShieldCheck /> Simulação educacional · Cenário fictício
            </em>
          </section>

          <section className="patient-history-panel">
            <header>
              <span><History /><b>Consultas recentes</b></span>
              <small>{history.length ? `${history.length} registrada${history.length > 1 ? "s" : ""}` : "Histórico local"}</small>
            </header>
            {history.length ? (
              <div>
                {history.slice(0, 3).map((item) => (
                  <button key={item.id} onClick={() => setSelectedHistory(item)}>
                    <i>{item.score}</i>
                    <span>
                      <b>Marina Rocha · 54 anos</b>
                      <small>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.finishedAt))}</small>
                    </span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            ) : (
              <p>Suas consultas finalizadas e as avaliações didáticas aparecerão aqui.</p>
            )}
          </section>
        </main>
        {selectedHistory && (
          <div className="overlay history-overlay">
            <section className="history-detail">
              <button className="close" onClick={() => setSelectedHistory(null)}><X /></button>
              <small>AVALIAÇÃO ANTERIOR</small>
              <h2>{selectedHistory.title}</h2>
              <div className="history-detail-score"><b>{selectedHistory.score}</b><span>{selectedHistory.level}</span></div>
              <p><b>Hipótese registrada:</b> {selectedHistory.hypothesis}</p>
              <h3><Check /> Pontos bem conduzidos</h3>
              <ul>{selectedHistory.strengths.length ? selectedHistory.strengths.map((item) => <li key={item}>{item}</li>) : <li>Nenhum critério clínico suficiente foi registrado.</li>}</ul>
              <h3><Lightbulb /> Próximos passos</h3>
              <ul>{selectedHistory.gaps.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          </div>
        )}
      </div>
    );
  if (phase === "result")
    return (
      <div className="result">
        <header>
          <Brand />
          <button onClick={() => go("home")}>
            <X />
          </button>
        </header>
        <main>
          <section className="result-hero">
            <div
              className="score dynamic"
              style={{ background: `radial-gradient(circle,#fff 58%,transparent 60%),conic-gradient(#13a58f ${score}%,#e7efed 0)` }}
            >
              <b>{score}</b>
              <small>/ 100</small>
            </div>
            <span>
              <small>AVALIAÇÃO BASEADA NAS AÇÕES REGISTRADAS</small>
              <h1>{title}</h1>
              <p><b>{level}</b> · Caso esperado: insuficiência cardíaca descompensada.</p>
            </span>
          </section>
          <div className="score-breakdown">
            <span>
              <b>{serverEvaluation?.historyScore ?? 0}<em>/30</em></b>
              <small>Anamnese</small><i style={{ width: `${(serverEvaluation?.historyScore ?? 0) / 30 * 100}%` }} />
            </span>
            <span>
              <b>{serverEvaluation?.physicalScore ?? 0}<em>/15</em></b>
              <small>Exame físico</small><i style={{ width: `${(serverEvaluation?.physicalScore ?? 0) / 15 * 100}%` }} />
            </span>
            <span>
              <b>{serverEvaluation?.examsScore ?? 0}<em>/15</em></b>
              <small>Exames</small><i style={{ width: `${(serverEvaluation?.examsScore ?? 0) / 15 * 100}%` }} />
            </span>
            <span>
              <b>{serverEvaluation?.reasoningScore ?? 0}<em>/40</em></b>
              <small>Raciocínio</small><i style={{ width: `${(serverEvaluation?.reasoningScore ?? 0) / 40 * 100}%` }} />
            </span>
          </div>
          <div className="feedback">
            <article>
              <h3>
                <Check /> O que você conduziu bem
              </h3>
              <ul>{(serverEvaluation?.strengths.length ?? 0) ? serverEvaluation!.strengths.map((item) => <li key={item}>{item}</li>) : <li>Não houve evidência suficiente para pontuar esta parte.</li>}</ul>
            </article>
            <article>
              <h3>
                <CircleAlert /> O que faltou investigar
              </h3>
              <ul>{(serverEvaluation?.gaps.length ?? 0) ? serverEvaluation!.gaps.map((item) => <li key={item}>{item}</li>) : <li>Os principais critérios deste caso foram cobertos.</li>}</ul>
            </article>
          </div>
          <section className="clinical-learning">
            <header><Lightbulb /><span><small>APRENDIZADO DO CASO</small><h2>Como conectar os achados</h2></span></header>
            <p>Dispneia aos esforços, ortopneia, dispneia paroxística noturna, edema e ganho de peso formam um padrão de congestão. No exame, B3, turgência jugular, crepitações e edema reforçam insuficiência cardíaca descompensada.</p>
            <div>
              {(serverEvaluation?.examLearning ?? []).map((item) => <p key={item}><Check />{item}</p>)}
            </div>
            <aside><ShieldCheck /><span><b>Critério de segurança</b><small>A nota usa apenas perguntas, ações e respostas preenchidas nesta consulta. Exames não solicitados não contam, e imagens só aparecem quando há correspondência clínica e fonte validada.</small></span></aside>
          </section>
          <footer>
            <button onClick={() => go("study")}>
              Revisar aula recomendada
            </button>
            <button className="primary" onClick={start}>
              Próximo paciente <ChevronRight />
            </button>
          </footer>
        </main>
      </div>
    );
  return (
    <div className="consult">
      <header>
        <button aria-label="Voltar" onClick={() => go("home")}>
          <ArrowLeft />
        </button>
        <div className="patient-chat-identity">
          <i className="patient-avatar">MR<small /></i>
          <span>
            <b>Marina Rocha</b>
            <small>54 anos · online agora</small>
          </span>
        </div>
        <div className="header-clinical-actions">
          <button aria-label="Consulta simulada em vídeo" title="Consulta simulada">
            <Video />
          </button>
        </div>
        <em>
          <Clock3 /> {clock}
        </em>
        <button onClick={() => setPhase("finish")}>Finalizar</button>
      </header>
      <main ref={chatRef}>
        <section className="patient-chat-profile">
          <i className="patient-profile-avatar">MR<span /></i>
          <b>Marina Rocha</b>
          <small>Consulta simulada · Atendimento em andamento</small>
        </section>
        <div className="chat-day">
          <span>{today}</span>
        </div>
        <div className="reason">
          <FileHeart />
          <span>
            <small>MOTIVO INFORMADO NA RECEPÇÃO</small>
            <p>“Cansaço e falta de ar desde ontem.”</p>
          </span>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            <i>
              {m.who === "patient" ? (
                "MR"
              ) : m.who === "exam" ? (
                <FileHeart />
              ) : (
                "Você"
              )}
            </i>
            {m.report ? (
              <div className="exam-report">
                <header>
                  <span>
                    <small>LAUDO SIMULADO</small>
                    <b>{m.text}</b>
                  </span>
                  <em>Uso educacional · {messageTime(m.createdAt)}</em>
                </header>
                <p>{m.report.summary}</p>
                {m.report.imaging.map((exam, examIndex) => (
                  <section className="imaging-result" key={`${exam.title}-${examIndex}`}>
                    <div>
                      <small>{exam.image ? "IMAGEM VALIDADA" : "RESULTADO ESTRUTURADO"}</small>
                      <h3>{exam.title}</h3>
                      <p>
                        <b>Achados:</b> {exam.findings}
                      </p>
                      <p>
                        <b>Comparação:</b> {exam.comparison}
                      </p>
                    </div>
                    {exam.image ? (
                      <figure>
                        <img
                          src={exam.image}
                          alt={`Imagem clínica de referência: ${exam.title}`}
                        />
                        <figcaption>
                          <span>{exam.caption || "Imagem disponibilizada para correlação clínica"}</span>
                          {exam.source && exam.sourceUrl && (
                            <a href={exam.sourceUrl} target="_blank" rel="noopener noreferrer">
                              Fonte: {exam.source} · {exam.license}
                            </a>
                          )}
                        </figcaption>
                      </figure>
                    ) : null}
                  </section>
                ))}
                {m.report.labs.length > 0 && (
                  <div className="lab-table-wrap">
                    <table className="lab-table">
                      <thead>
                        <tr>
                          <th>Exame</th>
                          <th>Resultado</th>
                          <th>Unidade</th>
                          <th>Referência</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.report.labs.map((row) => (
                          <tr key={row.name}>
                            <td>{row.name}</td>
                            <td>
                              <b>{row.value}</b>
                            </td>
                            <td>{row.unit || "—"}</td>
                            <td>{row.reference}</td>
                            <td>
                              <span className={row.status}>
                                {row.status === "high"
                                  ? "Alto"
                                  : row.status === "low"
                                    ? "Baixo"
                                    : "Normal"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div className="message-content">
                <p>{m.text}</p>
                <time>{messageTime(m.createdAt)}</time>
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="msg patient typing-message" aria-label="Paciente digitando">
            <i>MR</i>
            <div className="typing-bubble"><span /><span /><span /></div>
          </div>
        )}
      </main>
      <footer>
        <div className="consult-tools">
          <button
            className={physical ? "completed" : ""}
            onClick={requestPhysicalExam}
          >
            <Stethoscope /> {physical ? "Exame realizado" : "Exame físico"}
          </button>
          <button
            className={examOrder ? "completed" : ""}
            onClick={() => setExamOpen(true)}
          >
            <ClipboardCheck /> {examOrder ? "Novo exame" : "Solicitar exame"}
          </button>
          <button className={notes.trim() ? "completed" : ""} onClick={() => setNotesOpen(true)}>
            <NotebookPen /> {notes.trim() ? "Anotações salvas" : "Anotações"}
          </button>
          <span>Consulta educacional</span>
        </div>
        <label>
          <button className="chat-attach" aria-label="Solicitar exame" onClick={() => setExamOpen(true)}>
            <Plus />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Faça uma pergunta ao paciente..."
          />
          <button aria-label="Enviar pergunta" disabled={!input.trim()} onClick={send}>
            <Send />
          </button>
        </label>
      </footer>
      {physicalOpen && (
        <div className="overlay">
          <section className="clinical-modal">
            <button className="close" onClick={() => setPhysicalOpen(false)}>
              <X />
            </button>
            <small>EXAME FÍSICO REALIZADO</small>
            <h2>Achados clínicos</h2>
            {Object.keys(physicalFindings).length ? (
              Object.entries(physicalFindings).map(([key, value]) => (
                <p key={key}>
                  <b>{key.replace(/_/g, " ")}:</b> {value}
                </p>
              ))
            ) : (
              <p>Examinando o paciente...</p>
            )}
            <button className="primary" onClick={() => setPhysicalOpen(false)}>
              Registrar e continuar <ChevronRight />
            </button>
          </section>
        </div>
      )}
      {examOpen && (
        <div className="overlay">
          <section className="clinical-modal exam-order">
            <button className="close" onClick={() => setExamOpen(false)}>
              <X />
            </button>
            <small>SOLICITAÇÃO DE EXAMES</small>
            <h2>O que deseja solicitar?</h2>
            <p>
              Escreva os exames como faria em uma solicitação clínica. Não serão
              exibidas sugestões durante a consulta.
            </p>
            <label>
              Pedido médico
              <textarea
                autoFocus
                value={examText}
                onChange={(e) => setExamText(e.target.value)}
                placeholder="Digite os exames solicitados..."
              />
            </label>
            <div className="exam-warning">
              <Check />
              <span>
                <b>Liberação imediata nesta simulação</b>
                <small>
                  O laudo, a tabela e a imagem disponível aparecerão diretamente na conversa.
                </small>
              </span>
            </div>
            <button
              className="primary"
              disabled={!examText.trim()}
              onClick={requestExam}
            >
              Confirmar solicitação <ChevronRight />
            </button>
          </section>
        </div>
      )}
      {notesOpen && (
        <div className="overlay">
          <section className="clinical-modal notes-modal">
            <button className="close" onClick={() => setNotesOpen(false)}><X /></button>
            <small>ANOTAÇÕES DA CONSULTA</small>
            <h2>Registre seus achados</h2>
            <p>As anotações ficam salvas neste dispositivo enquanto a consulta estiver em andamento.</p>
            <textarea
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: dispneia aos esforços, ortopneia, edema bilateral..."
            />
            <button className="primary" onClick={() => setNotesOpen(false)}>Salvar anotações <Check /></button>
          </section>
        </div>
      )}
      {phase === "finish" && (
        <div className="overlay">
          <section className="finish">
            <button className="close" onClick={() => setPhase("chat")}>
              <X />
            </button>
            <div className="finish-heading">
              <i><ClipboardCheck /></i>
              <span><small>CONCLUIR ATENDIMENTO</small><h2>Registre seu raciocínio clínico</h2><p>A avaliação só considera o que você realmente investigou e escreveu.</p></span>
            </div>
            <label>
              Hipótese principal <b>Obrigatório</b>
              <input
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="Sua principal hipótese"
              />
            </label>
            <label>
              Diagnósticos diferenciais
              <input
                value={differentials}
                onChange={(e) => setDifferentials(e.target.value)}
                placeholder="Separe por vírgulas"
              />
            </label>
            <label>
              Conduta inicial <b>Obrigatório</b>
              <textarea
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
                placeholder="O que você faria a seguir?"
              />
            </label>
            <div className="score-hint">
              <ShieldCheck />
              <span>
                <b>Nenhuma resposta, nenhuma pontuação</b>
                <small>
                  A nota exige hipótese e conduta preenchidas e usa somente evidências registradas na sessão.
                </small>
              </span>
            </div>
            <button className="primary" disabled={!hypothesis.trim() || !conduct.trim()} onClick={finishConsult}>
              Finalizar e receber avaliação <ChevronRight />
            </button>
            {(!hypothesis.trim() || !conduct.trim()) && <p className="finish-required">Preencha a hipótese principal e a conduta inicial para concluir.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
