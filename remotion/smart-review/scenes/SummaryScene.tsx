import { useVideoConfig } from "remotion";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import { useLayout } from "../components/use-layout";
import { colors, type } from "../theme";
import type { SmartReviewProps } from "../types";

/** Encerramento: números da revisão e próximo passo recomendado. Com 100%
 * de acerto, vira um fechamento de excelente desempenho. */
export function SummaryScene({ wrongAnswers, correctAnswers, totalQuestions, topics, sections, priorityConcepts, nextStep }: SmartReviewProps) {
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  const perfect = wrongAnswers === 0;
  const reinforcedTopics = new Set(sections.map((s) => (s.kind === "group" ? s.topic : s.question.topic))).size;

  const stats = perfect
    ? [
        { value: `${correctAnswers}/${totalQuestions}`, label: "questões corretas" },
        { value: String(topics.length), label: topics.length === 1 ? "tema dominado" : "temas dominados" },
      ]
    : [
        { value: String(wrongAnswers), label: wrongAnswers === 1 ? "erro revisado" : "erros revisados" },
        { value: String(reinforcedTopics), label: reinforcedTopics === 1 ? "assunto reforçado" : "assuntos reforçados" },
        { value: String(priorityConcepts.length), label: priorityConcepts.length === 1 ? "conceito prioritário" : "conceitos prioritários" },
      ];

  return (
    <SceneShell name="Encerramento" eyebrow={perfect ? "SIMULADO GABARITADO" : "REVISÃO CONCLUÍDA"}>
      <Reveal name="Título" delay={0.1 * fps}>
        <h1 style={{ margin: 0, fontSize: type.headline * u, lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 800 }}>
          {perfect ? "Excelente desempenho" : "Revisão concluída"}
        </h1>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: portrait ? "1fr" : `repeat(${stats.length}, 1fr)`, gap: 24 * u, margin: `${56 * u}px 0` }}>
        {stats.map((stat, index) => (
          <Reveal key={stat.label} name={`Número ${stat.label}`} delay={(0.6 + index * 0.35) * fps} rise={18}>
            <div
              style={{
                display: "flex",
                flexDirection: portrait ? "row" : "column",
                alignItems: portrait ? "center" : "flex-start",
                gap: (portrait ? 28 : 6) * u,
                padding: `${28 * u}px ${32 * u}px`,
                borderRadius: 24 * u,
                background: colors.surface,
                border: `${2 * u}px solid ${colors.line}`,
              }}
            >
              <b style={{ color: colors.mint, fontSize: 80 * u, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>{stat.value}</b>
              <span style={{ color: colors.sub, fontSize: type.small * u, fontWeight: 600 }}>{stat.label}</span>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal name="Próximo passo" delay={1.9 * fps}>
        <small style={{ color: colors.gold, fontSize: type.eyebrow * u, fontWeight: 800, letterSpacing: "0.14em" }}>PRÓXIMO PASSO RECOMENDADO</small>
        <p style={{ margin: `${14 * u}px 0 0`, maxWidth: 1400 * u, fontSize: type.body * u, lineHeight: 1.4, fontWeight: 700 }}>{nextStep}</p>
      </Reveal>
    </SceneShell>
  );
}
