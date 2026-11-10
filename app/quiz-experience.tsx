"use client";

import { useEffect, useRef, useState } from "react";
import { useLearningSummary, peekQueuedQuizLaunch, peekQueuedQuizView, clearQueuedQuizLaunch } from "./use-learning-summary";
import { openProUpgradeModal, openDailyLimitInfo } from "./pro-upgrade-modal";
import {
  AnswerFeedback,
  ReviewCard,
  TopicErrorTable,
  aggregateTopicStats,
  celebrate,
  letterOf,
  type AnswerFeedbackData,
  type ReviewItem,
} from "./quiz-feedback";
import "./quiz-feedback.css";
import {
  ArrowLeft,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";

type SavedError = {
  id?: number;
  questionId: string;
  topic: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
  createdAt?: number;
};
type AttemptRow = { topic?: string; topic_results?: { topic: string; total: number; correct: number }[] | null };
type PublicClinicalCase = { id: string; topic: string; title: string; prompt: string; asks: string[] };
type CaseGrade = {
  caseId: string;
  title: string;
  topic: string;
  score: number;
  items: { id: string; label: string; points: number; earned: number; status: "ok" | "partial" | "missing"; comment: string }[];
  errors: string[];
  feedback: string;
  modelAnswer: string;
  explanation: string;
};
type QuizQuestion = { id: string; topic: string; difficulty: string; text: string; options: string[] };
type QuizResult = ReviewItem & { questionId: string };
type Mode =
  | "home"
  | "quiz-config"
  | "quiz"
  | "quiz-result"
  | "exam-config"
  | "exam"
  | "exam-result"
  | "errors";

const QUIZ_TOPICS = ["Cardiovascular", "Respiratório", "Neurológico", "Abdome", "Anamnese", "Exame físico"];
const topics = ["Todos", ...QUIZ_TOPICS];
const QUIZ_AMOUNT_CHOICES = [5, 10, 20] as const;
const PASS_RATE = 70;

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}

function ScoreRing({ value, label = "pontos" }: { value: number; label?: string }) {
  const r = 52;
  const length = 2 * Math.PI * r;
  const tone = value >= PASS_RATE ? "good" : value >= 50 ? "mid" : "low";
  return (
    <div className={`qf-ring tone-${tone}`} role="img" aria-label={`${value} ${label}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="track" cx="60" cy="60" r={r} />
        <circle className="fill" cx="60" cy="60" r={r} strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0, Math.min(100, value)) / 100)} />
      </svg>
      <span>
        <b>{value}</b>
        <small>{label}</small>
      </span>
    </div>
  );
}

function ClinicalGradeCard({ index, grade, pending, answer }: { index: number; grade?: CaseGrade; pending: boolean; answer: string }) {
  const [open, setOpen] = useState(false);
  if (pending || !grade) {
    return (
      <article className="qf-case pending" aria-busy="true">
        <header>
          <b>{index + 1}</b>
          <span><small>CORRIGINDO</small><p>Analisando sua resposta...</p></span>
        </header>
        <p className="qf-skeleton"><span /><span /><span /></p>
      </article>
    );
  }
  const verdict = grade.score >= PASS_RATE ? "correct" : grade.score >= 50 ? "partial" : "wrong";
  return (
    <article className={`qf-case ${verdict} ${open ? "open" : ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <b>{index + 1}</b>
        <span>
          <small>{verdict === "correct" ? "CORRETO" : verdict === "partial" ? "PARCIAL" : "REVISAR"} · {grade.topic.toUpperCase()}</small>
          <p>{grade.title}</p>
        </span>
        <em>{grade.score}</em>
        <ChevronDown className="qf-chevron" />
      </button>
      <ul className="qf-rubric">
        {grade.items.map((item) => (
          <li key={item.id} className={item.status}>
            <i>{item.status === "ok" ? <Check /> : item.status === "partial" ? <CircleAlert /> : <X />}</i>
            <span>
              <b>{item.label}</b>
              {item.comment && <small>{item.comment}</small>}
            </span>
            <em>{item.earned}/{item.points}</em>
          </li>
        ))}
      </ul>
      {grade.errors.length > 0 && (
        <div className="qf-case-errors">
          <small><CircleAlert /> Pontos descontados por informação incorreta</small>
          <ul>{grade.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {grade.feedback && <p className="qf-case-feedback">{grade.feedback}</p>}
      {open && (
        <div className="qf-review-body">
          <p><b>Sua resposta:</b> {answer || "Sem resposta"}</p>
          <p><b>Resposta esperada:</b> {grade.modelAnswer}</p>
          <p><b>Raciocínio do caso:</b> {grade.explanation}</p>
        </div>
      )}
      {!open && <button type="button" className="qf-more" onClick={() => setOpen(true)}>Ver resposta esperada e explicação <ChevronRight /></button>}
    </article>
  );
}

export default function QuizExperience({
  go,
}: {
  go: (screen: "home" | "study" | "profile" | "quiz") => void;
}) {
  const [mode, setMode] = useState<Mode>(() => (typeof window === "undefined" ? "home" : peekQueuedQuizView() ?? "home"));
  // Veio de uma tarefa da missão diária ou de um atalho de tema: já abre
  // o treino pedido, sem passar pela tela de configuração.
  const [pendingLaunch] = useState(() => (typeof window === "undefined" ? null : peekQueuedQuizLaunch()));
  const [topic, setTopic] = useState(pendingLaunch?.topic ?? "Todos");
  const [amount, setAmount] = useState(() => {
    if (pendingLaunch) return pendingLaunch.amount;
    if (typeof window === "undefined") return 10;
    const firstQuiz = sessionStorage.getItem("semiolab:first-quiz-amount");
    if (firstQuiz) { sessionStorage.removeItem("semiolab:first-quiz-amount"); return Number(firstQuiz) || 10; }
    return 10;
  });
  const [active, setActive] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<AnswerFeedbackData | null>(null);
  const [quizChecking, setQuizChecking] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizStartLoading, setQuizStartLoading] = useState(false);
  const { summary: learning } = useLearningSummary();
  const [savedErrors, setSavedErrors] = useState<SavedError[]>([]);
  const [attemptRows, setAttemptRows] = useState<AttemptRow[]>([]);
  const [simuladoMode, setSimuladoMode] = useState<"config" | "play" | "result" | "blocked" | "insufficient">("config");
  const [simuladoAttemptId, setSimuladoAttemptId] = useState<string | null>(null);
  const [simuladoQuestions, setSimuladoQuestions] = useState<{ id: string; topic: string; text: string; options: string[]; answered?: boolean }[]>([]);
  const [simuladoIndex, setSimuladoIndex] = useState(0);
  const [simuladoSelected, setSimuladoSelected] = useState<number | null>(null);
  const [simuladoChecking, setSimuladoChecking] = useState(false);
  const [simuladoFeedback, setSimuladoFeedback] = useState<(AnswerFeedbackData & { correctIndex: number }) | null>(null);
  const [simuladoReview, setSimuladoReview] = useState<QuizResult[]>([]);
  const [simuladoResult, setSimuladoResult] = useState<{ total: number; correct: number; score: number } | null>(null);
  const [simuladoBlocked, setSimuladoBlocked] = useState<{ message: string; usedToday?: number; limitToday?: number; available?: number } | null>(null);
  const [simuladoLoading, setSimuladoLoading] = useState(false);
  const [clinicalCases, setClinicalCases] = useState<PublicClinicalCase[]>([]);
  const [clinicalLoading, setClinicalLoading] = useState(false);
  const [clinicalError, setClinicalError] = useState("");
  const [caseIndex, setCaseIndex] = useState(0);
  const [caseAnswers, setCaseAnswers] = useState<string[]>([]);
  const [caseGrades, setCaseGrades] = useState<Record<string, CaseGrade>>({});
  const [caseText, setCaseText] = useState("");
  const [examSeconds, setExamSeconds] = useState(900);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const examSavedRef = useRef(false);
  const celebratedRef = useRef<string | null>(null);
  const examLiveRef = useRef({ index: 0, text: "", answers: [] as string[], cases: [] as PublicClinicalCase[] });
  useEffect(() => {
    examLiveRef.current = { index: caseIndex, text: caseText, answers: caseAnswers, cases: clinicalCases };
  });

  useEffect(() => {
    fetch("/api/learning")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSavedErrors(data.errors || []);
          setAttemptRows(data.attempts || []);
        }
      })
      .catch(() => {});
    // Quantidade real de questões publicadas por tema — nunca inventada,
    // vem do banco global (Quiz + Simulados compartilham o mesmo estoque).
    fetch("/api/quiz/topics")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setTopicCounts(data.byTopic || {}); })
      .catch(() => {});
    clearQueuedQuizLaunch();
    if (pendingLaunch) startQuiz(pendingLaunch.topic, pendingLaunch.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const maxAmount = Math.min(20, topic === "Todos" ? Object.values(topicCounts).reduce((a, b) => a + b, 0) : topicCounts[topic] ?? 0);
  const quizScore = quizResults.filter((r) => r.correct).length;
  const quizPct = active.length ? Math.round((quizScore / active.length) * 100) : 0;
  const topicStats = aggregateTopicStats(attemptRows);

  // Simulado clínico: nota = média dos casos já corrigidos.
  const gradedList = clinicalCases.map((c) => caseGrades[c.id]).filter(Boolean) as CaseGrade[];
  const allCasesGraded = clinicalCases.length > 0 && gradedList.length === clinicalCases.length;
  const caseScore = gradedList.length ? Math.round(gradedList.reduce((s, g) => s + g.score, 0) / gradedList.length) : 0;

  // Confete ao fim de qualquer atividade com aproveitamento ≥ 70%.
  useEffect(() => {
    let key: string | null = null;
    if (mode === "quiz-result" && active.length && quizResults.length === active.length && quizPct >= PASS_RATE) key = `quiz-${active[0]?.id}`;
    if (mode === "exam-result" && allCasesGraded && caseScore >= PASS_RATE) key = `exam-${clinicalCases[0]?.id}`;
    if (simuladoMode === "result" && simuladoResult && simuladoResult.score >= PASS_RATE) key = `sim-${simuladoAttemptId}`;
    if (key && celebratedRef.current !== key) {
      celebratedRef.current = key;
      celebrate();
    }
  }, [mode, simuladoMode, quizPct, quizResults.length, active, allCasesGraded, caseScore, clinicalCases, simuladoResult, simuladoAttemptId]);

  // Grava o resultado do simulado clínico uma vez, quando tudo foi corrigido.
  useEffect(() => {
    if (mode !== "exam-result" || !allCasesGraded || examSavedRef.current) return;
    examSavedRef.current = true;
    const topicResults = gradedList.map((g) => ({ topic: g.topic, total: 1, correct: g.score >= PASS_RATE ? 1 : 0 }));
    setAttemptRows((rows) => [{ topic: "Simulado clínico", topic_results: topicResults }, ...rows]);
    fetch("/api/learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "quiz_result",
        topic: "Simulado clínico",
        total: gradedList.length,
        correct: topicResults.reduce((sum, item) => sum + item.correct, 0),
        topicResults,
        errors: [],
      }),
    })
      .then((response) => { if (response.ok) window.dispatchEvent(new Event("semiolab:learning-updated")); })
      .catch(() => {});
  }, [mode, allCasesGraded, gradedList]);

  useEffect(() => {
    if (mode !== "exam") return;
    const id = window.setInterval(
      () =>
        setExamSeconds((value) => {
          if (value <= 1) {
            window.clearInterval(id);
            finishExam();
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* ─── Simulado objetivo ─── */
  async function startSimulado() {
    setSimuladoLoading(true);
    setSimuladoFeedback(null);
    try {
      const { ok, status, data } = await postJson<{
        error?: string; limitReached?: boolean; code?: string; simuladosUsedToday?: number; simuladosLimitToday?: number;
        availableQuestions?: number; attemptId?: string; questions?: { id: string; topic: string; text: string; options: string[]; answered?: boolean }[];
      }>("/api/simulados/start", {});
      if (status === 403 && data.limitReached) {
        setSimuladoBlocked({ message: data.error || "", usedToday: data.simuladosUsedToday, limitToday: data.simuladosLimitToday });
        setSimuladoMode("blocked");
        if (learning?.pro?.tier === "pro") openDailyLimitInfo();
        else openProUpgradeModal(learning?.pro?.tier === "free" ? "simulado" : "limit");
        return;
      }
      if (status === 409 && data.code === "INSUFFICIENT_QUESTION_BANK") {
        setSimuladoBlocked({ message: data.error || "", available: data.availableQuestions });
        setSimuladoMode("insufficient");
        return;
      }
      if (!ok) {
        setSimuladoBlocked({ message: data.error || "Não foi possível iniciar o simulado." });
        setSimuladoMode("blocked");
        return;
      }
      setSimuladoAttemptId(data.attemptId ?? null);
      setSimuladoQuestions(data.questions || []);
      const firstUnanswered = (data.questions || []).findIndex((q) => !q.answered);
      setSimuladoIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
      setSimuladoSelected(null);
      setSimuladoReview([]);
      setSimuladoResult(null);
      setSimuladoMode("play");
    } finally {
      setSimuladoLoading(false);
    }
  }

  async function answerSimulado() {
    if (simuladoSelected === null || !simuladoAttemptId || simuladoChecking) return;
    const question = simuladoQuestions[simuladoIndex];
    const chosen = simuladoSelected;
    setSimuladoChecking(true);
    try {
      const { ok, data } = await postJson<{ correct: boolean; correctIndex: number; correctText: string; explanation: string; correctWhy: string | null; whyWrong: string | null }>(
        "/api/simulados/answer",
        { attemptId: simuladoAttemptId, questionId: question.id, selectedIndex: chosen },
      );
      if (!ok) return;
      const needsWhy = !data.correct && !data.whyWrong;
      setSimuladoFeedback({ ...data, whyLoading: needsWhy });
      const review: QuizResult = {
        id: question.id,
        questionId: question.id,
        index: simuladoIndex,
        topic: question.topic,
        text: question.text,
        correct: data.correct,
        selectedText: question.options[chosen] ?? "",
        correctText: data.correctText,
        explanation: data.explanation,
        correctWhy: data.correctWhy,
        whyWrong: data.whyWrong,
      };
      setSimuladoReview((rows) => [...rows.filter((r) => r.id !== question.id), review]);
      if (needsWhy) {
        postJson<{ whyWrong: string | null }>("/api/quiz/why-wrong", { questionId: question.id, selectedText: question.options[chosen] })
          .then(({ data: why }) => {
            setSimuladoFeedback((f) => (f && f.correctText === data.correctText ? { ...f, whyWrong: why.whyWrong, whyLoading: false } : f));
            setSimuladoReview((rows) => rows.map((r) => (r.id === question.id ? { ...r, whyWrong: why.whyWrong } : r)));
          })
          .catch(() => setSimuladoFeedback((f) => (f ? { ...f, whyLoading: false } : f)));
      }
    } finally {
      setSimuladoChecking(false);
    }
  }

  function nextSimuladoQuestion() {
    if (simuladoIndex + 1 < simuladoQuestions.length) {
      setSimuladoIndex((i) => i + 1);
      setSimuladoSelected(null);
      setSimuladoFeedback(null);
      return;
    }
    if (!simuladoAttemptId) return;
    // Resultado na hora, calculado com as correções que o aluno já viu; a
    // confirmação do servidor chega em seguida e substitui se diferir
    // (ex.: tentativa retomada com questões respondidas em outra sessão).
    const total = simuladoQuestions.length;
    const correct = simuladoReview.filter((r) => r.correct).length;
    setSimuladoResult({ total, correct, score: total ? Math.round((correct / total) * 100) : 0 });
    setSimuladoMode("result");
    postJson<{ total: number; correct: number; score: number }>("/api/simulados/finish", { attemptId: simuladoAttemptId })
      .then(({ ok, data }) => {
        if (ok) setSimuladoResult({ total: data.total, correct: data.correct, score: data.score });
        window.dispatchEvent(new Event("semiolab:learning-updated"));
      })
      .catch(() => {});
  }

  /* ─── Quiz rápido ─── */
  async function startQuiz(overrideTopic?: string, overrideAmount?: number) {
    const effectiveTopic = overrideTopic ?? topic;
    const effectiveAmount = overrideAmount ?? amount;
    setQuizStartLoading(true);
    try {
      const { ok, data } = await postJson<{ questions?: QuizQuestion[] }>("/api/quiz/questions", { topic: effectiveTopic, amount: effectiveAmount });
      if (!ok || !data.questions?.length) return;
      setActive(data.questions);
      setCurrent(0);
      setSelected(null);
      setQuizFeedback(null);
      setQuizResults([]);
      setMode("quiz");
    } finally {
      setQuizStartLoading(false);
    }
  }

  async function checkQuizAnswer() {
    if (selected === null || quizChecking || quizFeedback) return;
    const question = active[current];
    const selectedText = question.options[selected];
    setQuizChecking(true);
    try {
      const { ok, data } = await postJson<{ correct: boolean; correctText: string; explanation: string; correctWhy: string | null; whyWrong: string | null }>(
        "/api/quiz/check",
        { questionId: question.id, selectedText },
      );
      if (!ok) return;
      const needsWhy = !data.correct && !data.whyWrong;
      setQuizFeedback({ ...data, whyLoading: needsWhy });
      const result: QuizResult = {
        id: question.id,
        questionId: question.id,
        index: current,
        topic: question.topic,
        text: question.text,
        correct: data.correct,
        selectedText,
        correctText: data.correctText,
        explanation: data.explanation,
        correctWhy: data.correctWhy,
        whyWrong: data.whyWrong,
      };
      setQuizResults((rows) => [...rows.filter((r) => r.id !== question.id), result]);
      if (needsWhy) {
        postJson<{ whyWrong: string | null }>("/api/quiz/why-wrong", { questionId: question.id, selectedText })
          .then(({ data: why }) => {
            setQuizFeedback((f) => (f && f.correctText === data.correctText ? { ...f, whyWrong: why.whyWrong, whyLoading: false } : f));
            setQuizResults((rows) => rows.map((r) => (r.id === question.id ? { ...r, whyWrong: why.whyWrong } : r)));
          })
          .catch(() => setQuizFeedback((f) => (f ? { ...f, whyLoading: false } : f)));
      }
    } finally {
      setQuizChecking(false);
    }
  }

  function nextQuizQuestion() {
    if (current < active.length - 1) {
      setCurrent((v) => v + 1);
      setSelected(null);
      setQuizFeedback(null);
      return;
    }
    finishQuiz();
  }

  function finishQuiz() {
    // O resumo aparece na hora (todas as correções já foram feitas questão
    // a questão); a gravação (XP, caderno de erros, temas) roda por trás.
    setMode("quiz-result");
    const wrong = quizResults.filter((r) => !r.correct);
    setSavedErrors((old) => [
      ...wrong.map((r) => ({ questionId: r.questionId, topic: r.topic, question: r.text, selectedAnswer: r.selectedText, correctAnswer: r.correctText, explanation: r.explanation })),
      ...old,
    ]);
    const byTopic = new Map<string, { topic: string; total: number; correct: number }>();
    for (const r of quizResults) {
      const t = byTopic.get(r.topic) ?? { topic: r.topic, total: 0, correct: 0 };
      t.total += 1;
      if (r.correct) t.correct += 1;
      byTopic.set(r.topic, t);
    }
    setAttemptRows((rows) => [{ topic, topic_results: [...byTopic.values()] }, ...rows]);
    postJson("/api/quiz/submit", {
      topic,
      answers: quizResults.map((r) => ({ questionId: r.questionId, selectedText: r.selectedText })),
    })
      .then(({ ok }) => { if (ok) window.dispatchEvent(new Event("semiolab:learning-updated")); })
      .catch(() => {});
  }

  /* ─── Simulado clínico ─── */
  async function startExam() {
    setClinicalLoading(true);
    setClinicalError("");
    try {
      const { ok, data } = await postJson<{ cases?: PublicClinicalCase[]; error?: string }>("/api/clinical/start", {});
      if (!ok || !data.cases?.length) {
        setClinicalError(data.error || "Não foi possível montar o simulado agora. Tente de novo.");
        return;
      }
      setClinicalCases(data.cases);
      setCaseIndex(0);
      setCaseAnswers([]);
      setCaseGrades({});
      setCaseText("");
      setExamSeconds(900);
      examSavedRef.current = false;
      setMode("exam");
    } finally {
      setClinicalLoading(false);
    }
  }

  function gradeInBackground(c: PublicClinicalCase, answer: string) {
    postJson<CaseGrade>("/api/clinical/grade", { caseId: c.id, answer })
      .then(({ ok, data }) => {
        const grade: CaseGrade = ok
          ? data
          : { caseId: c.id, title: c.title, topic: c.topic, score: 0, items: [], errors: [], feedback: "Não foi possível corrigir este caso agora.", modelAnswer: "", explanation: "" };
        setCaseGrades((g) => ({ ...g, [c.id]: grade }));
      })
      .catch(() =>
        setCaseGrades((g) => ({ ...g, [c.id]: { caseId: c.id, title: c.title, topic: c.topic, score: 0, items: [], errors: [], feedback: "Sem conexão para corrigir este caso.", modelAnswer: "", explanation: "" } })),
      );
  }

  function nextCase() {
    const c = clinicalCases[caseIndex];
    const next = [...caseAnswers];
    next[caseIndex] = caseText;
    setCaseAnswers(next);
    // A correção começa já, enquanto o aluno lê o próximo caso.
    gradeInBackground(c, caseText);
    setCaseText("");
    if (caseIndex === clinicalCases.length - 1) setMode("exam-result");
    else setCaseIndex((v) => v + 1);
  }

  // Tempo esgotado: chamado de dentro do intervalo do cronômetro, então lê
  // o estado mais recente pelos refs (o closure do intervalo é antigo).
  function finishExam() {
    const { index, text, answers, cases } = examLiveRef.current;
    const completed = [...answers];
    completed[index] = text;
    cases.forEach((c, i) => {
      if (i >= index) gradeInBackground(c, completed[i] || "");
    });
    setCaseAnswers(completed);
    setMode("exam-result");
  }

  /* ─── Telas ─── */
  if (simuladoMode === "blocked" && simuladoBlocked) {
    return (
      <div className="page auscultation-lab-page patient-wait">
        <div className="patient-wait-shade" />
        <main className="patient-wait-content">
          <section className="patient-wait-intro">
            <small><i /> RECURSO POR PLANO</small>
            <h1>{simuladoBlocked.message}</h1>
            {typeof simuladoBlocked.usedToday === "number" && (
              <p>{simuladoBlocked.usedToday} de {simuladoBlocked.limitToday} simulados usados hoje.</p>
            )}
          </section>
          <section className="patient-call-panel">
            {learning?.pro?.checkoutUrls && <a className="primary" href={learning.pro.checkoutUrls.monthly} target="_blank" rel="noopener noreferrer"><span>Assinar mensal</span></a>}
            {learning?.pro?.checkoutUrls && <a className="primary" href={learning.pro.checkoutUrls.annual} target="_blank" rel="noopener noreferrer"><span>Assinar anual</span></a>}
            <button onClick={() => { setMode("home"); setSimuladoMode("config"); }}>Voltar</button>
          </section>
        </main>
      </div>
    );
  }
  if (simuladoMode === "insufficient" && simuladoBlocked) {
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => { setMode("home"); setSimuladoMode("config"); }}><ArrowLeft /></button>
          <span><small>SIMULADO</small><b>Banco insuficiente</b></span>
        </header>
        <div className="quiz-config">
          <h1>Ainda não há questões novas suficientes.</h1>
          <p>{simuladoBlocked.available ?? 0} de 10 questões inéditas disponíveis para você no momento. Volte em breve, quando o banco for ampliado.</p>
        </div>
      </div>
    );
  }
  if (simuladoMode === "play" && simuladoAttemptId && simuladoQuestions[simuladoIndex]) {
    const q = simuladoQuestions[simuladoIndex];
    return (
      <div className="quiz-ui quiz-play">
        <header>
          <button onClick={() => { setMode("home"); setSimuladoMode("config"); }}><X /></button>
          <span>
            Questão {simuladoIndex + 1} de {simuladoQuestions.length}
            <i><b style={{ width: `${((simuladoIndex + 1) / simuladoQuestions.length) * 100}%` }} /></i>
          </span>
        </header>
        <main key={q.id}>
          <small>{q.topic.toUpperCase()} · SIMULADO</small>
          <h1>{q.text}</h1>
          <div className={`qf-options ${simuladoFeedback ? "revealed" : ""}`}>
            {q.options.map((option, i) => {
              const state = simuladoFeedback
                ? i === simuladoFeedback.correctIndex ? "correct" : simuladoSelected === i ? "wrong" : "dim"
                : simuladoSelected === i ? (simuladoChecking ? "selected checking" : "selected") : "";
              return (
                <button key={option} className={state} disabled={!!simuladoFeedback || simuladoChecking} onClick={() => setSimuladoSelected(i)}>
                  <i>{simuladoFeedback && i === simuladoFeedback.correctIndex ? <Check /> : simuladoFeedback && simuladoSelected === i ? <X /> : letterOf(i)}</i>
                  {option}
                </button>
              );
            })}
          </div>
          {simuladoFeedback && simuladoSelected !== null && (
            <AnswerFeedback data={simuladoFeedback} selectedLetter={letterOf(simuladoSelected)} correctLetter={letterOf(simuladoFeedback.correctIndex)} />
          )}
          <footer>
            <button onClick={() => { setMode("home"); setSimuladoMode("config"); }}>Encerrar</button>
            {!simuladoFeedback ? (
              <button className="primary" disabled={simuladoSelected === null || simuladoChecking} onClick={answerSimulado}>
                {simuladoChecking ? "Corrigindo..." : "Responder"} <ChevronRight />
              </button>
            ) : (
              <button className="primary" onClick={nextSimuladoQuestion}>
                {simuladoIndex + 1 === simuladoQuestions.length ? "Ver resultado" : "Próxima"} <ChevronRight />
              </button>
            )}
          </footer>
        </main>
      </div>
    );
  }
  if (simuladoMode === "result" && simuladoResult) {
    const wrongCount = simuladoResult.total - simuladoResult.correct;
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => { setMode("home"); setSimuladoMode("config"); }}><ArrowLeft /></button>
          <span><small>RESULTADO</small><b>Simulado concluído</b></span>
        </header>
        <div className="quiz-result qf-result">
          <ScoreRing value={simuladoResult.score} label="de 100" />
          <h1>{simuladoResult.score >= PASS_RATE ? "Mandou bem! Simulado aprovado." : "Simulado concluído. Revise os pontos de atenção."}</h1>
          <p>Você acertou {simuladoResult.correct} de {simuladoResult.total}{wrongCount ? ` e errou ${wrongCount}` : ""}. Toque em uma questão para ver a explicação completa.</p>
          <div className="qf-review-list">
            {[...simuladoReview].sort((a, b) => a.index - b.index).map((item) => <ReviewCard key={item.id} item={item} />)}
          </div>
          {simuladoAttemptId && (
            <a className="smart-review-cta" href={`/revisao-inteligente/${simuladoAttemptId}`}>
              <i><Sparkles /></i>
              <span>
                <b>{simuladoResult.correct === simuladoResult.total ? "Ver minha revisão de desempenho" : "Revisar meus erros"}</b>
                <small>
                  {simuladoResult.correct === simuladoResult.total
                    ? "Veja seu desempenho por assunto e o próximo passo recomendado."
                    : "Transforme seus erros deste simulado em uma revisão visual personalizada."}
                </small>
              </span>
              <ChevronRight />
            </a>
          )}
          <button className="primary" onClick={() => { setMode("home"); setSimuladoMode("config"); }}>Voltar ao início <ChevronRight /></button>
        </div>
      </div>
    );
  }
  if (mode === "quiz" && active[current]) {
    const question = active[current];
    const correctIndex = quizFeedback ? question.options.indexOf(quizFeedback.correctText) : -1;
    return (
      <div className="quiz-ui quiz-play">
        <header>
          <button onClick={() => setMode("home")}>
            <X />
          </button>
          <span>
            Questão {current + 1} de {active.length}
            <i>
              <b style={{ width: `${((current + 1) / active.length) * 100}%` }} />
            </i>
          </span>
        </header>
        <main key={question.id}>
          <small>{question.topic.toUpperCase()} · QUIZ RÁPIDO</small>
          <h1>{question.text}</h1>
          <div className={`qf-options ${quizFeedback ? "revealed" : ""}`}>
            {question.options.map((option, i) => {
              const state = quizFeedback
                ? i === correctIndex ? "correct" : selected === i ? "wrong" : "dim"
                : selected === i ? (quizChecking ? "selected checking" : "selected") : "";
              return (
                <button key={option} className={state} disabled={!!quizFeedback || quizChecking} onClick={() => setSelected(i)}>
                  <i>{quizFeedback && i === correctIndex ? <Check /> : quizFeedback && selected === i ? <X /> : letterOf(i)}</i>
                  {option}
                </button>
              );
            })}
          </div>
          {quizFeedback && selected !== null && (
            <AnswerFeedback data={quizFeedback} selectedLetter={letterOf(selected)} correctLetter={letterOf(correctIndex)} />
          )}
          <footer>
            <button onClick={() => setMode("home")}>Encerrar quiz</button>
            {!quizFeedback ? (
              <button className="primary" disabled={selected === null || quizChecking} onClick={checkQuizAnswer}>
                {quizChecking ? "Corrigindo..." : "Responder"} <ChevronRight />
              </button>
            ) : (
              <button className="primary" onClick={nextQuizQuestion}>
                {current === active.length - 1 ? "Ver resumo" : "Próxima"} <ChevronRight />
              </button>
            )}
          </footer>
        </main>
      </div>
    );
  }
  if (mode === "quiz-result") {
    const thisQuizStats = aggregateTopicStats([
      {
        topic_results: [...new Set(quizResults.map((r) => r.topic))].map((t) => ({
          topic: t,
          total: quizResults.filter((r) => r.topic === t).length,
          correct: quizResults.filter((r) => r.topic === t && r.correct).length,
        })),
      },
    ]);
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}>
            <ArrowLeft />
          </button>
          <span>
            <small>RESUMO DO QUIZ</small>
            <b>{topic}</b>
          </span>
        </header>
        <div className="quiz-result qf-result">
          <ScoreRing value={quizPct} />
          <h1>
            {quizScore === active.length
              ? "Excelente. Você acertou tudo."
              : quizPct >= PASS_RATE
                ? "Muito bom! Você passou dos 70%."
                : "Quiz concluído. Revise os pontos de atenção."}
          </h1>
          <p>
            Você acertou {quizScore} de {active.length}. {quizScore < active.length ? "Os erros foram para o seu caderno. " : ""}Toque em uma questão para ver a explicação completa.
          </p>
          {thisQuizStats.length > 1 && <TopicErrorTable stats={thisQuizStats} title="Seus erros neste quiz" />}
          <div className="qf-review-list">
            {[...quizResults].sort((a, b) => a.index - b.index).map((item) => <ReviewCard key={item.id} item={item} />)}
          </div>
          <div className="result-actions">
            <button onClick={() => setMode("errors")}>
              Abrir caderno de erros
            </button>
            <button className="primary" onClick={() => setMode("quiz-config")}>
              Novo quiz
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (mode === "exam" && clinicalCases[caseIndex]) {
    const item = clinicalCases[caseIndex],
      minutes = Math.floor(examSeconds / 60),
      secs = String(examSeconds % 60).padStart(2, "0");
    return (
      <div className="quiz-ui clinical-exam">
        <header>
          <button onClick={() => setMode("home")}>
            <X />
          </button>
          <span>
            <small>SIMULADO CLÍNICO</small>
            <b>
              Caso {caseIndex + 1} de {clinicalCases.length}
            </b>
          </span>
          <em className={examSeconds < 60 ? "timer-danger" : ""}>
            <Clock3 /> {minutes}:{secs}
          </em>
        </header>
        <main key={item.id}>
          <small>{item.topic.toUpperCase()}</small>
          <h1>{item.title}</h1>
          <p>{item.prompt}</p>
          {item.asks.length > 0 && (
            <ul className="qf-asks" aria-label="O que sua resposta precisa conter">
              {item.asks.map((ask) => <li key={ask}><Check /> {ask}</li>)}
            </ul>
          )}
          <label>
            Sua resposta clínica
            <textarea
              autoFocus
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              placeholder="Responda tudo o que o caso pede. Justifique seu raciocínio..."
            />
          </label>
          <div className="exam-note">
            <FileText />
            <span>
              <b>Resposta discursiva</b>
              <small>
                Você só perde pontos se errar ou se deixar de responder algo que o caso pediu. Sinônimos e outras palavras valem.
              </small>
            </span>
          </div>
          <button
            className="primary"
            disabled={caseText.trim().length < 30}
            onClick={nextCase}
          >
            {caseIndex === clinicalCases.length - 1
              ? "Finalizar simulado"
              : "Salvar e abrir próximo caso"}
            <ChevronRight />
          </button>
        </main>
      </div>
    );
  }
  if (mode === "exam-result") {
    const correctCases = gradedList.filter((g) => g.score >= PASS_RATE).length;
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}>
            <ArrowLeft />
          </button>
          <span>
            <small>RESULTADO</small>
            <b>Simulado clínico discursivo</b>
          </span>
        </header>
        <div className="quiz-result clinical-result qf-result">
          {allCasesGraded ? <ScoreRing value={caseScore} /> : <div className="qf-ring pending" aria-busy="true"><span><b>…</b><small>corrigindo</small></span></div>}
          <h1>{allCasesGraded ? (caseScore >= PASS_RATE ? "Raciocínio clínico aprovado!" : "Avaliação do raciocínio clínico") : "Corrigindo seus casos..."}</h1>
          <p>
            {allCasesGraded
              ? `${correctCases} de ${clinicalCases.length} casos corretos. A nota de cada caso só desconta o que faltou do que foi pedido ou o que estava errado.`
              : "Os casos aparecem aqui assim que são corrigidos."}
          </p>
          <div className="qf-case-list">
            {clinicalCases.map((c, i) => (
              <ClinicalGradeCard key={c.id} index={i} grade={caseGrades[c.id]} pending={!caseGrades[c.id]} answer={caseAnswers[i] || ""} />
            ))}
          </div>
          <button className="primary" onClick={() => setMode("exam-config")}>
            Fazer outro simulado
          </button>
        </div>
      </div>
    );
  }
  if (mode === "errors")
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}>
            <ArrowLeft />
          </button>
          <span>
            <small>REVISÃO ATIVA</small>
            <b>Caderno de erros</b>
          </span>
        </header>
        <div className="error-notebook">
          <header>
            <span>
              <small>HISTÓRICO REAL</small>
              <h1>Seus erros de quiz ficam aqui.</h1>
              <p>As questões são registradas a cada tentativa concluída.</p>
            </span>
            <i>{savedErrors.length}</i>
          </header>
          <TopicErrorTable stats={topicStats} />
          <div>
            {savedErrors.length ? (
              savedErrors.map((error, index) => (
                <article key={`${error.questionId}-${error.id || index}`}>
                  <small>{error.topic.toUpperCase()}</small>
                  <h3>{error.question}</h3>
                  <p>Sua resposta: {error.selectedAnswer}</p>
                  <p className="right">Correta: {error.correctAnswer}</p>
                  <em>{error.explanation}</em>
                </article>
              ))
            ) : (
              <div className="empty-errors">
                <Check />
                <h3>Nenhum erro registrado</h3>
                <p>Conclua um quiz para começar seu caderno.</p>
                <button onClick={() => setMode("quiz-config")}>
                  Criar primeiro quiz <ChevronRight />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  if (mode === "quiz-config")
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}>
            <ArrowLeft />
          </button>
          <span>
            <small>CONFIGURAÇÃO</small>
            <b>Quiz rápido</b>
          </span>
        </header>
        <div className="quiz-config">
          <small>QUESTÕES OBJETIVAS</small>
          <h1>Monte seu quiz.</h1>
          <p>
            Múltipla escolha, sem limite de tempo. A correção aparece logo depois de cada resposta, com a explicação.
          </p>
          <label>
            Tema
            <select
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setAmount(10);
              }}
            >
              {topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Quantidade
            <div className="amount-control amount-choices">
              {QUIZ_AMOUNT_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={amount === choice ? "active" : ""}
                  disabled={choice > maxAmount}
                  onClick={() => setAmount(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
            <small>
              {maxAmount >= 20
                ? "20 questões disponíveis neste tema"
                : `Apenas ${maxAmount} questão${maxAmount === 1 ? "" : "ões"} disponível${maxAmount === 1 ? "" : "eis"} neste tema até o banco ser ampliado`}
            </small>
          </label>
          <div className="config-summary">
            <Zap />
            <span>
              <b>{topic}</b>
              <small>
                {Math.min(amount, maxAmount)} questões · sem limite de tempo
              </small>
            </span>
          </div>
          <button className="primary" onClick={() => startQuiz()} disabled={maxAmount === 0 || quizStartLoading}>
            {quizStartLoading ? "Carregando..." : "Começar quiz"} <ChevronRight />
          </button>
        </div>
      </div>
    );
  if (mode === "exam-config")
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}>
            <ArrowLeft />
          </button>
          <span>
            <small>CONFIGURAÇÃO</small>
            <b>Simulado clínico</b>
          </span>
        </header>
        <div className="quiz-config">
          <small>CASOS DISCURSIVOS</small>
          <h1>Treine decisões clínicas completas.</h1>
          <p>
            Três casos sorteados para você, campo livre para resposta e 15 minutos no total. A cada simulado os casos mudam.
          </p>
          <div className="config-summary">
            <Clock3 />
            <span>
              <b>15 minutos</b>
              <small>3 casos · resposta aberta · correção por critério</small>
            </span>
          </div>
          {clinicalError && <p role="alert" className="qf-alert">{clinicalError}</p>}
          <button className="primary" onClick={startExam} disabled={clinicalLoading}>
            {clinicalLoading ? "Sorteando casos..." : "Iniciar simulado clínico"} <ChevronRight />
          </button>
        </div>
      </div>
    );
  const formats = [
    {
      id: "quiz",
      tone: "teal",
      icon: Zap,
      kicker: "Quiz rápido",
      title: "Objetivo e visual",
      text: "Questões rápidas com correção comentada logo após cada resposta.",
      chips: ["Sem tempo", "5–20 questões", "Feedback na hora"],
      cta: "Iniciar",
      disabled: false,
      onClick: () => setMode("quiz-config"),
    },
    {
      id: "exam",
      tone: "blue",
      icon: ClipboardCheck,
      kicker: "Simulado clínico",
      title: "Raciocínio completo",
      text: "Casos extensos com tempo total e correção detalhada por critério.",
      chips: ["15 min", "3 casos", "Casos sempre novos"],
      cta: "Configurar",
      disabled: false,
      onClick: () => setMode("exam-config"),
    },
    {
      id: "simulado",
      tone: "violet",
      icon: Target,
      kicker: "Simulado objetivo",
      title: "10 questões inéditas",
      text: "Questões fixas, sem repetição, que você pode retomar se sair no meio.",
      chips: ["10 questões", "Nunca repete", "Retomável"],
      cta: simuladoLoading ? "Carregando…" : "Iniciar",
      disabled: simuladoLoading,
      onClick: () => { setSimuladoMode("config"); startSimulado(); },
    },
  ];
  return (
    <div className="page quiz-ui qh-page">
      <section className="hd-band qh-band">
        <header className="qh-band-top">
          <button className="qh-back" onClick={() => go("home")} aria-label="Voltar para o início">
            <ArrowLeft />
          </button>
          <span>
            <small>Prática e avaliação</small>
            <h1>Quiz e simulados</h1>
          </span>
        </header>
        <p className="qh-band-lead">Treine decisões e evolua na prática — da revisão rápida ao caso clínico completo.</p>
        <div className="qh-band-stats">
          <div>
            <b>{attemptRows.length}</b>
            <small>Atividades concluídas</small>
          </div>
          <button type="button" onClick={() => setMode("errors")}>
            <b>{savedErrors.length}</b>
            <small>Erros para revisar <ChevronRight /></small>
          </button>
        </div>
      </section>

      <div className="hd-sheet qh-sheet">
        <header className="qh-section-head">
          <small>Escolha o formato</small>
          <h2>Como você quer treinar hoje?</h2>
        </header>
        <div className="qh-list">
          {formats.map((format) => (
            <button key={format.id} type="button" className={`qh-row tone-${format.tone}`} disabled={format.disabled} onClick={format.onClick}>
              <i className="qh-row-icon"><format.icon /></i>
              <span className="qh-row-copy">
                <small>{format.kicker}</small>
                <b>{format.title}</b>
                <span>{format.text}</span>
                <span className="qh-chips">{format.chips.map((chip) => <em key={chip}>{chip}</em>)}</span>
              </span>
              <span className="qh-row-cta">{format.cta} <ChevronRight /></span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="qh-row qh-mixed tone-amber"
          onClick={() => {
            setTopic("Todos");
            setAmount(10);
            startQuiz("Todos", 10);
          }}
        >
          <i className="qh-row-icon"><Sparkles /></i>
          <span className="qh-row-copy">
            <small>Atalho</small>
            <b>Treino misto</b>
            <span>10 questões variadas de todos os temas de Semiologia.</span>
          </span>
          <span className="qh-row-cta">Começar <ChevronRight /></span>
        </button>

        <TopicErrorTable stats={topicStats} />

        <button type="button" className="qh-errors-link" onClick={() => setMode("errors")}>
          <BookOpenText />
          <span><b>Caderno de erros</b><small>{savedErrors.length ? `${savedErrors.length} ${savedErrors.length === 1 ? "questão salva" : "questões salvas"} para revisar` : "Suas questões erradas aparecem aqui"}</small></span>
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
