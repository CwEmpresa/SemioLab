"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Sparkles, Stethoscope } from "lucide-react";
import IPhone from "./iphone";
import { SCREENS } from "./app-screens";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Números de exemplo da tela de progresso: ilustram a interface, não são
   dados de nenhum aluno. */
const BARS = [
  { label: "Card", v: 74 },
  { label: "Resp", v: 61 },
  { label: "Abd", v: 66 },
  { label: "Neuro", v: 48 },
  { label: "Renal", v: 34, low: true },
  { label: "Endó", v: 55 },
];

/**
 * Palco do hero: o aparelho com a consulta no centro e, em volta, cartões
 * da própria interface. Entram numa sequência única depois do título e
 * se afastam devagar com a rolagem.
 */
export default function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const leftY = useTransform(scrollYProgress, [0, 1], [40, -60]);
  const rightY = useTransform(scrollYProgress, [0, 1], [20, -110]);
  const Patient = SCREENS.patient;

  const enter = (delay: number, x = 0) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 28, x },
          animate: { opacity: 1, y: 0, x: 0 },
          transition: { duration: 1, delay, ease: EASE },
        };

  return (
    <div className="sx-stage" ref={ref}>
      <motion.div className="sx-stage-phone" {...enter(0.25)}>
        <IPhone className="sx-iphone-hero">
          <Patient />
        </IPhone>
      </motion.div>

      <motion.div className="sx-float sx-float-left" style={reduced ? undefined : { y: leftY }} aria-hidden="true">
        <motion.div {...enter(0.55, -24)}>
          <p className="sx-float-label">
            <Stethoscope />
            Últimos atendimentos
          </p>
          <div className="sx-case">
            <span className="sx-case-dot" style={{ background: "linear-gradient(140deg,#a78bfa,#6d28d9)" }}>
              M
            </span>
            <span className="sx-case-text">
              <b>Marta, 68</b>
              <small>Dispneia e inchaço nas pernas</small>
            </span>
            <span className="sx-case-tag">Acertou</span>
          </div>
          <div className="sx-case">
            <span className="sx-case-dot" style={{ background: "linear-gradient(140deg,#fb923c,#c2410c)" }}>
              R
            </span>
            <span className="sx-case-text">
              <b>Roberto, 57</b>
              <small>Dor no peito súbita</small>
            </span>
            <span className="sx-case-tag miss">2 pistas perdidas</span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="sx-float sx-float-right" style={reduced ? undefined : { y: rightY }} aria-hidden="true">
        <motion.div {...enter(0.7, 24)}>
          <div className="sx-chart">
            <p className="sx-chart-head">Domínio por sistema</p>
            <p className="sx-chart-total">
              58% <em>+9% na semana</em>
            </p>
            <div className="sx-bars">
              {BARS.map((b) => (
                <span key={b.label}>
                  <i className={b.low ? "low" : ""} style={{ height: `${b.v}%` }} />
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          <p className="sx-float-note">
            <Sparkles />
            Onde revisar hoje
          </p>
        </motion.div>
      </motion.div>

      <motion.span className="sx-tag sx-tag-1" aria-hidden="true" {...enter(0.85)}>
        <i style={{ background: "linear-gradient(140deg,#f472b6,#be185d)" }}>L</i>
        <b style={{ background: "#f9a8d4" }}>Larissa</b>
      </motion.span>
      <motion.span className="sx-tag sx-tag-2" aria-hidden="true" {...enter(0.95)}>
        <i style={{ background: "linear-gradient(140deg,#facc15,#a16207)" }}>V</i>
        <b style={{ background: "#fde68a" }}>Vinícius</b>
      </motion.span>

      <span className="sx-stage-fade" aria-hidden="true" />
    </div>
  );
}
