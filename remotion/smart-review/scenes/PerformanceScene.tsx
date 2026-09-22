import { useVideoConfig } from "remotion";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import { TopicPerformanceRow } from "../components/TopicPerformanceRow";
import { useLayout } from "../components/use-layout";
import { MAX_PERFORMANCE_TOPICS } from "../timeline";
import { colors, type } from "../theme";
import type { SmartReviewProps } from "../types";

export function PerformanceScene({ topics, wrongAnswers }: SmartReviewProps) {
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  const shown = topics.slice(0, MAX_PERFORMANCE_TOPICS);
  const focusCount = wrongAnswers === 0 ? 0 : shown.filter((t) => t.accuracy < 100).length;

  return (
    <SceneShell name="Desempenho" eyebrow="DESEMPENHO POR ASSUNTO">
      <Reveal name="Título" delay={0.1 * fps}>
        <h2 style={{ margin: `0 0 ${16 * u}px`, fontSize: type.title * u, letterSpacing: "-0.03em", fontWeight: 800 }}>
          {wrongAnswers === 0 ? "Domínio em todos os temas" : "Onde você mais precisa evoluir"}
        </h2>
      </Reveal>
      <Reveal name="Subtítulo" delay={0.4 * fps}>
        <p style={{ margin: `0 0 ${48 * u}px`, color: colors.sub, fontSize: type.small * u }}>
          {wrongAnswers === 0
            ? "Acerto de 100% em cada assunto desta prova."
            : `${focusCount} ${focusCount === 1 ? "assunto abaixo" : "assuntos abaixo"} de 100%, do pior para o melhor.`}
        </p>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: !portrait && shown.length > 3 ? "1fr 1fr" : "1fr", gap: `${22 * u}px ${40 * u}px` }}>
        {shown.map((topic, index) => (
          <TopicPerformanceRow key={topic.topic} topic={topic} highlighted={wrongAnswers > 0 && index === 0} delay={(0.8 + index * 0.35) * fps} />
        ))}
      </div>
    </SceneShell>
  );
}
