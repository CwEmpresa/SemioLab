"use client";

import { motion, useReducedMotion } from "framer-motion";
import Stars from "./stars";

/* Depoimentos reais de alunos, com autorização de uso do texto e da foto
   (enviados pelo dono do SemioLab em 28/10/2026). Texto sem edição. */
const TESTIMONIALS = [
  {
    quote:
      "gente, eu finalmente comecei a entender ausculta 😭 antes eu ficava lendo e relendo e parecia que não entrava na cabeça kkkkk o jeito visual ajuda MUITO",
    name: "Mariana S.",
    role: "Estudante de medicina",
    photo: "/vendas/mariana.webp",
  },
  {
    quote:
      "o que eu mais gostei foi poder testar o que aprendi nos casos clínicos. pq uma coisa é decorar a teoria, outra é saber oq perguntar pro paciente na hora.",
    name: "Lucas R.",
    role: "Estudante de medicina",
    photo: "/vendas/lucas.webp",
  },
  {
    quote:
      "queria ter conhecido antes kkkkk tô usando pra revisar antes das aulas práticas e consigo lembrar bem melhor dos pontos principais. muito melhor do que ficar perdida em 50 páginas de resumo 🥹",
    name: "Ana Clara M.",
    role: "Estudante de medicina",
    photo: "/vendas/ana-clara.webp",
  },
];

export default function Testimonials() {
  const reduced = useReducedMotion();
  return (
    <div className="ap-quotes">
      {TESTIMONIALS.map((t, i) => (
        <motion.figure
          key={t.name}
          className="ap-quote"
          initial={reduced ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <Stars label="5 de 5 estrelas" />
          <blockquote>“{t.quote}”</blockquote>
          <figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ap-quote-avatar" src={t.photo} alt="" width={48} height={48} loading="lazy" />
            <span>
              <b>{t.name}</b>
              <em>{t.role}</em>
            </span>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  );
}
