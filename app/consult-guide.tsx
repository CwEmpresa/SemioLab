"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Compass, Timer } from "lucide-react";
import "./consult-guide.css";

/** Como o estudante quer conduzir a consulta:
 *  - guided: roteiro de anamnese visível, com sugestões de pergunta — para
 *    quem está começando e trava diante do paciente;
 *  - free: sem pistas (o comportamento original);
 *  - osce: sem pistas e com cronômetro, como numa estação de prova prática. */
export type ConsultMode = "guided" | "free" | "osce";

export const OSCE_SECONDS = 10 * 60;

export const consultModeKey = (userId: string) => `semiolab:${userId}:consult-mode`;

export function readConsultMode(userId: string): ConsultMode | null {
  try {
    const saved = window.localStorage.getItem(consultModeKey(userId));
    return saved === "guided" || saved === "free" || saved === "osce" ? saved : null;
  } catch {
    return null;
  }
}

const MODES: { id: ConsultMode; label: string; detail: string }[] = [
  { id: "guided", label: "Guiada", detail: "Roteiro da anamnese e sugestões de pergunta na tela" },
  { id: "free", label: "Livre", detail: "Sem pistas: você conduz tudo sozinho" },
  { id: "osce", label: "Prova prática", detail: "Sem pistas e com 10 minutos, como numa estação de OSCE" },
];

export function ConsultModePicker({ mode, onChange }: { mode: ConsultMode; onChange: (mode: ConsultMode) => void }) {
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  return (
    <div className="cg-mode-picker" role="radiogroup" aria-label="Modo da consulta">
      <small>Modo da consulta</small>
      <div>
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            className={mode === m.id ? "active" : ""}
            onClick={() => onChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p>{current.detail}</p>
    </div>
  );
}

type Stage = { id: string; label: string; match: RegExp; suggestions: string[] };

/* Roteiro genérico de anamnese — o mesmo para qualquer caso, então não
   entrega nada sobre o diagnóstico. As sugestões são perguntas abertas: o
   estudante escolhe, edita e envia. */
const STAGES: Stage[] = [
  {
    id: "id",
    label: "Identificação",
    match: /\b(nome|se chama|idade|quantos anos|profissao|trabalha|mora|casad|estado civil|natural de)/,
    suggestions: ["Como você se chama e quantos anos tem?", "Com o que você trabalha?"],
  },
  {
    id: "qp",
    label: "Queixa e duração",
    match: /\b(trouxe|traz|motivo|sentindo|incomoda|queixa|ha quanto tempo|quando comecou|desde quando|comecou)/,
    suggestions: ["O que trouxe você aqui hoje?", "Há quanto tempo isso começou?"],
  },
  {
    id: "hda",
    label: "História atual",
    match: /\b(como e|descrev|melhora|piora|intensidade|forte|irradia|espalha|onde|local|frequencia|junto|acompanha|mais algum|outro sintoma|febre|nausea|vomito|falta de ar|tosse|tontura)/,
    suggestions: [
      "Pode me descrever melhor como é esse sintoma?",
      "Tem alguma coisa que melhora ou piora?",
      "Sentiu mais alguma coisa junto com isso?",
    ],
  },
  {
    id: "ap",
    label: "Antecedentes e remédios",
    match: /\b(doenca|problema de saude|pressao alta|hipertens|diabet|remedio|medica|alergi|cirurgi|internad|operad|tratamento)/,
    suggestions: [
      "Você tem alguma doença, como pressão alta ou diabetes?",
      "Usa algum remédio todos os dias?",
      "Tem alergia a algum medicamento?",
    ],
  },
  {
    id: "hab",
    label: "Hábitos de vida",
    match: /\b(fuma|cigarro|tabag|bebe|bebida|alcool|droga|alimenta|comer|sono|dorme|exercicio|atividade fisica)/,
    suggestions: ["Você fuma ou bebe?", "Como estão sua alimentação e seu sono?"],
  },
  {
    id: "hf",
    label: "História familiar",
    match: /\b(famil|pai|mae|irmao|irma|avo|parente)/,
    suggestions: ["Alguém na sua família tem ou teve um problema parecido?"],
  },
];

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Roteiro de anamnese acima do campo de pergunta. Marca cada etapa como
 * coberta a partir das perguntas que o próprio estudante já fez. */
export default function ConsultGuide({
  studentMessages,
  physicalDone,
  examsDone,
  disabled,
  onPick,
  onHeight,
}: {
  studentMessages: string[];
  physicalDone: boolean;
  examsDone: boolean;
  disabled: boolean;
  onPick: (text: string) => void;
  /** Altura atual do roteiro: o rodapé da consulta é fixo, então a tela
   * reserva esse espaço no fim da conversa para nada ficar encoberto. */
  onHeight?: (height: number) => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !onHeight || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => onHeight(el.offsetHeight + 8));
    observer.observe(el);
    return () => {
      observer.disconnect();
      onHeight(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [picked, setPicked] = useState<string | null>(null);

  const done = useMemo(() => {
    const text = normalize(studentMessages.join(" \n "));
    return new Set(STAGES.filter((stage) => stage.match.test(text)).map((stage) => stage.id));
  }, [studentMessages]);

  const nextStage = STAGES.find((stage) => !done.has(stage.id));
  const activeStage = STAGES.find((stage) => stage.id === picked) ?? nextStage ?? null;
  const allDone = !nextStage;

  return (
    <section ref={rootRef} className={`cg-guide ${open ? "open" : ""}`} aria-label="Roteiro da anamnese">
      <button type="button" className="cg-guide-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Compass />
        <b>Roteiro da anamnese</b>
        <span>{done.size} de {STAGES.length}</span>
        {open ? <ChevronDown /> : <ChevronUp />}
      </button>
      {open && (
        <>
          <div className="cg-stages" role="tablist">
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={activeStage?.id === stage.id}
                className={`${done.has(stage.id) ? "done" : ""} ${activeStage?.id === stage.id ? "active" : ""}`}
                onClick={() => setPicked(stage.id)}
              >
                {done.has(stage.id) && <Check />}
                {stage.label}
              </button>
            ))}
          </div>
          {activeStage && !(allDone && !picked) ? (
            <div className="cg-suggestions">
              {activeStage.suggestions.map((text) => (
                <button key={text} type="button" disabled={disabled} onClick={() => onPick(text)}>
                  {text}
                </button>
              ))}
            </div>
          ) : (
            <p className="cg-next">
              Anamnese coberta.{" "}
              {!physicalDone
                ? "Agora faça o exame físico."
                : !examsDone
                  ? "Peça os exames que ajudam a confirmar sua hipótese."
                  : "Quando tiver uma hipótese, toque em Finalizar."}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function OsceTimer({ secondsLeft }: { secondsLeft: number }) {
  const safe = Math.max(0, secondsLeft);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return (
    <span className={`cg-timer ${safe <= 60 ? "ending" : ""}`} role="timer" aria-label={`Tempo restante: ${minutes} minutos e ${seconds} segundos`}>
      <Timer /> {minutes}:{seconds}
    </span>
  );
}
