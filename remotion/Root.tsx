import { Composition, type CalculateMetadataFunction } from "remotion";
import { SmartReview } from "./smart-review/SmartReview";
import { FORMATS, FPS, getSmartReviewDuration } from "./smart-review/timeline";
import type { SmartReviewProps } from "./smart-review/types";

/** Duração e formato vêm dos inputProps (dados reais da tentativa), com a
 * mesma função usada pelo <Player> no app. */
const calculateSmartReviewMetadata: CalculateMetadataFunction<SmartReviewProps> = ({ props }) => ({
  durationInFrames: getSmartReviewDuration(props, FPS),
  defaultOutName: `revisao-inteligente-${props.attemptId}`,
});

/** Raiz do Remotion — hoje só usada pelo Studio/CLI. O app usa o <Player>
 * (app/revisao-inteligente). Para gerar MP4 no futuro, basta renderizar a
 * composition "SmartReview" com os mesmos inputProps que o Player recebe. */
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="SmartReview"
        component={SmartReview}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          attemptId: "",
          studentFirstName: "Aluno",
          totalQuestions: 0,
          answeredQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          score: 0,
          topics: [],
          sections: [],
          priorityConcepts: [],
          nextStep: "",
        }}
        calculateMetadata={calculateSmartReviewMetadata}
      />
      <Composition
        id="SmartReviewPortrait"
        component={SmartReview}
        durationInFrames={300}
        fps={30}
        width={FORMATS.portrait.width}
        height={FORMATS.portrait.height}
        defaultProps={{
          attemptId: "",
          studentFirstName: "Aluno",
          totalQuestions: 0,
          answeredQuestions: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          score: 0,
          topics: [],
          sections: [],
          priorityConcepts: [],
          nextStep: "",
        }}
        calculateMetadata={calculateSmartReviewMetadata}
      />
    </>
  );
}
