import { useMemo } from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { PerformanceScene } from "./scenes/PerformanceScene";
import { QuestionReviewScene } from "./scenes/QuestionReviewScene";
import { SummaryScene } from "./scenes/SummaryScene";
import { TopicReviewScene } from "./scenes/TopicReviewScene";
import { colors, fontFamily } from "./theme";
import { buildTimeline, TRANSITION_FRAMES, type TimelineScene } from "./timeline";
import type { SmartReviewProps } from "./types";

/** Composition da Revisão Inteligente. Recebe tudo por inputProps — a mesma
 * entrada serve ao <Player> no app e a uma renderização em MP4 no futuro. */
export function SmartReview(props: SmartReviewProps) {
  const { fps } = useVideoConfig();
  const scenes = useMemo(() => buildTimeline(props, fps), [props, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily }}>
      {/* TransitionSeries exige Sequence/Transition como filhos diretos
          (ou em arrays/fragments) — por isso o flatMap, sem componente
          intermediário. */}
      <TransitionSeries>
        {scenes.flatMap((scene, index) => [
          index > 0 ? (
            <TransitionSeries.Transition key={`${scene.key}-in`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
          ) : null,
          <TransitionSeries.Sequence key={scene.key} name={scene.key} durationInFrames={scene.durationInFrames}>
            <SceneContent scene={scene} props={props} />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      <TimelineBar />
    </AbsoluteFill>
  );
}

function SceneContent({ scene, props }: { scene: TimelineScene; props: SmartReviewProps }) {
  switch (scene.kind) {
    case "intro":
      return <IntroScene {...props} />;
    case "performance":
      return <PerformanceScene {...props} />;
    case "group":
      return <TopicReviewScene section={scene.section} priority={scene.priority} />;
    case "question":
      return <QuestionReviewScene question={scene.question} phases={scene.phases} position={scene.position} count={scene.count} />;
    case "summary":
      return <SummaryScene {...props} />;
  }
}

/** Linha fina de progresso no rodapé do vídeo (útil também no MP4, onde não
 * há controles do Player). */
function TimelineBar() {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", pointerEvents: "none" }}>
      <Interactive.Div
        name="Progresso"
        style={{
          height: Math.max(4, height * 0.005),
          background: colors.mint,
          opacity: 0.7,
          width: `${interpolate(frame, [0, durationInFrames - 1], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
        }}
      />
    </AbsoluteFill>
  );
}
