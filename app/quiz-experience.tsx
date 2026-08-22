"use client";

import { useEffect, useMemo, useState } from "react";
import { useLearningSummary } from "./use-learning-summary";
import {
  ArrowLeft,
  BarChart3,
  BookOpenText,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  ImageIcon,
  Target,
  X,
  Zap,
} from "lucide-react";

type Question = {
  id: string;
  topic: string;
  text: string;
  options: string[];
  correct: number;
  why: string;
  image?: string;
};
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
type ClinicalCase = {
  id: string;
  topic: string;
  title: string;
  prompt: string;
  expected: string[];
  explanation: string;
};
type Mode =
  | "home"
  | "quiz-config"
  | "quiz"
  | "quiz-result"
  | "exam-config"
  | "exam"
  | "exam-result"
  | "errors";

const bank: Question[] = [
  {
    id: "cv1",
    topic: "Cardiovascular",
    text: "Na estenose mitral, qual achado é mais característico à ausculta?",
    options: [
      "Sopro sistólico ejetivo",
      "Ruflar diastólico em foco mitral",
      "Sopro contínuo",
      "Atrito pericárdico",
    ],
    correct: 1,
    why: "O fluxo turbulento através da valva mitral estreitada produz ruflar diastólico no foco mitral.",
  },
  {
    id: "cv2",
    topic: "Cardiovascular",
    text: "Turgência jugular observada a 45° sugere:",
    options: [
      "Hipovolemia",
      "Pressão venosa central elevada",
      "Anemia",
      "Vasodilatação periférica",
    ],
    correct: 1,
    why: "A altura da coluna venosa jugular estima a pressão do átrio direito.",
  },
  {
    id: "cv3",
    topic: "Cardiovascular",
    text: "Qual achado predomina nesta tomografia?",
    options: [
      "Derrame pleural maciço",
      "Calcificação pericárdica",
      "Pneumotórax bilateral",
      "Aneurisma de aorta roto",
    ],
    correct: 1,
    why: "Há calcificação extensa acompanhando o contorno pericárdico, achado que pode ocorrer na pericardite constritiva.",
    image: "/exame-tc-pericardio.png",
  },
  {
    id: "rp1",
    topic: "Respiratório",
    text: "Macicez à percussão e murmúrio vesicular reduzido sugerem:",
    options: ["Pneumotórax", "Asma", "Derrame pleural", "Bronquite"],
    correct: 2,
    why: "O líquido pleural reduz a transmissão sonora e produz macicez.",
  },
  {
    id: "rp2",
    topic: "Respiratório",
    text: "Frêmito toracovocal aumentado ocorre mais frequentemente em:",
    options: [
      "Derrame pleural",
      "Pneumotórax",
      "Consolidação pulmonar",
      "Enfisema",
    ],
    correct: 2,
    why: "A consolidação transmite melhor as vibrações da voz até a parede torácica.",
  },
  {
    id: "rp3",
    topic: "Respiratório",
    text: "Sibilos são sons:",
    options: [
      "Musicais por estreitamento de vias aéreas",
      "Graves por líquido pleural",
      "Produzidos apenas na inspiração",
      "Exclusivos de pneumonia",
    ],
    correct: 0,
    why: "Sibilos são sons musicais, em geral expiratórios, associados ao estreitamento das vias aéreas.",
  },
  {
    id: "ne1",
    topic: "Neurológico",
    text: "Qual sinal sugere lesão do trato corticoespinhal?",
    options: ["Romberg", "Babinski", "Lasègue", "Murphy"],
    correct: 1,
    why: "A resposta plantar extensora sugere disfunção do neurônio motor superior.",
  },
  {
    id: "ne2",
    topic: "Neurológico",
    text: "A prova dedo-nariz avalia principalmente:",
    options: [
      "Força proximal",
      "Coordenação cerebelar",
      "Sensibilidade térmica",
      "Reflexos profundos",
    ],
    correct: 1,
    why: "A manobra pesquisa dismetria e coordenação apendicular.",
  },
  {
    id: "ne3",
    topic: "Neurológico",
    text: "A Escala de Glasgow reúne quais respostas?",
    options: [
      "Ocular, verbal e motora",
      "Memória, linguagem e cálculo",
      "Força, tônus e reflexos",
      "Marcha, equilíbrio e coordenação",
    ],
    correct: 0,
    why: "A pontuação é composta por abertura ocular, resposta verbal e resposta motora.",
  },
  {
    id: "ab1",
    topic: "Abdome",
    text: "O sinal de Murphy positivo sugere:",
    options: ["Apendicite", "Colecistite aguda", "Pancreatite", "Ascite"],
    correct: 1,
    why: "A interrupção inspiratória por dor à palpação do hipocôndrio direito sugere inflamação da vesícula.",
  },
  {
    id: "ab2",
    topic: "Abdome",
    text: "Por que a ausculta abdominal precede a palpação?",
    options: [
      "A palpação altera os ruídos hidroaéreos",
      "Reduz a dor referida",
      "Evita falso Murphy",
      "Mede melhor o fígado",
    ],
    correct: 0,
    why: "A manipulação pode modificar a motilidade e os ruídos hidroaéreos.",
  },
  {
    id: "ab3",
    topic: "Abdome",
    text: "Macicez móvel à percussão pesquisa:",
    options: ["Pneumoperitônio", "Ascite", "Hepatomegalia", "Fecaloma"],
    correct: 1,
    why: "O líquido livre se desloca com a mudança de decúbito, alterando a zona de macicez.",
  },
  {
    id: "an1",
    topic: "Anamnese",
    text: "Qual abordagem favorece a narrativa inicial do paciente?",
    options: [
      "Perguntas abertas",
      "Perguntas múltiplas",
      "Interrupções precoces",
      "Perguntas indutivas",
    ],
    correct: 0,
    why: "Perguntas abertas permitem que o paciente organize sua história antes do detalhamento focal.",
  },
  {
    id: "an2",
    topic: "Anamnese",
    text: "Irradiação da dor descreve:",
    options: [
      "Sua intensidade",
      "O local para onde se propaga",
      "A duração total",
      "O fator de alívio",
    ],
    correct: 1,
    why: "Irradiação é a propagação da dor para outra região.",
  },
  {
    id: "an3",
    topic: "Anamnese",
    text: "Um dado subjetivo relatado pelo paciente é:",
    options: ["Sinal", "Sintoma", "Síndrome", "Marcador laboratorial"],
    correct: 1,
    why: "Sintoma é uma experiência subjetiva; sinal é um achado observável ou mensurável.",
  },
  {
    id: "ef1",
    topic: "Exame físico",
    text: "A sequência geral mais usada é:",
    options: [
      "Palpação, inspeção, ausculta, percussão",
      "Inspeção, palpação, percussão, ausculta",
      "Ausculta, inspeção, palpação, percussão",
      "Percussão, inspeção, ausculta, palpação",
    ],
    correct: 1,
    why: "A sequência geral é inspeção, palpação, percussão e ausculta, lembrando a exceção do abdome.",
  },
  {
    id: "ef2",
    topic: "Exame físico",
    text: "Cianose central deve ser pesquisada principalmente em:",
    options: [
      "Leito ungueal isolado",
      "Língua e mucosa oral",
      "Planta dos pés",
      "Pavilhão auricular",
    ],
    correct: 1,
    why: "A língua e a mucosa oral ajudam a diferenciar cianose central de alterações periféricas.",
  },
  {
    id: "ef3",
    topic: "Exame físico",
    text: "Edema com depressão persistente após pressão é descrito como:",
    options: ["Flutuante", "Com cacifo", "Crepitante", "Pulsátil"],
    correct: 1,
    why: "O sinal de cacifo indica deslocamento do líquido intersticial pela pressão digital.",
  },
];

const clinicalCases: ClinicalCase[] = [
  {
    id: "case-cv",
    topic: "Cardiovascular",
    title: "Dispneia progressiva e edema",
    prompt:
      "Mulher de 58 anos, hipertensa, apresenta dispneia aos esforços, ortopneia, ganho de 3 kg em uma semana e edema bilateral. PA 162/98 mmHg, FC 108 bpm, SpO₂ 91%, B3 e crepitações bibasais. Escreva a hipótese principal, três exames prioritários e a conduta inicial justificada.",
    expected: [
      "insuficiencia cardiaca",
      "ecocardiograma",
      "eletrocardiograma",
      "bnp",
      "diuret",
      "oxigen",
      "monitor",
    ],
    explanation:
      "O quadro sugere insuficiência cardíaca descompensada. A resposta deve integrar confirmação estrutural/funcional, avaliação de congestão e estabilização inicial.",
  },
  {
    id: "case-rp",
    topic: "Respiratório",
    title: "Dor pleurítica e hipoxemia",
    prompt:
      "Homem de 44 anos apresenta dispneia súbita e dor torácica ventilatório-dependente após viagem longa. FC 116 bpm, FR 28 irpm, SpO₂ 89%, ausculta sem consolidação. Estruture hipótese, diferenciais, investigação inicial e medida imediata de segurança.",
    expected: [
      "tromboembol",
      "embolia",
      "angio",
      "d dimero",
      "oxigen",
      "anticoag",
      "estratifica",
    ],
    explanation:
      "O caso exige reconhecer probabilidade de tromboembolismo pulmonar, avaliar estabilidade e selecionar exames conforme probabilidade clínica.",
  },
  {
    id: "case-ne",
    topic: "Neurológico",
    title: "Déficit focal agudo",
    prompt:
      "Paciente de 67 anos inicia há 50 minutos fala arrastada, desvio da rima e fraqueza em braço direito. Glicemia capilar 104 mg/dL, PA 178/102 mmHg. Descreva localização provável, avaliação imediata e exames que não podem atrasar.",
    expected: [
      "avc",
      "acidente vascular",
      "tomografia",
      "nihss",
      "tempo",
      "trombol",
      "glicemia",
    ],
    explanation:
      "O raciocínio deve priorizar AVC agudo, horário de início, escala neurológica e neuroimagem urgente para diferenciar isquemia de hemorragia.",
  },
];

const topics = ["Todos", ...Array.from(new Set(bank.map((q) => q.topic)))];
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
/** Embaralha as alternativas de uma questão, recalculando o índice da
 * resposta correta para continuar apontando para o mesmo texto. */
function shuffleQuestionOptions(q: Question): Question {
  const correctText = q.options[q.correct];
  const options = shuffle(q.options);
  return { ...q, options, correct: options.indexOf(correctText) };
}
const QUIZ_AMOUNT_CHOICES = [5, 10, 20] as const;
const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function QuizExperience({
  go,
}: {
  go: (screen: "home" | "study" | "profile" | "quiz") => void;
}) {
  const [mode, setMode] = useState<Mode>("home");
  const [topic, setTopic] = useState("Todos");
  const [amount, setAmount] = useState(10);
  const [active, setActive] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(30);
  const { summary: learning } = useLearningSummary();
  const [savedErrors, setSavedErrors] = useState<SavedError[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [simuladoMode, setSimuladoMode] = useState<"config" | "play" | "result" | "blocked" | "insufficient">("config");
  const [simuladoAttemptId, setSimuladoAttemptId] = useState<string | null>(null);
  const [simuladoQuestions, setSimuladoQuestions] = useState<{ id: string; topic: string; text: string; options: string[] }[]>([]);
  const [simuladoIndex, setSimuladoIndex] = useState(0);
  const [simuladoSelected, setSimuladoSelected] = useState<number | null>(null);
  const [simuladoFeedback, setSimuladoFeedback] = useState<{ correct: boolean; correctIndex: number; explanation: string } | null>(null);
  const [simuladoResult, setSimuladoResult] = useState<{ total: number; correct: number; score: number } | null>(null);
  const [simuladoBlocked, setSimuladoBlocked] = useState<{ message: string; usedToday?: number; limitToday?: number; available?: number } | null>(null);
  const [simuladoLoading, setSimuladoLoading] = useState(false);
  const [caseIndex, setCaseIndex] = useState(0);
  const [caseAnswers, setCaseAnswers] = useState<string[]>([]);
  const [caseText, setCaseText] = useState("");
  const [examSeconds, setExamSeconds] = useState(900);

  useEffect(() => {
    fetch("/api/learning")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSavedErrors(data.errors || []);
          setAttempts((data.attempts || []).length);
        }
      })
      .catch(() => {});
  }, []);
  const available =
    topic === "Todos" ? bank : bank.filter((q) => q.topic === topic);
  const maxAmount = Math.min(20, available.length);
  const score = useMemo(
    () => answers.filter((a, i) => a === active[i]?.correct).length,
    [answers, active],
  );
  const caseScore = useMemo(
    () =>
      caseAnswers.reduce((total, answer, index) => {
        const hits = clinicalCases[index].expected.filter((key) =>
          normalized(answer).includes(normalized(key)),
        ).length;
        return (
          total +
          Math.round((hits / clinicalCases[index].expected.length) * 100)
        );
      }, 0) / clinicalCases.length,
    [caseAnswers],
  );

  useEffect(() => {
    if (mode !== "quiz") return;
    setSeconds(30);
    const id = window.setInterval(
      () =>
        setSeconds((value) => {
          if (value <= 1) {
            window.clearInterval(id);
            answerQuestion(-1);
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => window.clearInterval(id);
  }, [mode, current]);
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
  }, [mode]);

  async function startSimulado() {
    setSimuladoLoading(true);
    setSimuladoFeedback(null);
    try {
      const response = await fetch("/api/simulados/start", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403 && data.limitReached) {
        setSimuladoBlocked({ message: data.error, usedToday: data.simuladosUsedToday, limitToday: data.simuladosLimitToday });
        setSimuladoMode("blocked");
        return;
      }
      if (response.status === 409 && data.code === "INSUFFICIENT_QUESTION_BANK") {
        setSimuladoBlocked({ message: data.error, available: data.availableQuestions });
        setSimuladoMode("insufficient");
        return;
      }
      if (!response.ok) {
        setSimuladoBlocked({ message: data.error || "Não foi possível iniciar o simulado." });
        setSimuladoMode("blocked");
        return;
      }
      setSimuladoAttemptId(data.attemptId);
      setSimuladoQuestions(data.questions || []);
      const firstUnanswered = (data.questions || []).findIndex((q: { answered?: boolean }) => !q.answered);
      setSimuladoIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
      setSimuladoSelected(null);
      setSimuladoResult(null);
      setSimuladoMode("play");
    } finally {
      setSimuladoLoading(false);
    }
  }

  async function answerSimulado() {
    if (simuladoSelected === null || !simuladoAttemptId) return;
    const question = simuladoQuestions[simuladoIndex];
    const response = await fetch("/api/simulados/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: simuladoAttemptId, questionId: question.id, selectedIndex: simuladoSelected }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setSimuladoFeedback({ correct: data.correct, correctIndex: data.correctIndex, explanation: data.explanation });
  }

  async function nextSimuladoQuestion() {
    if (simuladoIndex + 1 < simuladoQuestions.length) {
      setSimuladoIndex((i) => i + 1);
      setSimuladoSelected(null);
      setSimuladoFeedback(null);
      return;
    }
    if (!simuladoAttemptId) return;
    const response = await fetch("/api/simulados/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: simuladoAttemptId }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setSimuladoResult({ total: data.total, correct: data.correct, score: data.score });
    setSimuladoMode("result");
  }

  function startQuiz() {
    const pool =
      topic === "Todos" ? bank : bank.filter((q) => q.topic === topic);
    // Nunca reduz a quantidade silenciosamente: o botão de uma quantidade
    // maior que o banco disponível já vem desabilitado na configuração.
    const size = Math.min(amount, pool.length);
    setActive(shuffle(pool).slice(0, size).map(shuffleQuestionOptions));
    setCurrent(0);
    setAnswers([]);
    setSelected(null);
    setMode("quiz");
  }
  async function saveQuiz(finalAnswers: number[]) {
    const wrong = active.flatMap((q, i) =>
      finalAnswers[i] === q.correct
        ? []
        : [
            {
              questionId: q.id,
              topic: q.topic,
              question: q.text,
              selectedAnswer:
                q.options[finalAnswers[i]] || "Sem resposta — tempo esgotado",
              correctAnswer: q.options[q.correct],
              explanation: q.why,
            },
          ],
    );
    setAnswers(finalAnswers);
    setSavedErrors((old) => [...wrong, ...old]);
    setMode("quiz-result");
    const byTopic = active.reduce<Record<string, { topic: string; total: number; correct: number }>>((result, question, index) => {
      const item = result[question.topic] || { topic: question.topic, total: 0, correct: 0 };
      item.total += 1;
      if (finalAnswers[index] === question.correct) item.correct += 1;
      result[question.topic] = item;
      return result;
    }, {});
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "quiz_result",
          topic,
          total: active.length,
          correct: finalAnswers.filter((a, i) => a === active[i].correct)
            .length,
          topicResults: Object.values(byTopic),
          errors: wrong,
        }),
      });
      if (response.ok) {
        setAttempts((v) => v + 1);
        window.dispatchEvent(new Event("semiolab:learning-updated"));
      }
    } catch {}
  }
  function answerQuestion(forced?: number) {
    const value = forced ?? selected;
    if (value === null) return;
    const next = [...answers, value];
    setSelected(null);
    if (current === active.length - 1) saveQuiz(next);
    else {
      setAnswers(next);
      setCurrent((v) => v + 1);
    }
  }
  function startExam() {
    setCaseIndex(0);
    setCaseAnswers([]);
    setCaseText("");
    setExamSeconds(900);
    setMode("exam");
  }
  function saveExamResult(completed: string[]) {
    const topicResults = clinicalCases.map((item, index) => {
      const hits = item.expected.filter((key) => normalized(completed[index] || "").includes(normalized(key))).length;
      return { topic: item.topic, total: 1, correct: hits >= 3 ? 1 : 0 };
    });
    fetch("/api/learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "quiz_result",
        topic: "Simulado clínico",
        total: clinicalCases.length,
        correct: topicResults.reduce((sum, item) => sum + item.correct, 0),
        topicResults,
        errors: [],
      }),
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("semiolab:learning-updated"));
    }).catch(() => {});
  }
  function nextCase() {
    const next = [...caseAnswers, caseText];
    setCaseAnswers(next);
    setCaseText("");
    if (caseIndex === clinicalCases.length - 1) {
      setMode("exam-result");
      saveExamResult(next);
    } else setCaseIndex((v) => v + 1);
  }
  function finishExam() {
    const completed = [...caseAnswers, caseText];
    while (completed.length < clinicalCases.length) completed.push("");
    setCaseAnswers(completed);
    setMode("exam-result");
    saveExamResult(completed);
  }

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
        <main>
          <small>{q.topic.toUpperCase()} · SIMULADO</small>
          <h1>{q.text}</h1>
          <div>
            {q.options.map((option, i) => (
              <button
                key={option}
                className={`${simuladoSelected === i ? "selected" : ""} ${simuladoFeedback ? (i === simuladoFeedback.correctIndex ? "correct" : simuladoSelected === i ? "wrong" : "") : ""}`}
                disabled={!!simuladoFeedback}
                onClick={() => setSimuladoSelected(i)}
              >
                <i>{String.fromCharCode(65 + i)}</i>
                {option}
              </button>
            ))}
          </div>
          {simuladoFeedback && (
            <p className="quiz-answer-explanation">
              {simuladoFeedback.correct ? "Correto! " : "Não foi dessa vez. "}
              {simuladoFeedback.explanation}
            </p>
          )}
          <footer>
            <button onClick={() => { setMode("home"); setSimuladoMode("config"); }}>Encerrar</button>
            {!simuladoFeedback ? (
              <button className="primary" disabled={simuladoSelected === null} onClick={answerSimulado}>
                Responder <ChevronRight />
              </button>
            ) : (
              <button className="primary" onClick={nextSimuladoQuestion}>
                {simuladoIndex + 1 === simuladoQuestions.length ? "Finalizar" : "Próxima"} <ChevronRight />
              </button>
            )}
          </footer>
        </main>
      </div>
    );
  }
  if (simuladoMode === "result" && simuladoResult) {
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}><ArrowLeft /></button>
          <span><small>RESULTADO</small><b>Simulado concluído</b></span>
        </header>
        <div className="quiz-config">
          <h1>{simuladoResult.correct} de {simuladoResult.total} corretas</h1>
          <p>Aproveitamento de {simuladoResult.score}%.</p>
          <button className="primary" onClick={() => { setMode("home"); setSimuladoMode("config"); }}>Voltar ao início <ChevronRight /></button>
        </div>
      </div>
    );
  }
  if (mode === "quiz") {
    const question = active[current];
    return (
      <div className="quiz-ui quiz-play">
        <header>
          <button onClick={() => setMode("home")}>
            <X />
          </button>
          <span>
            Questão {current + 1} de {active.length}
            <i>
              <b
                style={{ width: `${((current + 1) / active.length) * 100}%` }}
              />
            </i>
          </span>
          <Clock3 />
          <b className={seconds < 10 ? "timer-danger" : ""}>{seconds}s</b>
        </header>
        <main>
          <small>{question.topic.toUpperCase()} · QUIZ RÁPIDO</small>
          <h1>{question.text}</h1>
          {question.image && (
            <figure className="quiz-image">
              <img
                src={question.image}
                alt="Tomografia computadorizada usada na questão"
              />
              <figcaption>
                <ImageIcon /> Imagem clínica da questão
              </figcaption>
            </figure>
          )}
          <div>
            {question.options.map((option, i) => (
              <button
                key={option}
                className={selected === i ? "selected" : ""}
                onClick={() => setSelected(i)}
              >
                <i>{String.fromCharCode(65 + i)}</i>
                {option}
              </button>
            ))}
          </div>
          <footer>
            <button onClick={() => setMode("home")}>Encerrar quiz</button>
            <button
              className="primary"
              disabled={selected === null}
              onClick={() => answerQuestion()}
            >
              {current === active.length - 1 ? "Finalizar" : "Responder"}
              <ChevronRight />
            </button>
          </footer>
        </main>
      </div>
    );
  }
  if (mode === "quiz-result")
    return (
      <div className="page quiz-ui">
        <header className="simple-back">
          <button onClick={() => setMode("home")}>
            <ArrowLeft />
          </button>
          <span>
            <small>RESULTADO DO QUIZ</small>
            <b>{topic}</b>
          </span>
        </header>
        <div className="quiz-result">
          <div className="score">
            <b>
              {active.length ? Math.round((score / active.length) * 100) : 0}
            </b>
            <small>pontos</small>
          </div>
          <h1>
            {score === active.length
              ? "Excelente. Você acertou tudo."
              : "Quiz concluído. Revise os pontos de atenção."}
          </h1>
          <p>
            Você acertou {score} de {active.length}. Cada erro foi registrado no
            seu caderno.
          </p>
          <div className="answer-list">
            {active.map((q, i) => (
              <article
                key={q.id}
                className={answers[i] === q.correct ? "correct" : "wrong"}
              >
                <b>{i + 1}</b>
                <span>
                  <small>
                    {answers[i] === q.correct ? "RESPOSTA CORRETA" : "REVISAR"}
                  </small>
                  <p>{q.text}</p>
                  <em>{q.why}</em>
                </span>
              </article>
            ))}
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
  if (mode === "exam") {
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
        <main>
          <small>{item.topic.toUpperCase()}</small>
          <h1>{item.title}</h1>
          <p>{item.prompt}</p>
          <label>
            Sua resposta clínica
            <textarea
              autoFocus
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              placeholder="Organize hipótese, diferenciais, exames e conduta. Justifique seu raciocínio..."
            />
          </label>
          <div className="exam-note">
            <FileText />
            <span>
              <b>Resposta discursiva</b>
              <small>
                A avaliação considera conceitos clínicos essenciais, não
                palavras idênticas.
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
  if (mode === "exam-result")
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
        <div className="quiz-result clinical-result">
          <div className="score">
            <b>{Math.round(caseScore)}</b>
            <small>pontos</small>
          </div>
          <h1>Avaliação do raciocínio clínico</h1>
          <p>Confira quais conceitos essenciais apareceram em cada resposta.</p>
          <div className="answer-list">
            {clinicalCases.map((item, i) => {
              const hits = item.expected.filter((key) =>
                normalized(caseAnswers[i] || "").includes(normalized(key)),
              );
              return (
                <article
                  key={item.id}
                  className={hits.length >= 3 ? "correct" : "wrong"}
                >
                  <b>{i + 1}</b>
                  <span>
                    <small>{hits.length} CONCEITOS IDENTIFICADOS</small>
                    <p>{item.title}</p>
                    <em>{item.explanation}</em>
                    <p className="concepts">
                      Conceitos reconhecidos:{" "}
                      {hits.length
                        ? hits.join(", ")
                        : "nenhum dos conceitos essenciais"}
                      .
                    </p>
                  </span>
                </article>
              );
            })}
          </div>
          <button className="primary" onClick={() => setMode("exam-config")}>
            Refazer simulado
          </button>
        </div>
      </div>
    );
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
            Respostas de múltipla escolha com 30 segundos por questão e correção
            imediata ao final.
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
                {Math.min(amount, maxAmount)} questões · 30 segundos cada
              </small>
            </span>
          </div>
          <button className="primary" onClick={startQuiz} disabled={maxAmount === 0}>
            Começar quiz <ChevronRight />
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
            Três casos longos, campo livre para resposta e 15 minutos totais.
            Sua resposta deve conter hipótese, investigação e conduta.
          </p>
          <div className="clinical-case-list">
            {clinicalCases.map((item) => (
              <span key={item.id}>
                <BookOpenText />
                <i>
                  <b>{item.title}</b>
                  <small>{item.topic}</small>
                </i>
              </span>
            ))}
          </div>
          <div className="config-summary">
            <Clock3 />
            <span>
              <b>15 minutos</b>
              <small>3 casos · resposta aberta · avaliação por conceitos</small>
            </span>
          </div>
          <button className="primary" onClick={startExam}>
            Iniciar simulado clínico <ChevronRight />
          </button>
        </div>
      </div>
    );
  return (
    <div className="page quiz-ui quiz-home">
      <div className="quiz-top">
        <button onClick={() => go("home")}>
          <ArrowLeft />
        </button>
        <span>
          <small>PRÁTICA E AVALIAÇÃO</small>
          <h1>Quiz e simulados</h1>
        </span>
        <button
          className="quiz-insights-button"
          onClick={() => setMode("errors")}
          aria-label="Abrir caderno de erros"
        >
          <BarChart3 />
          {savedErrors.length > 0 && <i>{savedErrors.length}</i>}
        </button>
      </div>
      <section className="quiz-landing-hero">
        <span>
          <h2>
            Treine decisões.<br />
            Evolua na <em>prática.</em>
          </h2>
          <p>
            Escolha o formato ideal para o seu momento de estudo.
          </p>
        </span>
        <div className="quiz-medical-cross" aria-hidden="true">
          <i />
          <i />
        </div>
      </section>

      <section className="quiz-format-grid">
        <article className="quiz-format-card quiz-fast-card">
          <header>
            <span><Zap /> QUIZ RÁPIDO</span>
          </header>
          <div className="quiz-format-copy">
            <h2>Objetivo e visual</h2>
            <p>Questões rápidas, imagens clínicas e correção ao final.</p>
          </div>
          <div className="quiz-coin" aria-hidden="true">
            <span><Zap /></span>
          </div>
          <div className="quiz-format-facts">
            <span><Clock3 /><b>30s</b><small>por questão</small></span>
            <span><FileText /><b>3–15</b><small>questões</small></span>
            <span><Check /><b>Feedback</b><small>detalhado</small></span>
          </div>
          <div className="quiz-format-status">
            <BarChart3 />
            <span><small>Atividades concluídas</small><b>{attempts}</b></span>
          </div>
          <button className="quiz-format-cta" onClick={() => setMode("quiz-config")}>
            Iniciar quiz <ChevronRight />
          </button>
        </article>

        <article className="quiz-format-card quiz-clinical-card">
          <header>
            <span><ClipboardCheck /> SIMULADO CLÍNICO</span>
          </header>
          <div className="quiz-format-copy">
            <h2>Raciocínio completo</h2>
            <p>Casos extensos, tempo total e avaliação detalhada.</p>
          </div>
          <div className="quiz-clipboard" aria-hidden="true">
            <span><Check /></span>
            <i />
          </div>
          <div className="quiz-format-facts">
            <span><Clock3 /><b>15 min</b><small>tempo total</small></span>
            <span><FileText /><b>3 casos</b><small>clínicos</small></span>
            <span><Target /><b>Avaliação</b><small>por conceitos</small></span>
          </div>
          <button className="quiz-format-cta" onClick={() => setMode("exam-config")}>
            Configurar simulado <ChevronRight />
          </button>
        </article>

        <article className="quiz-format-card">
          <header>
            <span><Target /> SIMULADO (10 QUESTÕES)</span>
          </header>
          <div className="quiz-format-copy">
            <h2>Simulado objetivo</h2>
            <p>10 questões fixas, sem repetição, com contador diário por plano.</p>
          </div>
          <div className="quiz-format-facts">
            <span><FileText /><b>10</b><small>questões</small></span>
            <span><Check /><b>Nunca repete</b><small>por usuário</small></span>
            <span><Clock3 /><b>Retomável</b><small>se sair no meio</small></span>
          </div>
          <button
            className="quiz-format-cta"
            disabled={simuladoLoading}
            onClick={() => { setSimuladoMode("config"); startSimulado(); }}
          >
            {simuladoLoading ? "Carregando..." : "Iniciar simulado"} <ChevronRight />
          </button>
        </article>
      </section>

      <button
        className="quiz-resume-strip"
        onClick={() => {
          setTopic("Todos");
          setAmount(10);
          setActive(shuffle(bank).slice(0, Math.min(10, bank.length)).map(shuffleQuestionOptions));
          setCurrent(0);
          setAnswers([]);
          setSelected(null);
          setMode("quiz");
        }}
      >
        <i><Target /></i>
        <span>
          <b>Começar treino misto</b>
          <small>5 questões variadas de Semiologia</small>
        </span>
        <em>Iniciar agora</em>
        <ChevronRight />
      </button>
    </div>
  );
}
