"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import xray from "../../public/clinical/radiografia-ic-congestiva.png";
import ecg from "../../public/clinical/ecg-hve.jpg";

const EASE = [0.22, 1, 0.36, 1] as const;
const MAX_QUESTIONS = 3;
const MAX_EXAMS = 2;

/* As quatro pistas que fecham o caso. O resultado mostra quais a pessoa
   achou e quais deixou passar, a mesma correção que o app faz no fim de
   cada atendimento. */
const KEY_CLUES = [
  { id: "ortopneia", label: "Ortopneia", miss: "Não perguntou se piora ao deitar." },
  { id: "edema", label: "Edema de membros", miss: "Não perguntou sobre inchaço nas pernas." },
  { id: "has", label: "Hipertensão sem tratamento", miss: "Não investigou os antecedentes." },
  { id: "congestao", label: "Congestão no raio-X", miss: "Não pediu a radiografia de tórax." },
] as const;

type ClueId = (typeof KEY_CLUES)[number]["id"];

const QUESTIONS: { id: string; q: string; a: string; clue?: ClueId }[] = [
  { id: "deita", q: "Piora quando a senhora deita?", a: "Piora. Durmo com dois travesseiros, senão acordo sem ar.", clue: "ortopneia" },
  { id: "tosse", q: "Tem tosse com catarro?", a: "Quase nada de tosse, doutor. É o fôlego mesmo." },
  { id: "pernas", q: "As pernas incham no fim do dia?", a: "Todo dia. No fim da tarde a meia fica marcando a perna.", clue: "edema" },
  { id: "febre", q: "Teve febre esses dias?", a: "Febre não. Só esse cansaço." },
  { id: "pressao", q: "Tem algum problema de saúde?", a: "Pressão alta. Mas parei o remédio no começo do ano.", clue: "has" },
  { id: "fuma", q: "A senhora fuma?", a: "Fumei uns dez anos. Parei faz vinte." },
];

const EXAMS: { id: string; name: string; result: string; image?: StaticImageData; alt?: string; credit?: string; clue?: ClueId }[] = [
  {
    id: "rx",
    name: "Radiografia de tórax",
    result: "Cardiomegalia, congestão hilar bilateral e linhas B de Kerley.",
    image: xray,
    alt: "Radiografia de tórax com área cardíaca aumentada e congestão pulmonar",
    credit: "James Heilman, MD, CC BY-SA 4.0",
    clue: "congestao",
  },
  {
    id: "ecg",
    name: "Eletrocardiograma",
    result: "Ritmo sinusal, 104 bpm. Critérios de sobrecarga ventricular esquerda.",
    image: ecg,
    alt: "Eletrocardiograma de 12 derivações com sinais de sobrecarga ventricular esquerda",
    credit: "M. Rosengarten, ECGpedia, CC BY-SA 3.0",
  },
  { id: "hemo", name: "Hemograma", result: "Hb 12,8 g/dL. Leucócitos 7.900, sem desvio." },
];

const DIAGNOSES = [
  { id: "ic", name: "Insuficiência cardíaca descompensada", correct: true },
  { id: "dpoc", name: "DPOC exacerbada", correct: false },
  { id: "pac", name: "Pneumonia comunitária", correct: false },
  { id: "tep", name: "Tromboembolismo pulmonar", correct: false },
];

type Msg =
  | { kind: "them" | "me"; text: string }
  | { kind: "exam"; name: string; text: string; image?: StaticImageData; alt?: string; credit?: string };

type Stage = "ask" | "exam" | "dx" | "result";

const OPENING: Msg = {
  kind: "them",
  text: "Doutor, tô com falta de ar até pra tomar banho. E as pernas não param de inchar.",
};

/** Traço de ECG de um batimento, repetido para preencher a faixa. */
function beatPath(beats: number, w = 64) {
  let d = "M0 24";
  for (let i = 0; i < beats; i++) {
    const x = i * w;
    d += ` L${x + 8} 24 Q${x + 12} 18 ${x + 16} 24 L${x + 21} 24 L${x + 23} 28 L${x + 26} 3 L${x + 29} 34 L${x + 31} 24 L${x + 40} 24 Q${x + 46} 14 ${x + 52} 24 L${x + w} 24`;
  }
  return d;
}
const TRACE = beatPath(12);

/**
 * Consulta jogável: a pessoa atende a Marta (caso 1 do app) antes de criar a
 * conta. Três perguntas, dois exames e uma hipótese, com a correção
 * mostrando as pistas que ficaram para trás.
 */
export default function Bedside() {
  const reduced = useReducedMotion();
  const [log, setLog] = useState<Msg[]>([OPENING]);
  const [asked, setAsked] = useState<string[]>([]);
  const [examsDone, setExamsDone] = useState<string[]>([]);
  const [clues, setClues] = useState<ClueId[]>([]);
  const [stage, setStage] = useState<Stage>("ask");
  const [typing, setTyping] = useState(false);
  const [dx, setDx] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [log, typing, reduced]);

  const reply = (msg: Msg, after: () => void) => {
    setTyping(true);
    timer.current = window.setTimeout(
      () => {
        setTyping(false);
        setLog((l) => [...l, msg]);
        after();
      },
      reduced ? 150 : 850,
    );
  };

  const ask = (id: string) => {
    if (typing) return;
    const item = QUESTIONS.find((q) => q.id === id)!;
    const nextAsked = [...asked, id];
    setAsked(nextAsked);
    setLog((l) => [...l, { kind: "me", text: item.q }]);
    reply({ kind: "them", text: item.a }, () => {
      if (item.clue) setClues((c) => [...c, item.clue!]);
      if (nextAsked.length >= MAX_QUESTIONS) setStage("exam");
    });
  };

  const order = (id: string) => {
    if (typing) return;
    const exam = EXAMS.find((e) => e.id === id)!;
    const nextDone = [...examsDone, id];
    setExamsDone(nextDone);
    setLog((l) => [...l, { kind: "me", text: `Vou pedir ${exam.name.toLowerCase()}.` }]);
    reply(
      { kind: "exam", name: exam.name, text: exam.result, image: exam.image, alt: exam.alt, credit: exam.credit },
      () => {
        if (exam.clue) setClues((c) => [...c, exam.clue!]);
        if (nextDone.length >= MAX_EXAMS) setStage("dx");
      },
    );
  };

  const decide = (id: string) => {
    setDx(id);
    setStage("result");
  };

  const restart = () => {
    window.clearTimeout(timer.current);
    setLog([OPENING]);
    setAsked([]);
    setExamsDone([]);
    setClues([]);
    setStage("ask");
    setTyping(false);
    setDx(null);
  };

  const chosen = DIAGNOSES.find((d) => d.id === dx);
  const found = KEY_CLUES.filter((k) => clues.includes(k.id));
  const missed = KEY_CLUES.filter((k) => !clues.includes(k.id));

  return (
    <div className="sx-bed" id="atender">
      <header className="sx-bed-head">
        <span className="sx-bed-avatar" aria-hidden="true">M</span>
        <span className="sx-bed-who">
          <b>Marta, 68 anos</b>
          <small>Dispneia e inchaço nas pernas</small>
        </span>
        <span className="sx-bed-live">
          <i aria-hidden="true" />
          Em atendimento
        </span>
      </header>

      <div className="sx-vitals" aria-label="Sinais vitais: frequência cardíaca 104, saturação 91%, pressão 150 por 92, frequência respiratória 24">
        <div className="sx-vital sx-vital-hr" aria-hidden="true">
          <svg className="sx-trace" viewBox="0 0 192 40" preserveAspectRatio="xMinYMid slice">
            <g className={reduced ? "" : "sx-trace-run"}>
              <path d={TRACE} />
            </g>
          </svg>
          <span>
            <small>FC</small>
            <b>104</b>
          </span>
        </div>
        <div className="sx-vital sx-vital-spo2" aria-hidden="true">
          <small>SpO₂</small>
          <b>91<em>%</em></b>
        </div>
        <div className="sx-vital sx-vital-pa" aria-hidden="true">
          <small>PA</small>
          <b>150<em>/92</em></b>
        </div>
        <div className="sx-vital sx-vital-fr" aria-hidden="true">
          <small>FR</small>
          <b>24</b>
        </div>
      </div>

      <div className="sx-bed-thread" ref={threadRef} aria-live="polite">
        {log.map((m, i) => (
          <motion.div
            key={i}
            className={`sx-msg sx-msg-${m.kind}`}
            initial={reduced || i === 0 ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {m.kind === "exam" ? (
              <>
                <b>{m.name}</b>
                {m.image ? (
                  <figure>
                    <Image src={m.image} alt={m.alt ?? ""} sizes="300px" />
                    <figcaption>{m.credit}</figcaption>
                  </figure>
                ) : null}
                <p>{m.text}</p>
              </>
            ) : (
              <p>{m.text}</p>
            )}
          </motion.div>
        ))}
        {typing ? (
          <span className="sx-typing" aria-label="Respondendo">
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </div>

      <div className="sx-bed-act">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "ask" ? (
            <motion.div key="ask" {...fade(reduced)}>
              <p className="sx-bed-prompt">
                Escolha o que perguntar <span>{asked.length} de {MAX_QUESTIONS}</span>
              </p>
              <div className="sx-chips">
                {QUESTIONS.filter((q) => !asked.includes(q.id)).map((q) => (
                  <button key={q.id} type="button" onClick={() => ask(q.id)} disabled={typing}>
                    {q.q}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}

          {stage === "exam" ? (
            <motion.div key="exam" {...fade(reduced)}>
              <p className="sx-bed-prompt">
                Peça um exame <span>{examsDone.length} de {MAX_EXAMS}</span>
              </p>
              <div className="sx-chips">
                {EXAMS.filter((e) => !examsDone.includes(e.id)).map((e) => (
                  <button key={e.id} type="button" onClick={() => order(e.id)} disabled={typing}>
                    {e.name}
                  </button>
                ))}
                {examsDone.length > 0 && !typing ? (
                  <button type="button" className="sx-chip-go" onClick={() => setStage("dx")}>
                    Já tenho uma hipótese
                  </button>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {stage === "dx" ? (
            <motion.div key="dx" {...fade(reduced)}>
              <p className="sx-bed-prompt">Qual a sua hipótese principal?</p>
              <div className="sx-chips sx-chips-dx">
                {DIAGNOSES.map((d) => (
                  <button key={d.id} type="button" onClick={() => decide(d.id)}>
                    {d.name}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}

          {stage === "result" && chosen ? (
            <motion.div key="result" className="sx-result" {...fade(reduced)}>
              <p className={`sx-result-verdict ${chosen.correct ? "ok" : "no"}`}>
                {chosen.correct ? "Hipótese correta." : "Não era isso."}{" "}
                <span>
                  {chosen.correct
                    ? `Você achou ${found.length} de ${KEY_CLUES.length} pistas.`
                    : "Era insuficiência cardíaca descompensada."}
                </span>
              </p>
              {missed.length > 0 ? (
                <ul className="sx-result-missed">
                  {missed.map((m) => (
                    <li key={m.id}>{m.miss}</li>
                  ))}
                </ul>
              ) : (
                <p className="sx-result-clean">Anamnese completa. É assim que se fecha um caso.</p>
              )}
              <div className="sx-result-actions">
                <Link className="sx-btn" href="/">
                  Atender o próximo paciente
                </Link>
                <button type="button" className="sx-btn-quiet" onClick={restart}>
                  <RotateCcw aria-hidden="true" />
                  Refazer
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <footer className="sx-clues" aria-label={`Pistas encontradas: ${found.length} de ${KEY_CLUES.length}`}>
        {KEY_CLUES.map((k) => {
          const on = clues.includes(k.id);
          return (
            <span key={k.id} className={on ? "on" : ""}>
              {on ? k.label : "Pista"}
            </span>
          );
        })}
      </footer>
    </div>
  );
}

function fade(reduced: boolean | null) {
  return reduced
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.25, ease: EASE },
      };
}
