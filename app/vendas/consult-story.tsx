"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { ClipboardList, Mic } from "lucide-react";
import IPhone from "./iphone";
import room from "../../public/patient-room.png";
import xray from "../../public/clinical/radiografia-ic-congestiva.png";

const EASE = [0.22, 1, 0.36, 1] as const;

type Msg = { from: "them" | "me" | "exam"; text: string; label?: string; at: number };

/* `at` é o ponto da rolagem (0–1) em que a mensagem aparece. */
const MESSAGES: Msg[] = [
  { from: "them", text: "Doutor, tenho falta de ar quando subo escada. Começou faz uns dois meses.", at: 0.04 },
  { from: "me", text: "Piora quando a senhora deita?", at: 0.2 },
  { from: "them", text: "Piora. Tenho que dormir com dois travesseiros, senão acordo sem ar.", at: 0.28 },
  { from: "me", text: "E os tornozelos, incham no fim do dia?", at: 0.42 },
  { from: "them", text: "Incham sim. A meia fica marcando a perna.", at: 0.5 },
  {
    from: "exam",
    label: "RADIOGRAFIA DE TÓRAX",
    text: "Cardiomegalia, congestão hilar bilateral e linhas B de Kerley.",
    at: 0.68,
  },
];

const STAGES = [
  {
    at: 0,
    title: "Ela descreve.",
    body: "Helena, 58 anos, falta de ar há dois meses. Contada do jeito dela, não do livro.",
  },
  {
    at: 0.36,
    title: "Você investiga.",
    body: "Cada pergunta abre uma pista. A que você não faz fica no escuro.",
  },
  {
    at: 0.62,
    title: "O exame responde.",
    body: "Peça a radiografia e o laudo chega dentro da conversa. A hipótese é sua.",
  },
];

export default function ConsultStory() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const [liveVisible, setVisible] = useState(1);
  const [liveStage, setStage] = useState(0);
  // useReducedMotion só resolve depois do primeiro render, então o estado
  // final é derivado aqui em vez de fixado no useState.
  const visible = reduced ? MESSAGES.length : liveVisible;
  const stage = reduced ? STAGES.length - 1 : liveStage;

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    if (reduced) return;
    const count = Math.max(1, MESSAGES.filter((m) => p >= m.at).length);
    if (count !== liveVisible) setVisible(count);
    let s = 0;
    STAGES.forEach((st, i) => {
      if (p >= st.at) s = i;
    });
    if (s !== liveStage) setStage(s);
  });

  const roomScale = useTransform(scrollYProgress, [0, 1], [1.14, 1]);
  const roomOpacity = useTransform(scrollYProgress, [0, 0.12, 0.9, 1], [0.35, 0.62, 0.62, 0.3]);
  const phoneY = useTransform(scrollYProgress, [0, 0.12], [60, 0], { clamp: true });

  const showXray = visible >= MESSAGES.length;
  const typing = !reduced && visible < MESSAGES.length && MESSAGES[visible]?.from === "them";

  return (
    <section className="ap-story" id="consulta" ref={ref}>
      <div className="ap-story-sticky">
        <motion.div
          className="ap-story-room"
          style={reduced ? { opacity: 0.55 } : { scale: roomScale, opacity: roomOpacity }}
          aria-hidden="true"
        >
          <Image src={room} alt="" fill sizes="100vw" placeholder="blur" />
        </motion.div>
        <div className="ap-story-shade" aria-hidden="true" />

        <div className="ap-story-grid">
          <div className="ap-story-captions">
            <p className="ap-kicker">Paciente IA</p>
            <div className="ap-story-caption-slot" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stage}
                  initial={reduced ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -18 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <h2>{STAGES[stage].title}</h2>
                  <p>{STAGES[stage].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <ol className="ap-story-steps" aria-hidden="true">
              {STAGES.map((s, i) => (
                <li key={s.title} className={i <= stage ? "on" : ""} />
              ))}
            </ol>
          </div>

          <motion.div className="ap-story-phone" style={reduced ? undefined : { y: phoneY }}>
            <span className="ap-story-halo" aria-hidden="true" />
            <AnimatePresence>
              {stage >= 1 ? (
                <motion.div
                  className="ap-float ap-float-vitals"
                  aria-hidden="true"
                  initial={reduced ? false : { opacity: 0, x: -30, scale: 0.92 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, x: -30 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <small>Sinais vitais</small>
                  <span>
                    PA <b>150/95</b>
                  </span>
                  <span>
                    FC <b>98</b>
                  </span>
                  <span>
                    SpO₂ <b className="warn">93%</b>
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {showXray ? (
                <motion.div
                  className="ap-float ap-float-xray"
                  aria-hidden="true"
                  initial={reduced ? false : { opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, y: 30 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <small>Raio-X de tórax</small>
                  <Image src={xray} alt="" sizes="140px" />
                </motion.div>
              ) : null}
            </AnimatePresence>
            <IPhone className="ap-iphone-story">
              <div className="lp-screen">
                <div className="lp-status" aria-hidden="true">
                  <span className="lp-status-time">9:41</span>
                  <span className="lp-status-icons">
                    <i className="lp-status-signal">
                      <b />
                      <b />
                      <b />
                      <b />
                    </i>
                    <i className="lp-status-wifi" />
                    <i className="lp-status-battery" />
                  </span>
                </div>
                <div className="lp-screen-scroll lp-chat ap-story-chat">
                  <header className="lp-chat-head">
                    <span className="lp-chat-avatar" aria-hidden="true" />
                    <span>
                      <b>Helena, 58 anos</b>
                      <small>Atendimento em andamento</small>
                    </span>
                  </header>
                  <div className="ap-story-thread">
                    {MESSAGES.slice(0, visible).map((m, i) => (
                      <motion.p
                        key={i}
                        className={`lp-bubble ${m.from}`}
                        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.38, ease: EASE }}
                      >
                        {m.label ? <b>{m.label}</b> : null}
                        {m.text}
                      </motion.p>
                    ))}
                    {typing ? (
                      <span className="ap-typing" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="lp-chat-bar" aria-hidden="true">
                  <Mic />
                  Pergunte ou peça um exame
                  <ClipboardList />
                </div>
              </div>
            </IPhone>
          </motion.div>

          <div className="ap-story-exam">
            <AnimatePresence>
              {showXray ? (
                <motion.figure
                  className="ap-xray"
                  initial={reduced ? false : { opacity: 0, x: 40, rotate: 3 }}
                  animate={{ opacity: 1, x: 0, rotate: 0 }}
                  exit={reduced ? undefined : { opacity: 0, x: 40 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <header>
                    <span />
                    Radiografia de tórax
                  </header>
                  <Image
                    src={xray}
                    alt="Radiografia de tórax com área cardíaca aumentada e congestão pulmonar"
                    sizes="(max-width: 900px) 0px, 340px"
                  />
                  <figcaption>Imagem: James Heilman, MD, CC BY-SA 4.0</figcaption>
                </motion.figure>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
