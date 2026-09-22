import { Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { AnswerCard } from "../components/ReviewQuestionCard";
import { Reveal } from "../components/Reveal";
import { SceneShell } from "../components/SceneShell";
import { useLayout } from "../components/use-layout";
import { TRANSITION_FRAMES, type QuestionPhases } from "../timeline";
import { colors, EASE_OUT, type } from "../theme";
import type { ReviewQuestion } from "../types";

type QuestionReviewSceneProps = {
  question: ReviewQuestion;
  phases: QuestionPhases;
  position: number;
  count: number;
};

/** O `style` de um <Sequence> substitui o layout padrão do AbsoluteFill
 * (inclusive a posição absoluta), então o estágio é declarado por inteiro:
 * ocupa a área da cena e centraliza o conteúdo na vertical. */
const STAGE_STYLE = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center" } as const;

/** Enunciado curto usa fonte maior; longo reduz para caber na área segura. */
function statementSize(length: number) {
  if (length < 120) return 54;
  if (length < 250) return 46;
  if (length < 330) return 38;
  return 34;
}

/** Explicações e pontos longos encolhem um pouco para caber junto com o
 * card de memorização (pior caso do banco: ~430 caracteres). */
function explanationScale(length: number) {
  if (length > 280) return 0.72;
  if (length > 180) return 0.88;
  return 0.95;
}

function splitSentences(text: string) {
  return text.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

/** Uma questão errada em quatro fases: enunciado → respostas →
 * explicação progressiva → ponto para memorizar. */
export function QuestionReviewScene({ question, phases, position, count }: QuestionReviewSceneProps) {
  const { fps } = useVideoConfig();
  const stageA = phases.statement + phases.answer;
  const stageB = phases.explanation + phases.keyPoint;

  return (
    <SceneShell name={`Questão ${question.number}`} eyebrow={`QUESTÃO ${question.number}`} meta={`Erro ${position} de ${count}`}>
      <Sequence name="Enunciado e respostas" durationInFrames={stageA} premountFor={fps} style={STAGE_STYLE}>
        <StageFade duration={stageA}>
          <StatementStage question={question} answersAt={phases.statement} />
        </StageFade>
      </Sequence>
      <Sequence name="Explicação" from={stageA} durationInFrames={stageB} premountFor={fps} style={STAGE_STYLE}>
        <ExplanationStage question={question} explanationDuration={phases.explanation} />
      </Sequence>
    </SceneShell>
  );
}

/** Esmaece o estágio nos últimos frames, antes do próximo entrar. */
function StageFade({ duration, children }: { duration: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: interpolate(frame, [duration - TRANSITION_FRAMES, duration], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {children}
    </div>
  );
}

function TopicChips({ question }: { question: ReviewQuestion }) {
  const { u } = useLayout();
  const chip = { padding: `${8 * u}px ${18 * u}px`, borderRadius: 999, fontSize: type.small * u * 0.72, fontWeight: 700 } as const;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 * u, marginBottom: 28 * u }}>
      <span style={{ ...chip, background: colors.surfaceRaised, color: colors.mint }}>{question.topic}</span>
      {question.subtopic ? <span style={{ ...chip, background: colors.surfaceRaised, color: colors.sub }}>{question.subtopic}</span> : null}
    </div>
  );
}

function StatementStage({ question, answersAt }: { question: ReviewQuestion; answersAt: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  return (
    <>
      <Reveal name="Assunto" delay={0.1 * fps}>
        <TopicChips question={question} />
      </Reveal>
      <Reveal name="Enunciado" delay={0.3 * fps}>
        <p
          style={{
            margin: 0,
            fontSize: statementSize(question.statement.length) * u,
            lineHeight: 1.32,
            fontWeight: 700,
            letterSpacing: "-0.015em",
            opacity: interpolate(frame, [answersAt, answersAt + 0.5 * fps], [1, 0.6], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(...EASE_OUT),
            }),
          }}
        >
          {question.statement}
        </p>
      </Reveal>
      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", gap: 24 * u, marginTop: 44 * u }}>
        <Reveal name="Sua resposta" delay={answersAt} style={{ flex: 1, display: "flex" }}>
          <AnswerCard label="SUA RESPOSTA" letter={question.selectedLetter} text={question.selectedText} tone="wrong" />
        </Reveal>
        <Reveal name="Resposta correta" delay={answersAt + 0.8 * fps} style={{ flex: 1, display: "flex" }}>
          <AnswerCard label="RESPOSTA CORRETA" letter={question.correctLetter} text={question.correctText} tone="right" />
        </Reveal>
      </div>
    </>
  );
}

function ExplanationStage({ question, explanationDuration }: { question: ReviewQuestion; explanationDuration: number }) {
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const sentences = question.explanation ? splitSentences(question.explanation) : null;
  // Frases entram distribuídas ao longo da fase de explicação, deixando o
  // último terço livre para a leitura completa.
  const step = sentences ? (explanationDuration * 0.66) / sentences.length : 0;

  return (
    <>
      <Reveal name="Pergunta" delay={0}>
        <h2 style={{ margin: `0 0 ${28 * u}px`, fontSize: type.title * u, letterSpacing: "-0.03em", fontWeight: 800 }}>
          {question.explanation ? (
            <>Por que <span style={{ color: colors.mint }}>{question.correctLetter}</span> é a correta?</>
          ) : (
            <>Resposta correta: <span style={{ color: colors.mint }}>{question.correctLetter}</span></>
          )}
        </h2>
      </Reveal>
      <div style={{ margin: 0, fontSize: type.body * u * explanationScale((question.explanation ?? question.correctText).length), lineHeight: 1.45, fontWeight: 500, color: colors.text }}>
        {sentences ? (
          sentences.map((sentence, index) => (
            <Reveal key={index} name={`Frase ${index + 1}`} delay={0.5 * fps + index * step} rise={10} style={{ display: "inline" }}>
              {sentence}{" "}
            </Reveal>
          ))
        ) : (
          <Reveal name="Sem explicação" delay={0.5 * fps} style={{ color: colors.sub }}>
            Esta questão ainda não tem explicação cadastrada. Fixe a alternativa correta: {question.correctText}
          </Reveal>
        )}
      </div>
      <Reveal name="Ponto para memorizar" delay={explanationDuration}>
        <div
          style={{
            marginTop: 44 * u,
            padding: `${26 * u}px ${32 * u}px`,
            borderRadius: 24 * u,
            background: colors.goldBg,
            borderLeft: `${8 * u}px solid ${colors.gold}`,
          }}
        >
          <small style={{ display: "block", color: colors.gold, fontSize: type.eyebrow * u, fontWeight: 800, letterSpacing: "0.14em" }}>
            PONTO PARA MEMORIZAR
          </small>
          <span style={{ display: "block", marginTop: 10 * u, fontSize: type.small * u * (question.keyPoint.length > 140 ? 0.9 : 1.05), lineHeight: 1.4, fontWeight: 700 }}>{question.keyPoint}</span>
        </div>
      </Reveal>
    </>
  );
}
