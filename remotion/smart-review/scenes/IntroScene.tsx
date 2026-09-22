import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import { useLayout } from "../components/use-layout";
import { accuracyColor, colors, EASE_OUT, type } from "../theme";
import type { SmartReviewProps } from "../types";

const RING_RADIUS = 120;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function IntroScene({ studentFirstName, wrongAnswers, totalQuestions, correctAnswers, score }: SmartReviewProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  const perfect = wrongAnswers === 0;

  return (
    <SceneShell name="Abertura" eyebrow="REVISÃO INTELIGENTE">
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: portrait ? "flex-start" : "center", gap: 80 * u }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Reveal name="Título" delay={0.2 * fps}>
            <h1 style={{ margin: 0, fontSize: type.headline * u, lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 800 }}>
              {perfect ? "Desempenho excelente" : "Sua revisão de hoje"}
            </h1>
          </Reveal>
          <Reveal name="Resumo" delay={0.8 * fps}>
            <p style={{ margin: `${28 * u}px 0 0`, maxWidth: 1000 * u, color: colors.sub, fontSize: type.body * u, lineHeight: 1.4, fontWeight: 500 }}>
              {perfect
                ? `${studentFirstName}, você acertou todas as ${totalQuestions} questões do simulado.`
                : `${studentFirstName}, você terminou o simulado com ${wrongAnswers} ${wrongAnswers === 1 ? "questão incorreta" : "questões incorretas"}.`}
            </p>
          </Reveal>
          <Reveal name="Chamada" delay={2.4 * fps}>
            <p style={{ margin: `${44 * u}px 0 0`, maxWidth: 1000 * u, fontSize: type.body * u, lineHeight: 1.35, fontWeight: 700 }}>
              {perfect ? "Veja onde você está mais forte e como manter o nível." : "Vamos revisar os pontos que mais precisam da sua atenção."}
            </p>
          </Reveal>
        </div>

        <Reveal name="Placar" delay={0.5 * fps} style={{ flex: "0 0 auto", alignSelf: portrait ? "center" : undefined }}>
          <div style={{ position: "relative", width: 300 * u, height: 300 * u }}>
            <svg viewBox="0 0 300 300" width={300 * u} height={300 * u} style={{ rotate: "-90deg" }}>
              <circle cx="150" cy="150" r={RING_RADIUS} fill="none" stroke={colors.line} strokeWidth="18" />
              <circle
                cx="150"
                cy="150"
                r={RING_RADIUS}
                fill="none"
                stroke={accuracyColor(score)}
                strokeWidth="18"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={interpolate(frame, [0.6 * fps, 2 * fps], [RING_LENGTH, RING_LENGTH * (1 - score / 100)], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(...EASE_OUT),
                })}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <b style={{ fontSize: 76 * u, fontWeight: 800, letterSpacing: "-0.04em" }}>
                {correctAnswers}/{totalQuestions}
              </b>
              <small style={{ color: colors.sub, fontSize: type.small * u * 0.8, fontWeight: 700 }}>{score}% de acerto</small>
            </div>
          </div>
        </Reveal>
      </div>
    </SceneShell>
  );
}
