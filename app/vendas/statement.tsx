"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.16, 1], { clamp: true });
  return (
    <span className="sx-word">
      <motion.span style={{ opacity }}>{children}</motion.span>{" "}
    </span>
  );
}

/**
 * Frase longa que acende palavra por palavra conforme a rolagem. O texto
 * completo existe no DOM desde o início (leitores de tela e busca o leem
 * inteiro); só a opacidade é animada.
 */
export default function Statement({ text, accentFrom }: { text: string; accentFrom: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 82%", "end 45%"] });
  const words = text.split(" ");

  if (reduced) {
    return (
      <p className="sx-statement" ref={ref}>
        {words.slice(0, accentFrom).join(" ")}{" "}
        <span className="sx-statement-accent">{words.slice(accentFrom).join(" ")}</span>
      </p>
    );
  }

  return (
    <p className="sx-statement" ref={ref}>
      {words.map((word, i) => {
        const start = i / words.length;
        const node = (
          <Word key={i} progress={scrollYProgress} range={[start, start + 1 / words.length]}>
            {word}
          </Word>
        );
        return i >= accentFrom ? (
          <span key={i} className="sx-statement-accent">
            {node}
          </span>
        ) : (
          node
        );
      })}
    </p>
  );
}
