import { accuracyColor, colors, type } from "../theme";
import type { TopicPerformance } from "../types";
import { AnimatedProgress } from "./AnimatedProgress";
import { Reveal } from "./Reveal";
import { useLayout } from "./use-layout";

type TopicPerformanceRowProps = {
  topic: TopicPerformance;
  highlighted: boolean;
  delay: number;
};

/** Linha de desempenho de um assunto: nome, acertos, barra e porcentagem. */
export function TopicPerformanceRow({ topic, highlighted, delay }: TopicPerformanceRowProps) {
  const { u } = useLayout();
  const color = accuracyColor(topic.accuracy);
  return (
    <Reveal name={`Tema ${topic.topic}`} delay={delay} rise={18}>
      <div
        style={{
          padding: `${16 * u}px ${24 * u}px`,
          borderRadius: 24 * u,
          background: highlighted ? colors.surfaceRaised : "transparent",
          border: `${2 * u}px solid ${highlighted ? color : "transparent"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 * u, marginBottom: 14 * u }}>
          <span style={{ minWidth: 0, fontSize: type.body * u * 0.9, fontWeight: 700 }}>
            {topic.topic}
            <small style={{ marginLeft: 16 * u, color: colors.muted, fontSize: type.small * u * 0.8, fontWeight: 600 }}>
              {topic.correct} de {topic.total}
            </small>
          </span>
          <b style={{ color, fontSize: type.body * u, fontWeight: 800 }}>{topic.accuracy}%</b>
        </div>
        <AnimatedProgress name={`Barra ${topic.topic}`} value={topic.accuracy} color={color} delay={delay + 6} />
      </div>
    </Reveal>
  );
}
