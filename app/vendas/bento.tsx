"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Activity, CheckCircle2, Mic, RotateCw } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

function Tile({ className, index, children }: { className: string; index: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={`ap-tile ${className}`}
      initial={reduced ? false : { opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, delay: (index % 3) * 0.08, ease: EASE }}
    >
      {children}
    </motion.article>
  );
}

/** Avança 0 → total em loop enquanto o elemento está na tela. Sob
 * prefers-reduced-motion fica parado no estado final. */
function useLoop(total: number, stepMs: number, holdMs: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced || !inView) return;
    const t = window.setTimeout(() => setStep((s) => (s >= total ? 0 : s + 1)), step >= total ? holdMs : stepMs);
    return () => window.clearTimeout(t);
  }, [step, inView, reduced, total, stepMs, holdMs]);
  return { ref, step: reduced ? total : step };
}

/* ─── Paciente IA: a consulta acontecendo dentro do cartão ─────────── */
const CHAT = [
  { from: "them", text: "Doutor, tô com uma dor no peito que vai pro braço esquerdo." },
  { from: "me", text: "Começou há quanto tempo?" },
  { from: "them", text: "Uns 40 minutos. E tô suando frio." },
  { from: "exam", text: "Supradesnivelamento de ST em DII, DIII e aVF." },
] as const;

function PatientDemo() {
  const { ref, step } = useLoop(CHAT.length + 1, 1300, 3200);
  return (
    <div className="ap-pt" ref={ref} aria-hidden="true">
      <div className="ap-pt-head">
        <span className="ap-pt-avatar">JR</span>
        <span>
          <b>José Roberto, 62 anos</b>
          <small>
            <i /> Atendimento em andamento
          </small>
        </span>
        <span className="ap-pt-vitals">
          <Activity /> FC 104
        </span>
      </div>
      <div className="ap-pt-thread">
        <AnimatePresence initial={false}>
          {CHAT.slice(0, Math.min(step, CHAT.length)).map((m, i) => (
            <motion.p
              key={`${i}-${m.from}`}
              className={`ap-pt-msg ${m.from}`}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {m.from === "exam" ? <b>ECG · 12 derivações</b> : null}
              {m.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {step > CHAT.length - 1 ? (
          <motion.div
            className="ap-pt-dx"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <CheckCircle2 />
            <span>
              <small>Sua hipótese</small>
              IAM com supra de ST
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ─── Voz: onda viva e a pergunta sendo transcrita ─────────────────── */
const BARS = [6, 14, 22, 12, 30, 18, 38, 26, 44, 20, 34, 48, 28, 40, 16, 36, 24, 46, 30, 18, 42, 22, 32, 12, 26, 16, 8];

function VoiceDemo() {
  return (
    <div className="ap-vx" aria-hidden="true">
      <div className="ap-vx-wave">
        {BARS.map((h, i) => (
          <span key={i} style={{ "--h": `${h}px`, animationDelay: `${(i % 9) * -0.13}s` } as React.CSSProperties} />
        ))}
      </div>
      <div className="ap-vx-row">
        <span className="ap-vx-mic">
          <Mic />
        </span>
        <p>
          “A dor irradia para algum lugar?”<i />
        </p>
      </div>
    </div>
  );
}

/* ─── Flashcard que vira sozinho ───────────────────────────────────── */
function FlashDemo() {
  const { ref, step } = useLoop(1, 2600, 2600);
  const reduced = useReducedMotion();
  const flipped = reduced ? false : step === 1;
  return (
    <div className="ap-fc" ref={ref} aria-hidden="true">
      <motion.div
        className="ap-fc-card"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <div className="ap-fc-face">
          <small>Semiologia respiratória</small>
          <b>Frêmito toracovocal aumentado sugere…</b>
          <span className="ap-fc-hint">
            <RotateCw /> toque para virar
          </span>
        </div>
        <div className="ap-fc-face ap-fc-back">
          <small>Resposta</small>
          <b>Consolidação pulmonar, como na pneumonia.</b>
          <span className="ap-fc-grade">
            <em>Errei</em>
            <em className="ok">Acertei</em>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Atlas: os sistemas reais do app passando em esteira ──────────── */
const ATLAS_A = ["torax", "cardiaco", "figado", "rim", "neuro", "pancreas", "vascular"];
/* Baço (arte com o nome escrito em cima) e musculoesquelético (nome cortado no cartão) ficam de fora. */
const ATLAS_B = ["intestino", "geniturinario", "adrenal", "esofago", "ginecologia", "vesicula", "colon", "estomago"];

function AtlasDemo() {
  const row = (items: string[], dir: "l" | "r") => (
    <div className={`ap-at-row ${dir}`}>
      {[...items, ...items].map((n, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`/vendas/atlas/${n}.webp`} alt="" width={116} height={118} loading="lazy" />
      ))}
    </div>
  );
  return (
    <div className="ap-at" aria-hidden="true">
      {row(ATLAS_A, "l")}
      {row(ATLAS_B, "r")}
    </div>
  );
}

/* ─── Domínio por sistema: barras que enchem ao entrar na tela ─────── */
const MASTERY = [
  { name: "Cardiovascular", v: 74 },
  { name: "Respiratório", v: 61 },
  { name: "Digestório", v: 48 },
  { name: "Neurológico", v: 33 },
];

function MasteryDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const on = inView || reduced;
  return (
    <div className="ap-ms" ref={ref} aria-hidden="true">
      {MASTERY.map((m, i) => (
        <div className={`ap-ms-row ${m.v < 40 ? "weak" : ""}`} key={m.name}>
          <span className="ap-ms-name">
            {m.name}
            {m.v < 40 ? <em>revisar</em> : null}
          </span>
          <span className="ap-ms-track">
            <motion.i
              initial={reduced ? false : { width: 0 }}
              animate={{ width: on ? `${m.v}%` : 0 }}
              transition={{ duration: 1.1, delay: 0.15 + i * 0.12, ease: EASE }}
            />
          </span>
          <b>{m.v}%</b>
        </div>
      ))}
    </div>
  );
}

export default function Bento({ proConsultations }: { proConsultations: number }) {
  return (
    <div className="ap-bento">
      <Tile className="t-patient" index={0}>
        <div className="ap-tile-copy">
          <p className="ap-tile-kicker">Paciente IA</p>
          <h3>Ele conta. Você pergunta, pede o exame e fecha o diagnóstico.</h3>
        </div>
        <PatientDemo />
      </Tile>

      <Tile className="t-stats" index={1}>
        <p className="ap-tile-kicker">No Pro</p>
        <div className="ap-stats">
          <span>
            <strong>{proConsultations}</strong>
            atendimentos por dia
          </span>
          <span>
            <strong>∞</strong>
            exames por atendimento
          </span>
        </div>
      </Tile>

      <Tile className="t-voice" index={2}>
        <div className="ap-tile-copy">
          <p className="ap-tile-kicker">Por voz</p>
          <h3>Pergunte falando. Ouça a resposta.</h3>
        </div>
        <VoiceDemo />
      </Tile>

      <Tile className="t-atlas" index={3}>
        <div className="ap-tile-copy">
          <p className="ap-tile-kicker">Atlas de TC</p>
          <h3>402 tomografias reais, em 17 sistemas.</h3>
        </div>
        <AtlasDemo />
      </Tile>

      <Tile className="t-cards" index={4}>
        <div className="ap-tile-copy">
          <p className="ap-tile-kicker">Flashcards</p>
          <h3>O baralho sai dos seus erros.</h3>
        </div>
        <FlashDemo />
      </Tile>

      <Tile className="t-mastery" index={5}>
        <div className="ap-tile-copy">
          <p className="ap-tile-kicker">Domínio por sistema</p>
          <h3>Você vê onde está fraco.</h3>
          <p className="ap-tile-note">Quiz, simulado e atendimento somam na mesma nota. A consulta pesa mais.</p>
        </div>
        <MasteryDemo />
      </Tile>
    </div>
  );
}
