"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { AvatarCircles } from "@/components/ui/avatar-circles";
import IPhone from "./iphone";
import Stars from "./stars";
import { SCREENS } from "./app-screens";

const EASE = [0.22, 1, 0.36, 1] as const;

/* Rostos de alunos reais que autorizaram o uso (os mesmos dos depoimentos). */
/* Traçado de ECG em ritmo sinusal (P, QRS, T) repetido na largura toda. */
const ECG_BEAT = "l18 0 c4 -7 10 -7 14 0 l10 0 l4 6 l7 -62 l7 74 l5 -18 l14 0 c6 -12 16 -12 22 0 l49 0";
const ECG_PATH = `M0 70 ${Array.from({ length: 9 }, () => ECG_BEAT).join(" ")}`;

const PROOF_FACES = ["/vendas/mariana.webp", "/vendas/lucas.webp", "/vendas/ana-clara.webp"];

/**
 * Abertura em estilo página de produto: título curto e centralizado, e
 * três aparelhos em leque com a UI real do app. Ao rolar, os laterais se
 * afastam e o central cresce — um único movimento orquestrado.
 */
export default function Hero({ trialDays, students }: { trialDays: number; students: number }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const spread = useTransform(scrollYProgress, [0, 0.6], [0, 1], { clamp: true });
  const leftX = useTransform(spread, [0, 1], ["-54%", "-78%"]);
  const rightX = useTransform(spread, [0, 1], ["54%", "78%"]);
  const sideRotate = useTransform(spread, [0, 1], [7, 13]);
  const sideRotateNeg = useTransform(sideRotate, (v) => -v);
  const centerScale = useTransform(spread, [0, 1], [1, 1.08]);
  const copyY = useTransform(scrollYProgress, [0, 0.5], [0, -60], { clamp: true });
  const copyOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0], { clamp: true });

  const HomeLight = SCREENS.homeLight;
  const Patient = SCREENS.patient;
  const Quiz = SCREENS.quiz;

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 90 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1.1, delay, ease: EASE },
        };

  return (
    <section className="ap-hero" ref={ref}>
      <motion.div className="ap-hero-copy" style={reduced ? undefined : { y: copyY, opacity: copyOpacity }}>
        <motion.p
          className="ap-kicker"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          SemioLab
        </motion.p>
        <motion.div
          className="ap-proof"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.04, ease: EASE }}
        >
          <AvatarCircles
            className="ap-proof-faces"
            numPeople={students}
            avatarUrls={PROOF_FACES}
            countImageUrl="/vendas/aluna-4.webp"
          />
          <p className="ap-proof-line" aria-label="Nota 4,89 de 5">
            <Stars />
            <b>4,89/5</b>
          </p>
        </motion.div>
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.08, ease: EASE }}
        >
          Raciocínio clínico.
          <br />
          Treinado todo dia.
        </motion.h1>
        <motion.p
          className="ap-hero-sub"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.18, ease: EASE }}
        >
          Pacientes virtuais que não entregam o diagnóstico. Você pergunta, examina e decide.
        </motion.p>
        <motion.div
          className="ap-hero-actions"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.28, ease: EASE }}
        >
          <Link className="ap-btn" href="/">
            Começar grátis
          </Link>
          <a className="ap-link" href="#consulta">
            Ver uma consulta <span aria-hidden="true">›</span>
          </a>
        </motion.div>
        <motion.p
          className="ap-hero-fine"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.4, ease: EASE }}
        >
          {trialDays} dias de Pro incluídos. Sem cartão de crédito.
        </motion.p>
      </motion.div>

      <svg className="ap-hero-ecg" viewBox="0 0 1350 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="ap-hero-ecg-base" d={ECG_PATH} />
        <path className="ap-hero-ecg-pulse" d={ECG_PATH} pathLength={1} />
      </svg>

      <div className="ap-hero-stage" aria-hidden="true">
        <span className="ap-hero-glow" />
        <span className="ap-hero-glow ap-hero-glow-2" />
        <motion.div
          className="ap-hero-phone ap-hero-side"
          style={reduced ? { x: "-54%", rotate: -7 } : { x: leftX, rotate: sideRotateNeg }}
          {...rise(0.35)}
        >
          <IPhone className="ap-iphone-side">
            <Patient />
          </IPhone>
        </motion.div>
        <motion.div
          className="ap-hero-phone ap-hero-side"
          style={reduced ? { x: "54%", rotate: 7 } : { x: rightX, rotate: sideRotate }}
          {...rise(0.45)}
        >
          <IPhone className="ap-iphone-side">
            <Quiz />
          </IPhone>
        </motion.div>
        <motion.div
          className="ap-hero-phone ap-hero-center"
          style={reduced ? undefined : { scale: centerScale }}
          {...rise(0.22)}
        >
          <IPhone className="ap-iphone-hero">
            <HomeLight />
          </IPhone>
        </motion.div>
      </div>
    </section>
  );
}
