import { useVideoConfig } from "remotion";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import { useLayout } from "../components/use-layout";
import { MAX_GROUP_POINTS } from "../timeline";
import { accuracyColor, colors, type } from "../theme";
import type { ReviewSection } from "../types";

type TopicReviewSceneProps = {
  section: Extract<ReviewSection, { kind: "group" }>;
  priority: number;
};

/** Abertura de um grupo de erros do mesmo assunto: nomeia o assunto e
 * lista os conceitos que serão revisados em seguida. */
export function TopicReviewScene({ section, priority }: TopicReviewSceneProps) {
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const points = section.questions.slice(0, MAX_GROUP_POINTS);
  const hidden = section.questions.length - points.length;

  return (
    <SceneShell name={`Grupo ${section.title}`} eyebrow={`PRIORIDADE ${priority}`} meta={`${section.questions.length} erros`}>
      <Reveal name="Rótulo" delay={0.1 * fps}>
        <span style={{ color: colors.sub, fontSize: type.small * u, fontWeight: 700 }}>Você precisa revisar</span>
      </Reveal>
      <Reveal name="Assunto" delay={0.3 * fps}>
        <h2 style={{ margin: `${10 * u}px 0 ${18 * u}px`, fontSize: type.headline * u, lineHeight: 1.05, letterSpacing: "-0.035em", fontWeight: 800 }}>
          {section.title}
        </h2>
      </Reveal>
      <Reveal name="Acerto do tema" delay={0.6 * fps}>
        <span style={{ fontSize: type.small * u, color: colors.sub }}>
          <b style={{ color: accuracyColor(section.accuracy) }}>{section.accuracy}% de acerto</b> em {section.topic} neste simulado
        </span>
      </Reveal>

      <ol style={{ listStyle: "none", margin: `${52 * u}px 0 0`, padding: 0, display: "flex", flexDirection: "column", gap: 18 * u }}>
        {points.map((question, index) => (
          <li key={question.number}>
            <Reveal name={`Conceito Q${question.number}`} delay={(1.4 + index * 1.2) * fps} rise={16}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 24 * u,
                  padding: `${22 * u}px ${28 * u}px`,
                  borderRadius: 22 * u,
                  background: colors.surface,
                  border: `${2 * u}px solid ${colors.line}`,
                }}
              >
                <b style={{ flex: "0 0 auto", minWidth: 84 * u, padding: `${6 * u}px 0`, borderRadius: 12 * u, background: colors.wrongBg, color: colors.wrong, fontSize: type.small * u * 0.8, textAlign: "center" }}>
                  Q{question.number}
                </b>
                <span style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden", fontSize: type.small * u, lineHeight: 1.4, fontWeight: 600 }}>
                  {question.keyPoint}
                </span>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
      {hidden > 0 ? (
        <Reveal name="Outros erros" delay={(1.4 + points.length * 1.2) * fps}>
          <p style={{ margin: `${18 * u}px 0 0`, color: colors.muted, fontSize: type.small * u * 0.85 }}>
            e mais {hidden} {hidden === 1 ? "erro" : "erros"} deste assunto na lista da página.
          </p>
        </Reveal>
      ) : null}
    </SceneShell>
  );
}
