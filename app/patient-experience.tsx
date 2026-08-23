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
  LockKeyhole,
  Mic,
  NotebookPen,
  Plus,
  Send,
  ShieldCheck,
  Stethoscope,
  Square,
  Video,
  Volume2,
  X,
} from "lucide-react";

import { useUser } from "./user-context";
import { useLearningSummary } from "./use-learning-summary";
import { openProUpgradeModal, openDailyLimitInfo } from "./pro-upgrade-modal";

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
  licenseUrl?: string;
  examId?: string;
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
  id?: string;
};
type ConsultHistory = {
  id: string;
  finishedAt: number;
  score: number;
  level: string;
  title: string;
  patientName: string;
  patientAge: number;
  hypothesis: string;
  strengths: string[];
  gaps: string[];
  examLearning: string[];
};
const PATIENT_SESSION_VERSION = 4;
const patientSessionKey = (userId: string) => `semiolab:${userId}:patient-session:v4`;
const patientHistoryKey = (userId: string) => `semiolab:${userId}:consult-history:v1`;
// Chaves de versões anteriores (globais, sem isolamento por usuário) — devem
// ser removidas incondicionalmente para não vazar dados entre contas.
const LEGACY_GLOBAL_KEYS = ["semiolab:patient-session:v2", "semiolab:patient-session:v3", "semiolab:consult-history:v1"];

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
    [physical, setPhysical] = useState(false),
    [physicalOpen, setPhysicalOpen] = useState(false),
    [physicalFindings, setPhysicalFindings] = useState<Record<string, string>>({}),
    [examOpen, setExamOpen] = useState(false),
    [zoomedImage, setZoomedImage] = useState<ExamImage | null>(null),
    [recording, setRecording] = useState(false),
    [transcribing, setTranscribing] = useState(false),
    [micError, setMicError] = useState(""),
    [playingMessageId, setPlayingMessageId] = useState<string | null>(null),
    [loadingAudioMessageId, setLoadingAudioMessageId] = useState<string | null>(null),
    [examText, setExamText] = useState(""),
    [examOrder, setExamOrder] = useState(""),
    [typing, setTyping] = useState(false),
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
    [caseInfo, setCaseInfo] = useState<{ title: string; specialty: string; receptionReason: string; patientName: string; patientAge: number } | null>(null),
    [loadError, setLoadError] = useState(""),
    [finishing, setFinishing] = useState(false),
    [quota, setQuota] = useState<{ questionsUsed: number; questionsLimit: number; sessionsUsedToday: number; sessionsLimitToday: number } | null>(null),
    [serverEvaluation, setServerEvaluation] = useState<{
      score: number; historyScore: number; physicalScore: number; examsScore: number; reasoningScore: number;
      strengths: string[]; gaps: string[]; examLearning: string[]; feedback: string; correctDiagnosis: string;
    } | null>(null);
  const chatRef = useRef<HTMLElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef(0);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  // Cache em memória do áudio já gerado por mensagem — nunca localStorage,
  // e some quando a página é recarregada/fechada. Evita gerar (e cobrar) o
  // TTS de novo em cliques repetidos no mesmo "Ouvir resposta".
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const user = useUser();
  const { summary: learning } = useLearningSummary();
  const sessionStorageKey = patientSessionKey(user.id);
  const historyStorageKey = patientHistoryKey(user.id);

  useEffect(() => {
    try {
      // Versões antigas/globais (sem isolamento por usuário) — remove
      // incondicionalmente para não vazar dados entre contas no mesmo navegador.
      LEGACY_GLOBAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
      const saved = window.localStorage.getItem(sessionStorageKey);
      if (saved) {
        const session = JSON.parse(saved);
        const hasValidSession =
          session.version === PATIENT_SESSION_VERSION &&
          session.userId === user.id &&
          typeof session.sessionId === "string" &&
          session.sessionId.length > 0 &&
          session.caseInfo &&
          typeof session.caseInfo.receptionReason === "string";
        // Estado antigo/incompatível, de outro usuário, ou corrompido: sem
        // sessionId válido do MESMO usuário autenticado não há como
        // continuar a conversa — descarta e volta para a tela de espera, em
        // vez de travar o envio de mensagens ou vazar dados entre contas.
        if (session.phase && session.phase !== "result" && (session.phase === "wait" || hasValidSession)) {
          setPhase(session.phase);
        }
        if (hasValidSession) {
          setSessionId(session.sessionId);
          setCaseInfo(session.caseInfo);
        }
        if (Array.isArray(session.messages) && (session.phase === "wait" || hasValidSession)) {
          const base = Date.now() - session.messages.length * 60_000;
          setMessages(session.messages.map((message: Message, index: number) => ({
            ...message,
            createdAt: message.createdAt || base + index * 60_000,
          })));
        }
        if (typeof session.physical === "boolean") setPhysical(session.physical);
        if (typeof session.examText === "string") setExamText(session.examText);
        if (typeof session.examOrder === "string") setExamOrder(session.examOrder);
        if (typeof session.notes === "string") setNotes(session.notes);
        if (typeof session.hypothesis === "string") setHypothesis(session.hypothesis);
        if (typeof session.differentials === "string") setDifferentials(session.differentials);
        if (typeof session.conduct === "string") setConduct(session.conduct);
        if (!hasValidSession && session.phase && session.phase !== "wait") {
          window.localStorage.removeItem(sessionStorageKey);
        }
      }
      const savedHistory = window.localStorage.getItem(historyStorageKey);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed.slice(0, 12));
      }
    } catch {
      window.localStorage.removeItem(sessionStorageKey);
    } finally {
      setRestored(true);
    }
  }, [user.id, sessionStorageKey, historyStorageKey]);

  // Fonte definitiva do histórico: sempre o Supabase (filtrado por dono via
  // RLS), nunca só o localStorage. Assim que o resumo carrega, ele
  // substitui qualquer cache local — inclusive um cache vazio ou de outra
  // sessão anterior — garantindo que nada se perca ao trocar de conta ou
  // limpar o navegador.
  useEffect(() => {
    if (!learning?.recentConsultations) return;
    const fromServer: ConsultHistory[] = learning.recentConsultations.map((item) => ({
      id: item.id,
      finishedAt: item.finishedAt ?? Date.now(),
      score: item.score,
      level: item.level,
      title: item.title,
      patientName: item.patientName,
      patientAge: item.patientAge,
      hypothesis: item.hypothesis,
      strengths: item.strengths,
      gaps: item.gaps,
      examLearning: item.examLearning,
    }));
    setHistory(fromServer);
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(fromServer));
    } catch { /* cache é só otimização; falha aqui não é crítica */ }
  }, [learning?.recentConsultations, historyStorageKey]);

  useEffect(() => {
    if (!restored) return;
    if (phase === "result") {
      window.localStorage.removeItem(sessionStorageKey);
      return;
    }
    if (phase === "wait" && messages.length === 0) return;
    if (phase !== "wait" && !sessionId) return;
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify({
        version: PATIENT_SESSION_VERSION,
        userId: user.id,
        phase,
        messages,
        sessionId,
        caseInfo,
        physical,
        examText,
        examOrder,
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
    sessionId,
    caseInfo,
    physical,
    examText,
    examOrder,
    notes,
    hypothesis,
    differentials,
    conduct,
    user.id,
    sessionStorageKey,
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
    // Free nunca chega a chamar a API: nem cria sessão, nem gasta o
    // atendimento — só abre o modal compartilhado.
    if (learning?.pro?.tier === "free") {
      openProUpgradeModal("patient");
      return;
    }
    setTyping(false);
    setPhysical(false);
    setExamOrder("");
    setExamText("");
    setHypothesis("");
    setDifferentials("");
    setConduct("");
    setNotes("");
    setServerEvaluation(null);
    setLoadError("");
    setMessages([]);
    setPhase("chat");
    try {
      const response = await fetch("/api/patient/session", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403 && data.limitReached) {
        setPhase("wait");
        if (learning?.pro?.tier === "pro") openDailyLimitInfo();
        else openProUpgradeModal("limit");
        return;
      }
      if (!response.ok) {
        setLoadError(data.error || "Não foi possível iniciar o atendimento.");
        return;
      }
      setSessionId(data.sessionId);
      setCaseInfo({
        title: data.caseTitle,
        specialty: data.specialty,
        receptionReason: data.receptionReason,
        patientName: data.patientName,
        patientAge: data.patientAge,
      });
      setQuota({
        questionsUsed: data.questionsUsed ?? 0,
        questionsLimit: data.questionsLimit ?? 20,
        sessionsUsedToday: data.sessionsUsedToday ?? 1,
        sessionsLimitToday: data.sessionsLimitToday ?? 3,
      });
      setMessages([{ who: "patient", text: data.openingLine, createdAt: Date.now() }]);
    } catch {
      setLoadError("Não foi possível conectar ao servidor. Tente novamente.");
    }
  }
  function resetToWaitDueToInvalidSession(message: string) {
    // O servidor é a fonte de verdade: se a sessão não pertence mais ao
    // usuário autenticado ou já foi encerrada, descarta o estado local
    // imediatamente e volta para a tela de "chamar próximo paciente" — nunca
    // deixa o estudante preso numa conversa que o servidor já rejeitou.
    localStorage.removeItem(sessionStorageKey);
    setSessionId(null);
    setCaseInfo(null);
    setMessages([]);
    setPhase("wait");
    setLoadError(message);
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
      if (response.status === 404) {
        setTyping(false);
        resetToWaitDueToInvalidSession("Esta consulta não está mais disponível. Chame um novo paciente.");
        return;
      }
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        setMessages((m) => [...m, { who: "patient", text: data.error || "Não consegui responder agora.", createdAt: Date.now() }]);
        setTyping(false);
        return;
      }
      const used = Number(response.headers.get("X-Questions-Used"));
      const limit = Number(response.headers.get("X-Questions-Limit"));
      if (Number.isFinite(used) && used > 0) {
        setQuota((q) => (q ? { ...q, questionsUsed: used, questionsLimit: limit || q.questionsLimit } : q));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      const createdAt = Date.now();
      setMessages((m) => [...m, { who: "patient", text: "", createdAt }]);
      const stripMarker = (text: string) => {
        const markerIndex = text.indexOf("\u0000MSGID:");
        if (markerIndex === -1) return { clean: text, id: undefined as string | undefined };
        return { clean: text.slice(0, markerIndex), id: text.slice(markerIndex + 7).trim() };
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const { clean } = stripMarker(full);
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.who === "patient" && last.createdAt === createdAt) next[next.length - 1] = { ...last, text: clean };
          return next;
        });
      }
      // Descarrega quaisquer bytes UTF-8 pendentes no buffer do decoder (ex.:
      // um caractere acentuado partido entre dois chunks no fim do stream) —
      // sem isso, o último caractere/palavra podia ficar cortado.
      full += decoder.decode();
      const { clean: finalText, id: messageId } = stripMarker(full);
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.who === "patient" && last.createdAt === createdAt) next[next.length - 1] = { ...last, text: finalText, id: messageId };
        return next;
      });
    } catch {
      setMessages((m) => [...m, { who: "patient", text: "Desculpa, tive um problema para responder.", createdAt: Date.now() }]);
    } finally {
      setTyping(false);
    }
  }
  const MAX_RECORDING_MS = 30_000;
  const MAX_RECORDING_BYTES = 2 * 1024 * 1024;

  async function startRecording() {
    setMicError("");
    if (typing || recording || transcribing) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMicError("Gravação de voz não é suportada neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = ["audio/webm", "audio/ogg", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      recorder.start();
      setRecording(true);
      window.setTimeout(() => {
        if (mediaRecorderRef.current === recorder && recorder.state === "recording") stopRecording();
      }, MAX_RECORDING_MS);
    } catch {
      setMicError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setRecording(false);
    const durationSeconds = Math.min(30, (Date.now() - recordingStartRef.current) / 1000);
    recorder.addEventListener(
      "stop",
      async () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        mediaRecorderRef.current = null;
        if (blob.size === 0) return;
        if (blob.size > MAX_RECORDING_BYTES) {
          setMicError("Gravação maior que 2 MB. Tente uma pergunta mais curta.");
          return;
        }
        if (!sessionId) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("sessionId", sessionId);
          form.append("durationSeconds", String(durationSeconds));
          form.append("audio", blob, "gravacao.webm");
          const response = await fetch("/api/patient/transcribe", { method: "POST", body: form });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            setMicError(data.error || "Não foi possível transcrever o áudio.");
            return;
          }
          // A transcrição só preenche o campo para revisão — não envia
          // sozinha, e não consome nenhuma das 20 perguntas ainda.
          setInput((current) => (current ? `${current} ${data.transcript}`.trim() : data.transcript || ""));
        } catch {
          setMicError("Não foi possível transcrever o áudio agora. Digite sua pergunta.");
        } finally {
          setTranscribing(false);
        }
      },
      { once: true },
    );
    recorder.stop();
  }

  async function playPatientAudio(message: Message) {
    if (!message.id || !sessionId) return;
    // Reaproveita o áudio já gerado nesta página, sem nova cobrança.
    const cached = audioCacheRef.current.get(message.id);
    if (cached) {
      currentAudioRef.current?.pause();
      const audio = new Audio(cached);
      currentAudioRef.current = audio;
      setPlayingMessageId(message.id);
      audio.onended = () => setPlayingMessageId(null);
      audio.play().catch(() => setPlayingMessageId(null));
      return;
    }
    setLoadingAudioMessageId(message.id);
    try {
      const response = await fetch("/api/patient/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, messageId: message.id }),
      });
      if (!response.ok) {
        setMicError("Não foi possível gerar o áudio desta resposta agora.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioCacheRef.current.set(message.id, url);
      currentAudioRef.current?.pause();
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      setPlayingMessageId(message.id);
      audio.onended = () => setPlayingMessageId(null);
      audio.play().catch(() => setPlayingMessageId(null));
    } catch {
      setMicError("Não foi possível gerar o áudio desta resposta agora.");
    } finally {
      setLoadingAudioMessageId(null);
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
      if (response.status === 404) {
        resetToWaitDueToInvalidSession("Esta consulta não está mais disponível. Chame um novo paciente.");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessages((m) => [...m, { who: "patient", text: data.error || "Não foi possível liberar o exame.", createdAt: Date.now() }]);
        return;
      }
      setMessages((m) => [...m, { who: "exam", text: "RESULTADOS LIBERADOS", report: data.report, createdAt: Date.now() }]);
      // Busca imagens educacionais reais para cada exame de imagem liberado
      // (só entrega porque o exame já foi solicitado nesta sessão — ver
      // gate em /api/patient/exam-image). Sem imagem cadastrada, o laudo
      // em texto continua exatamente como já funcionava.
      const imagingWithId: { title: string; examId: string }[] = (data.report?.imaging ?? []).filter(
        (e: { examId?: string }) => e.examId,
      );
      for (const item of imagingWithId) {
        fetch("/api/patient/exam-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, examId: item.examId }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((imgData) => {
            const firstImage = imgData?.images?.[0];
            if (!firstImage) return;
            setMessages((m) =>
              m.map((msg) =>
                msg.report
                  ? {
                      ...msg,
                      report: {
                        ...msg.report,
                        imaging: msg.report.imaging.map((exam) =>
                          exam.examId === item.examId
                            ? {
                                ...exam,
                                image: firstImage.url,
                                caption: firstImage.caption,
                                source: firstImage.author,
                                sourceUrl: firstImage.sourceUrl,
                                license: firstImage.license,
                                licenseUrl: firstImage.licenseUrl,
                              }
                            : exam,
                        ),
                      },
                    }
                  : msg,
              ),
            );
          })
          .catch(() => {});
      }
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
      if (response.status === 404) {
        setPhysicalOpen(false);
        resetToWaitDueToInvalidSession("Esta consulta não está mais disponível. Chame um novo paciente.");
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok) setPhysicalFindings(data.physicalExam || {});
    } catch {
      /* mantém o modal com estado vazio; não é crítico */
    }
  }
  function finishConsult() {
    if (finishing) return; // já em andamento — evita disparo duplo, sem precisar de feedback extra
    if (!hypothesis.trim() || !conduct.trim()) {
      setLoadError("Preencha a hipótese principal e a conduta inicial para concluir.");
      return;
    }
    if (!sessionId) {
      setLoadError("Sessão não encontrada. Volte e chame o paciente novamente.");
      return;
    }
    setLoadError("");
    setFinishing(true);
    fetch("/api/patient/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, hypothesis, differentials, conduct }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404) {
          setFinishing(false);
          resetToWaitDueToInvalidSession("Esta consulta não está mais disponível.");
          return;
        }
        if (!response.ok) {
          const safeCode = typeof data.code === "string" ? data.code : null;
          const message = data.error || "Não foi possível avaliar o atendimento.";
          setLoadError(safeCode ? `${message} [${safeCode}]` : message);
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
          patientName: caseInfo?.patientName || "Paciente",
          patientAge: caseInfo?.patientAge || 0,
          hypothesis: hypothesis.trim(),
          strengths: data.strengths,
          gaps: data.gaps,
          examLearning: data.examLearning,
        };
        const next = [record, ...history].slice(0, 12);
        setHistory(next);
        window.localStorage.setItem(historyStorageKey, JSON.stringify(next));
        window.dispatchEvent(new Event("semiolab:learning-updated"));
        setFinishing(false);
        setPhase("result");
      })
      .catch(() => {
        setLoadError("Não foi possível conectar ao servidor para avaliar o atendimento.");
        setFinishing(false);
      });
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
                      <b>{item.patientName ? `${item.patientName} · ${item.patientAge} anos` : item.title}</b>
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
              <p><b>{level}</b> · Caso esperado: {serverEvaluation?.correctDiagnosis || caseInfo?.title || "—"}.</p>
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
            <p>{serverEvaluation?.feedback || "Reveja os achados que você coletou nesta consulta e compare com o raciocínio clínico esperado para o caso."}</p>
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
  const patientName = caseInfo?.patientName || "Paciente";
  const patientInitials = patientName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P";
  return (
    <div className="consult">
      <header>
        <button aria-label="Voltar" onClick={() => go("home")}>
          <ArrowLeft />
        </button>
        <div className="patient-chat-identity">
          <i className="patient-avatar">{patientInitials}<small /></i>
          <span>
            <b>{patientName}</b>
            <small>{caseInfo?.patientAge ? `${caseInfo.patientAge} anos · online agora` : "online agora"}</small>
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
      </header>
      <main ref={chatRef}>
        <section className="patient-chat-profile">
          <i className="patient-profile-avatar">{patientInitials}<span /></i>
          <b>{patientName}</b>
          <small>
            {quota
              ? `Pergunta ${quota.questionsUsed} de ${quota.questionsLimit} · ${quota.sessionsUsedToday} de ${quota.sessionsLimitToday} atendimentos usados hoje`
              : "Consulta simulada · Atendimento em andamento"}
          </small>
        </section>
        <div className="chat-day">
          <span>{today}</span>
        </div>
        <div className="reason">
          <FileHeart />
          <span>
            <small>MOTIVO INFORMADO NA RECEPÇÃO</small>
            <p>“{caseInfo?.receptionReason || "Não informado"}.”</p>
          </span>
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            <i>
              {m.who === "patient" ? (
                patientInitials
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
                        <button
                          type="button"
                          className="exam-image-zoom-trigger"
                          onClick={() => setZoomedImage(exam)}
                          aria-label={`Ampliar imagem: ${exam.title}`}
                        >
                          <img
                            src={exam.image}
                            alt={`Imagem clínica de referência: ${exam.title}`}
                          />
                        </button>
                        <figcaption>
                          <span>Imagem educacional representativa{exam.caption ? ` · ${exam.caption}` : ""}</span>
                          {exam.source && exam.sourceUrl && (
                            <a href={exam.sourceUrl} target="_blank" rel="noopener noreferrer">
                              Fonte e licença: {exam.source} · {exam.license}
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
                {m.who === "patient" && m.id && learning?.pro?.tier === "pro" && (
                  <button
                    type="button"
                    className="listen-response-btn"
                    onClick={() => playPatientAudio(m)}
                    disabled={loadingAudioMessageId === m.id}
                    aria-label="Ouvir resposta gerada por inteligência artificial"
                  >
                    <Volume2 />
                    {loadingAudioMessageId === m.id ? "Gerando áudio..." : playingMessageId === m.id ? "Tocando..." : "Ouvir resposta (voz por IA)"}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="msg patient typing-message" aria-label="Paciente digitando">
            <i>{patientInitials}</i>
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
          <button className="consult-finish-btn" onClick={() => setPhase("finish")}>
            <Check /> Finalizar
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
            onKeyDown={(e) => e.key === "Enter" && !typing && send()}
            placeholder={transcribing ? "Transcrevendo áudio..." : typing ? "Aguardando resposta do paciente..." : "Faça uma pergunta ao paciente..."}
            disabled={typing || transcribing}
            maxLength={500}
          />
          {learning?.pro?.tier === "pro" ? (
            <button
              className={`chat-mic ${recording ? "is-recording" : ""}`}
              aria-label={recording ? "Parar gravação" : "Gravar pergunta por voz"}
              disabled={typing || transcribing}
              onClick={recording ? stopRecording : startRecording}
              type="button"
            >
              {recording ? <Square /> : <Mic />}
            </button>
          ) : (
            // Sempre visível para contas Free/trial (nunca escondido), mas
            // travado: mostra o aviso de upsell em vez de gravar. Enquanto o
            // status Pro ainda está carregando, também fica neste estado
            // travado por padrão — nunca mostra o microfone funcional antes
            // de confirmar de verdade que a conta é Pro.
            <button
              className="chat-mic is-locked"
              aria-label="Conversa por voz — recurso do plano Pro"
              onClick={() => openProUpgradeModal("audio")}
              type="button"
            >
              <Mic /><LockKeyhole className="chat-mic-lock-badge" />
            </button>
          )}
          <button aria-label="Enviar pergunta" disabled={!input.trim() || typing || transcribing} onClick={send}>
            <Send />
          </button>
        </label>
        {micError && <div role="alert" className="patient-load-error">{micError}</div>}
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
      {zoomedImage && (
        <div className="overlay" onClick={() => setZoomedImage(null)}>
          <section className="clinical-modal exam-image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setZoomedImage(null)}><X /></button>
            <small>{zoomedImage.title}</small>
            <img src={zoomedImage.image} alt={`Imagem clínica de referência: ${zoomedImage.title}`} />
            <p className="exam-image-modal-caption">
              Imagem educacional representativa{zoomedImage.caption ? ` · ${zoomedImage.caption}` : ""}
            </p>
            {zoomedImage.source && (
              <p className="exam-image-modal-license">
                <b>Fonte e licença:</b> {zoomedImage.source} · {zoomedImage.license}
                {zoomedImage.licenseUrl && (
                  <> · <a href={zoomedImage.licenseUrl} target="_blank" rel="noopener noreferrer">ver licença</a></>
                )}
                {zoomedImage.sourceUrl && (
                  <> · <a href={zoomedImage.sourceUrl} target="_blank" rel="noopener noreferrer">ver origem</a></>
                )}
              </p>
            )}
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
            {loadError && (
              <div role="alert" className="patient-load-error">
                {loadError}
                <button type="button" onClick={() => { setLoadError(""); finishConsult(); }}>Tentar novamente</button>
              </div>
            )}
            <button className="primary" disabled={!hypothesis.trim() || !conduct.trim() || finishing} onClick={finishConsult}>
              {finishing ? "Avaliando consulta..." : <>Finalizar e receber avaliação <ChevronRight /></>}
            </button>
            {!finishing && (!hypothesis.trim() || !conduct.trim()) && <p className="finish-required">Preencha a hipótese principal e a conduta inicial para concluir.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
