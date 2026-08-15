"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
type Intent =
  | "onset"
  | "previous"
  | "pain"
  | "dyspnea"
  | "effort"
  | "orthopnea"
  | "pnd"
  | "edema"
  | "cough"
  | "fever"
  | "palpitations"
  | "syncope"
  | "fatigue"
  | "weight"
  | "urine"
  | "medication"
  | "adherence"
  | "hypertension"
  | "diabetes"
  | "cardiac"
  | "smoking"
  | "alcohol"
  | "allergy"
  | "family"
  | "occupation"
  | "food"
  | "sleep"
  | "identity"
  | "main"
  | "greeting"
  | "other";
const PATIENT_SESSION_KEY = "semiolab:patient-session:v2";
const PATIENT_HISTORY_KEY = "semiolab:consult-history:v1";
const normalize = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
function identify(raw: string): Intent {
  const q = normalize(raw);
  if (/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(q)) return "greeting";
  if (/(seu nome|como se chama|qual.*idade|quantos anos)/.test(q))
    return "identity";
  if (/(motivo|o que.*sentindo|o que.*trouxe|queixa principal)/.test(q))
    return "main";
  if (
    /(primeira vez|ja teve|teve isso antes|problema parecido|episodio anterior)/.test(
      q,
    )
  )
    return "previous";
  if (/(quando comecou|desde quando|ha quanto tempo|inicio.*sintoma)/.test(q))
    return "onset";
  if (/(acorda.*falta|falta.*durante a noite|dispneia.*noturna)/.test(q))
    return "pnd";
  if (/(quantos travesseiros|deitad|ortopneia|melhora.*sentad)/.test(q))
    return "orthopnea";
  if (/(esforco|escada|andar|caminhar|atividade)/.test(q)) return "effort";
  if (/(falta de ar|respirar|dispneia|folego)/.test(q)) return "dyspnea";
  if (/(dor|aperto|pressao.*peito|peito.*aperta)/.test(q)) return "pain";
  if (/(inchaco|inchado|edema|tornozelo|perna)/.test(q)) return "edema";
  if (/(tosse|catarro|expectora)/.test(q)) return "cough";
  if (/(febre|calafrio|temperatura)/.test(q)) return "fever";
  if (/(palpitacao|coracao.*aceler|coracao.*dispar)/.test(q))
    return "palpitations";
  if (/(desmai|tontura|sincope)/.test(q)) return "syncope";
  if (/(cansaco|fadiga|fraqueza)/.test(q)) return "fatigue";
  if (/(ganhou.*peso|perdeu.*peso|peso.*mudou|aumento.*peso)/.test(q))
    return "weight";
  if (/(urina|diurese|urinando)/.test(q)) return "urine";
  if (/(esquece|toma.*direit|aderencia|regularmente)/.test(q))
    return "adherence";
  if (/(remedio|medicamento|medicacao|comprimido)/.test(q)) return "medication";
  if (/(pressao alta|hipertens)/.test(q)) return "hypertension";
  if (/(diabetes|glicose|acucar no sangue)/.test(q)) return "diabetes";
  if (/(coracao|cardiac|infarto|insuficiencia cardiaca)/.test(q))
    return "cardiac";
  if (/(fuma|cigarro|tabag)/.test(q)) return "smoking";
  if (/(alcool|bebida|bebe)/.test(q)) return "alcohol";
  if (/(alerg)/.test(q)) return "allergy";
  if (/(familia|pai|mae|irmao|familiar)/.test(q)) return "family";
  if (/(trabalha|profissao|ocupacao)/.test(q)) return "occupation";
  if (/(aliment|comida|sal)/.test(q)) return "food";
  if (/(dorme|sono)/.test(q)) return "sleep";
  return "other";
}
function identifyAll(raw: string): Intent[] {
  const chunks = raw
    .split(/\?|;|,\s*|\s+e\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  const intents = chunks.map(identify).filter((intent) => intent !== "other");
  if (!intents.length) {
    const single = identify(raw);
    return single === "other" ? ["other"] : [single];
  }
  return [...new Set(intents)].slice(0, 4);
}
const facts: Record<Exclude<Intent, "other">, string> = {
  greeting: "Bom dia, doutor. Estou preocupada com essa falta de ar.",
  identity: "Meu nome é Marina Rocha e tenho 54 anos.",
  main: "Vim porque estou muito cansada e com falta de ar desde ontem. Hoje piorou ao subir as escadas.",
  onset:
    "Começou ontem à tarde como um cansaço leve. Hoje de manhã a falta de ar ficou mais forte.",
  previous:
    "Já senti cansaço leve outras vezes, mas falta de ar desse jeito é a primeira vez.",
  pain: "Dor forte não. Às vezes sinto um aperto leve no peito quando fico mais ofegante, sem irradiar.",
  dyspnea:
    "Parece que o ar não entra o suficiente. Em repouso melhora, mas ainda fico um pouco ofegante.",
  effort:
    "Piora bastante ao caminhar rápido ou subir escadas. Hoje precisei parar no meio do lance.",
  orthopnea:
    "Nas últimas duas noites fiquei melhor com dois travesseiros. Deitada totalmente parece piorar.",
  pnd: "Ontem acordei de madrugada com falta de ar e precisei sentar na cama por alguns minutos.",
  edema:
    "Meus dois tornozelos incham no fim do dia. Nesta semana o inchaço aumentou.",
  cough:
    "Tenho tosse seca de vez em quando, principalmente quando me deito. Não sai catarro.",
  fever: "Não tive febre nem calafrios.",
  palpitations:
    "Às vezes o coração acelera quando fico ofegante, mas melhora com repouso.",
  syncope:
    "Não desmaiei. Tive uma tontura leve hoje ao levantar rápido, mas passou.",
  fatigue:
    "Estou mais cansada há cerca de uma semana, até para tarefas simples de casa.",
  weight:
    "A balança marcou quase dois quilos a mais nesta semana, sem mudança na alimentação.",
  urine:
    "Acho que estou urinando um pouco menos desde ontem. Não sinto dor nem ardência.",
  medication:
    "Uso losartana de 50 mg para pressão, uma vez ao dia. Não uso outros remédios contínuos.",
  adherence:
    "Esqueço a losartana duas ou três vezes por semana, principalmente quando saio cedo.",
  hypertension:
    "Tenho pressão alta há oito anos. Na última consulta estava acima do normal.",
  diabetes: "Nunca fui diagnosticada com diabetes.",
  cardiac:
    "Nunca tive infarto nem diagnóstico de insuficiência cardíaca. Já disseram que meu coração parecia aumentado numa radiografia antiga.",
  smoking:
    "Fumei por quinze anos, mas parei há seis. Era cerca de meio maço por dia.",
  alcohol: "Bebo socialmente, uma ou duas taças no fim de semana.",
  allergy: "Não conheço nenhuma alergia a medicamentos ou alimentos.",
  family: "Meu pai morreu de infarto aos 62 anos e minha mãe tem pressão alta.",
  occupation:
    "Sou cozinheira em uma escola e fico muito tempo em pé. Nesta semana o trabalho ficou mais cansativo.",
  food: "Uso bastante sal e como embutidos algumas vezes por semana.",
  sleep:
    "Tenho dormido mal porque deitada sinto mais falta de ar. Com dois travesseiros descanso melhor.",
};
function reply(raw: string, asked: Record<string, number>) {
  const intents = identifyAll(raw);
  if (intents[0] === "other") {
    return {
      intents,
      text: "Desculpe, doutor, não entendi bem a pergunta. O senhor pode perguntar de outro jeito?",
    };
  }
  const answers = intents.map((intent, index) => {
    const statement = facts[intent as Exclude<Intent, "other">];
    const repeated = (asked[intent] || 0) > 0 && !["greeting", "main"].includes(intent);
    if (repeated && intents.length === 1)
      return `Como eu tinha contado, ${statement.charAt(0).toLowerCase()}${statement.slice(1)}`;
    if (index === 0) return statement;
    return `Também, ${statement.charAt(0).toLowerCase()}${statement.slice(1)}`;
  });
  return { intents, text: answers.join(" ") };
}
function buildExamReport(order: string): ExamReport {
  const q = normalize(order),
    found: string[] = [],
    labs: LabRow[] = [],
    imaging: ExamImage[] = [];
  // Política clínica: uma imagem só é anexada quando o tipo de exame, o caso
  // e o achado da mídia validada coincidem. Solicitações fora do catálogo não
  // recebem imagens aproximadas, genéricas ou inventadas.
  if (/(raio x|radiografia|\brx\b|raio.*torax)/.test(q)) {
    found.push(
      "Radiografia de tórax: cardiomegalia, congestão vascular pulmonar e pequenos derrames pleurais bilaterais.",
    );
    imaging.push({
      title: "Radiografia de tórax",
      image: "/clinical/radiografia-ic-congestiva.png",
      findings:
        "Índice cardiotorácico aumentado, redistribuição vascular e velamento discreto dos seios costofrênicos.",
      comparison: "Sem radiografia anterior disponível nesta simulação.",
      caption:
        "Referência real validada para radiografia de insuficiência cardíaca; não pertence à paciente simulada.",
      source: "James Heilman, MD · Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:CHF2016.png",
      license: "CC BY-SA 4.0",
    });
  }
  if (/(bnp|nt probnp|peptideo natriuretico)/.test(q)) {
    found.push("BNP elevado.");
    labs.push({
      name: "BNP",
      value: "1.280",
      unit: "pg/mL",
      reference: "< 100",
      status: "high",
    });
  }
  if (/(ecocardiograma|eco)/.test(q)) {
    found.push(
      "Ecocardiograma: FEVE 38%, disfunção sistólica global e aumento do átrio esquerdo.",
    );
    imaging.push({
      title: "Ecocardiograma transtorácico",
      findings:
        "FEVE 38%, hipocinesia global, aumento do átrio esquerdo e insuficiência mitral funcional leve.",
      comparison: "Sem ecocardiograma anterior para comparação.",
    });
  }
  if (/(eletrocardiograma|\becg\b|\bekg\b)/.test(q)) {
    found.push(
      "ECG: ritmo sinusal, FC 104 bpm, hipertrofia ventricular esquerda, sem isquemia aguda.",
    );
    imaging.push({
      title: "Eletrocardiograma de 12 derivações",
      image: "/clinical/ecg-hve.jpg",
      findings:
        "Traçado de referência com critérios de hipertrofia ventricular esquerda e alterações secundárias da repolarização.",
      comparison: "Sem eletrocardiograma anterior disponível nesta simulação.",
      caption:
        "Referência real validada para ECG com hipertrofia ventricular esquerda; não pertence à paciente simulada.",
      source: "CardioNetworks ECGpedia · Wikimedia Commons",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:E307_(CardioNetworks_ECGpedia).jpg",
      license: "CC BY-SA 3.0",
    });
  }
  if (/hemograma/.test(q)) {
    found.push("Hemograma sem alterações relevantes.");
    labs.push(
      {
        name: "Hemoglobina",
        value: "12,8",
        unit: "g/dL",
        reference: "12,0–16,0",
        status: "normal",
      },
      {
        name: "Leucócitos",
        value: "8.700",
        unit: "/mm³",
        reference: "4.000–11.000",
        status: "normal",
      },
      {
        name: "Plaquetas",
        value: "248.000",
        unit: "/mm³",
        reference: "150.000–450.000",
        status: "normal",
      },
    );
  }
  if (/(creatinina|ureia|funcao renal)/.test(q)) {
    found.push("Discreta elevação da ureia, com creatinina limítrofe.");
    labs.push(
      {
        name: "Creatinina",
        value: "1,3",
        unit: "mg/dL",
        reference: "0,6–1,2",
        status: "high",
      },
      {
        name: "Ureia",
        value: "52",
        unit: "mg/dL",
        reference: "15–45",
        status: "high",
      },
    );
  }
  if (/(sodio|potassio|eletrolito)/.test(q)) {
    found.push("Hiponatremia leve.");
    labs.push(
      {
        name: "Sódio",
        value: "132",
        unit: "mEq/L",
        reference: "135–145",
        status: "low",
      },
      {
        name: "Potássio",
        value: "4,3",
        unit: "mEq/L",
        reference: "3,5–5,1",
        status: "normal",
      },
    );
  }
  if (/(troponina|marcador.*cardiac)/.test(q)) {
    found.push("Troponina ultrassensível negativa em duas dosagens.");
    labs.push({
      name: "Troponina I ultrassensível",
      value: "7",
      unit: "ng/L",
      reference: "< 16",
      status: "normal",
    });
  }
  if (/(gasometria|gaso)/.test(q)) {
    found.push("Gasometria com hipoxemia leve, sem retenção de CO₂.");
    labs.push(
      {
        name: "pH",
        value: "7,43",
        unit: "",
        reference: "7,35–7,45",
        status: "normal",
      },
      {
        name: "PaO₂",
        value: "68",
        unit: "mmHg",
        reference: "80–100",
        status: "low",
      },
      {
        name: "PaCO₂",
        value: "37",
        unit: "mmHg",
        reference: "35–45",
        status: "normal",
      },
    );
  }
  if (/(exame.*sangue|exames.*laborator|laboratorio|painel.*sangu)/.test(q) && labs.length === 0) {
    found.push(
      "Painel sanguíneo: hemograma sem alterações relevantes, hiponatremia leve e função renal limítrofe.",
    );
    labs.push(
      { name: "Hemoglobina", value: "12,8", unit: "g/dL", reference: "12,0–16,0", status: "normal" },
      { name: "Leucócitos", value: "8.700", unit: "/mm³", reference: "4.000–11.000", status: "normal" },
      { name: "Creatinina", value: "1,3", unit: "mg/dL", reference: "0,6–1,2", status: "high" },
      { name: "Sódio", value: "132", unit: "mEq/L", reference: "135–145", status: "low" },
      { name: "Potássio", value: "4,3", unit: "mEq/L", reference: "3,5–5,1", status: "normal" },
    );
  }
  const summary = found.length
    ? found.join(" ")
    : "O setor de diagnóstico informou que o exame descrito não está disponível nesta simulação. Revise o nome da solicitação.";
  return { summary, labs, imaging };
}
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
function evaluateConsult(
  asked: Record<string, number>,
  physical: boolean,
  order: string,
  hypothesis: string,
  differentials: string,
  conduct: string,
) {
  const count = (keys: Intent[]) =>
    keys.filter((k) => (asked[k] || 0) > 0).length;
  const essentials = ["onset", "dyspnea", "effort", "orthopnea", "pnd", "edema"] as Intent[];
  const context = ["pain", "weight", "urine", "medication", "adherence", "hypertension", "cardiac", "smoking", "family"] as Intent[];
  const history = Math.min(30, count(essentials) * 5) + Math.min(10, count(context) * 2);
  const q = normalize(order);
  const appropriateExamGroups = [
    /(raio x|radiografia|\brx\b)/,
    /(eletrocardiograma|\becg\b|\bekg\b)/,
    /(bnp|nt probnp|peptideo natriuretico)/,
    /(ecocardiograma|\beco\b)/,
    /(creatinina|ureia|funcao renal|sodio|potassio|eletrolito|laboratorio|exame.*sangue)/,
  ].filter((rx) => rx.test(q)).length;
  const exams = Math.min(15, appropriateExamGroups * 3);
  const h = normalize(hypothesis),
    diagnosis = /(insuficiencia cardiaca.*descompens|ic.*descompens|insuficiencia cardiaca congestiva)/.test(h)
      ? 16
      : /(insuficiencia cardiaca|edema pulmonar|congestao cardiaca)/.test(h)
        ? 10
        : 0;
  const d = normalize(differentials),
    diff = [/(sindrome coronariana|infarto)/, /(pneumonia)/, /(tromboembol)/, /(dpoc|asma)/, /(renal)/]
      .filter((rx) => rx.test(d)).length >= 2 ? 6 : d ? 3 : 0;
  const c = normalize(conduct),
    plan = Math.min(8, [/(furosemida|diuret)/, /(oxigen)/, /(intern|encaminh|emergencia)/, /(monitor|sinais vitais)/]
      .filter((rx) => rx.test(c)).length * 2);
  const completedReasoning = Boolean(hypothesis.trim() && conduct.trim());
  const reasoning = completedReasoning ? diagnosis + diff + plan : 0;
  const score = completedReasoning ? Math.min(100, history + (physical ? 15 : 0) + exams + reasoning) : 0;
  const strengths = [
    count(["onset", "dyspnea", "effort"]) >= 2 && "Caracterizou início, evolução e relação da dispneia com esforço.",
    count(["orthopnea", "pnd", "edema", "weight"]) >= 2 && "Investigou sinais de congestão sistêmica e pulmonar.",
    count(["medication", "adherence", "hypertension", "cardiac"]) >= 2 && "Explorou antecedentes, medicações e adesão.",
    physical && "Realizou exame físico direcionado com sinais vitais.",
    appropriateExamGroups > 0 && "Solicitou exames pertinentes ao cenário apresentado.",
    diagnosis >= 10 && "A hipótese principal é compatível com os dados coletados.",
    plan >= 4 && "A conduta contempla medidas iniciais relevantes.",
  ].filter(Boolean) as string[];
  const gaps = [
    !asked.onset && "Perguntar quando os sintomas começaram e como evoluíram.",
    !asked.orthopnea && "Investigar ortopneia e número de travesseiros.",
    !asked.pnd && "Perguntar sobre dispneia paroxística noturna.",
    !asked.edema && "Investigar edema periférico e sua progressão.",
    !asked.medication && "Revisar medicações em uso.",
    !asked.adherence && "Confirmar adesão e doses esquecidas.",
    !physical && "Realizar exame físico direcionado antes de concluir.",
    diagnosis < 10 && "Relacionar dispneia, ortopneia, edema e congestão à hipótese de insuficiência cardíaca descompensada.",
    plan < 4 && "Descrever monitorização, suporte inicial e necessidade de avaliação urgente/hospitalar.",
  ].filter(Boolean) as string[];
  const examLearning = [
    /(raio x|radiografia|\brx\b)/.test(q) && "Na radiografia, cardiomegalia, redistribuição vascular e pequenos derrames apoiam congestão cardíaca.",
    /(eletrocardiograma|\becg\b|\bekg\b)/.test(q) && "No ECG, hipertrofia ventricular esquerda sugere repercussão crônica da hipertensão; não há sinal de isquemia aguda no traçado apresentado.",
    /(bnp|nt probnp|peptideo natriuretico)/.test(q) && "BNP elevado reforça insuficiência cardíaca no contexto clínico, mas não deve ser interpretado isoladamente.",
    /(ecocardiograma|\beco\b)/.test(q) && "A FEVE reduzida e a hipocinesia global ajudam a definir disfunção sistólica e gravidade.",
    !appropriateExamGroups && "Este caso podia ser fortemente suspeitado pela anamnese e pelo exame físico; exames serviriam para confirmar gravidade, etiologia e diagnósticos diferenciais.",
  ].filter(Boolean) as string[];
  return { score, history, physical: physical ? 15 : 0, exams, reasoning, strengths, gaps, examLearning, completedReasoning };
}

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
    [conduct, setConduct] = useState("");
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
  const evaluation = useMemo(
      () =>
        evaluateConsult(
          asked,
          physical,
          examOrder,
          hypothesis,
          differentials,
          conduct,
        ),
      [asked, physical, examOrder, hypothesis, differentials, conduct],
    ),
    score = evaluation.score,
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
  function start() {
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
    setMessages([
      {
        who: "patient",
        text: "Bom dia, doutor. Desde ontem estou muito cansada e hoje tive uma falta de ar estranha.",
        createdAt: Date.now(),
      },
    ]);
    setPhase("chat");
  }
  function send() {
    const question = input.trim();
    if (!question) return;
    const answer = reply(question, asked);
    setAsked((current) => {
      const next = { ...current };
      answer.intents.forEach((intent) => { next[intent] = (next[intent] || 0) + 1; });
      return next;
    });
    setMessages((m) => [...m, { who: "student", text: question, createdAt: Date.now() }]);
    setInput("");
    setTyping(true);
    setPendingReply(answer.text);
  }
  function requestExam() {
    const order = examText.trim();
    if (!order) return;
    const report = buildExamReport(order);
    setExamOrder(order);
    setExamOpen(false);
    setMessages((m) => [
      ...m,
      { who: "exam", text: "RESULTADOS LIBERADOS", report, createdAt: Date.now() },
    ]);
    setExamText("");
  }
  function finishConsult() {
    if (!hypothesis.trim() || !conduct.trim()) return;
    const record: ConsultHistory = {
      id: `${Date.now()}`,
      finishedAt: Date.now(),
      score,
      level,
      title,
      hypothesis: hypothesis.trim(),
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      examLearning: evaluation.examLearning,
    };
    const next = [record, ...history].slice(0, 12);
    setHistory(next);
    window.localStorage.setItem(PATIENT_HISTORY_KEY, JSON.stringify(next));
    fetch("/api/learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "patient_result",
        topic: "Cardiovascular",
        score,
        historyScore: evaluation.history,
        physicalScore: evaluation.physical,
        examsScore: evaluation.exams,
        reasoningScore: evaluation.reasoning,
      }),
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("semiolab:learning-updated"));
    }).catch(() => {});
    setPhase("result");
  }
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
              <b>{evaluation.history}<em>/40</em></b>
              <small>Anamnese</small><i style={{ width: `${evaluation.history / 40 * 100}%` }} />
            </span>
            <span>
              <b>{evaluation.physical}<em>/15</em></b>
              <small>Exame físico</small><i style={{ width: `${evaluation.physical / 15 * 100}%` }} />
            </span>
            <span>
              <b>{evaluation.exams}<em>/15</em></b>
              <small>Exames</small><i style={{ width: `${evaluation.exams / 15 * 100}%` }} />
            </span>
            <span>
              <b>{evaluation.reasoning}<em>/30</em></b>
              <small>Raciocínio</small><i style={{ width: `${evaluation.reasoning / 30 * 100}%` }} />
            </span>
          </div>
          <div className="feedback">
            <article>
              <h3>
                <Check /> O que você conduziu bem
              </h3>
              <ul>{evaluation.strengths.length ? evaluation.strengths.map((item) => <li key={item}>{item}</li>) : <li>Não houve evidência suficiente para pontuar esta parte.</li>}</ul>
            </article>
            <article>
              <h3>
                <CircleAlert /> O que faltou investigar
              </h3>
              <ul>{evaluation.gaps.length ? evaluation.gaps.map((item) => <li key={item}>{item}</li>) : <li>Os principais critérios deste caso foram cobertos.</li>}</ul>
            </article>
          </div>
          <section className="clinical-learning">
            <header><Lightbulb /><span><small>APRENDIZADO DO CASO</small><h2>Como conectar os achados</h2></span></header>
            <p>Dispneia aos esforços, ortopneia, dispneia paroxística noturna, edema e ganho de peso formam um padrão de congestão. No exame, B3, turgência jugular, crepitações e edema reforçam insuficiência cardíaca descompensada.</p>
            <div>
              {evaluation.examLearning.map((item) => <p key={item}><Check />{item}</p>)}
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
            onClick={() => {
              setPhysical(true);
              setPhysicalOpen(true);
            }}
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
            <div className="vitals">
              <span>
                <b>158/96</b>
                <small>PA mmHg</small>
              </span>
              <span>
                <b>104</b>
                <small>FC bpm</small>
              </span>
              <span>
                <b>24</b>
                <small>FR irpm</small>
              </span>
              <span>
                <b>92%</b>
                <small>SpO₂</small>
              </span>
            </div>
            <p>
              <b>Cardiovascular:</b> ritmo regular, B3 presente, turgência
              jugular a 45°.
            </p>
            <p>
              <b>Respiratório:</b> crepitações bibasais, sem sibilos.
            </p>
            <p>
              <b>Extremidades:</b> edema bilateral 2+/4+, perfusão preservada.
            </p>
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
