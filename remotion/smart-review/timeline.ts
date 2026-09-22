import type { ReviewQuestion, ReviewSection, SmartReviewProps } from "./types";

/** Fonte única de verdade da linha do tempo: a composition, o <Player> e o
 * calculateMetadata (renderização futura) usam estas mesmas funções — a
 * duração nunca é calculada em dois lugares. */

export const FPS = 30;
export const TRANSITION_FRAMES = 12;

/** Paisagem 16:9 no desktop; retrato 9:16 no celular (formato de vídeo
 * vertical, com altura para tipografia maior em telas estreitas). */
export const FORMATS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
} as const;
export type ReviewFormat = keyof typeof FORMATS;

/** Limite de questões com sequência completa; excedentes aparecem só nos
 * resumos dos grupos (um simulado tem 10 questões, mas o código não assume). */
export const MAX_QUESTION_SCENES = 12;
/** Pontos listados na cena de abertura de um grupo. */
export const MAX_GROUP_POINTS = 4;
export const MAX_PERFORMANCE_TOPICS = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const seconds = (value: number, fps: number) => Math.round(value * fps);

export type QuestionPhases = { statement: number; answer: number; explanation: number; keyPoint: number };

export type TimelineScene =
  | { kind: "intro"; key: string; durationInFrames: number }
  | { kind: "performance"; key: string; durationInFrames: number }
  | { kind: "group"; key: string; durationInFrames: number; section: Extract<ReviewSection, { kind: "group" }>; priority: number }
  | { kind: "question"; key: string; durationInFrames: number; question: ReviewQuestion; phases: QuestionPhases; position: number; count: number }
  | { kind: "summary"; key: string; durationInFrames: number };

/** Tempo de leitura: base + caracteres por segundo, limitado a uma faixa. */
export function questionPhases(question: ReviewQuestion, fps: number): QuestionPhases {
  const explanationLength = (question.explanation ?? question.correctText).length;
  return {
    statement: seconds(clamp(3 + question.statement.length / 24, 4, 11), fps),
    answer: seconds(3.6, fps),
    explanation: seconds(clamp(3 + explanationLength / 20, 5, 15), fps),
    keyPoint: seconds(4.2, fps),
  };
}

export function buildTimeline(props: SmartReviewProps, fps: number): TimelineScene[] {
  const scenes: TimelineScene[] = [
    { kind: "intro", key: "intro", durationInFrames: seconds(5.5, fps) },
    {
      kind: "performance",
      key: "performance",
      durationInFrames: seconds(3.2 + 0.5 * Math.min(props.topics.length, MAX_PERFORMANCE_TOPICS), fps),
    },
  ];

  const orderedQuestions = props.sections.flatMap((s) => (s.kind === "group" ? s.questions : [s.question]));
  const withFullScene = new Set(orderedQuestions.slice(0, MAX_QUESTION_SCENES).map((q) => q.number));
  let position = 0;
  let priority = 0;

  for (const section of props.sections) {
    if (section.kind === "group") {
      priority += 1;
      const points = Math.min(section.questions.length, MAX_GROUP_POINTS);
      scenes.push({ kind: "group", key: `group-${section.title}-${priority}`, durationInFrames: seconds(3.6 + 1.6 * points, fps), section, priority });
    }
    for (const question of section.kind === "group" ? section.questions : [section.question]) {
      if (!withFullScene.has(question.number)) continue;
      position += 1;
      const phases = questionPhases(question, fps);
      scenes.push({
        kind: "question",
        key: `question-${question.number}`,
        durationInFrames: phases.statement + phases.answer + phases.explanation + phases.keyPoint,
        question,
        phases,
        position,
        count: withFullScene.size,
      });
    }
  }

  scenes.push({ kind: "summary", key: "summary", durationInFrames: seconds(props.wrongAnswers === 0 ? 7 : 8.5, fps) });
  return scenes;
}

export function getSmartReviewDuration(props: SmartReviewProps, fps = FPS) {
  const scenes = buildTimeline(props, fps);
  const total = scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  return total - TRANSITION_FRAMES * (scenes.length - 1);
}

/** Duração legível ("50 s", "3 min") para a página e a capa do Player. */
export function formatReviewDuration(frames: number, fps = FPS) {
  const totalSeconds = Math.round(frames / fps);
  return totalSeconds < 90 ? `${totalSeconds} s` : `${Math.round(totalSeconds / 60)} min`;
}

/** Frame inicial de cada questão no vídeo (cada transição sobrepõe a cena
 * anterior), para o app pular direto a ela no <Player>. */
export function getQuestionStartFrames(props: SmartReviewProps, fps = FPS): Record<number, number> {
  const starts: Record<number, number> = {};
  let cursor = 0;
  buildTimeline(props, fps).forEach((scene, index) => {
    const start = index === 0 ? 0 : cursor - TRANSITION_FRAMES;
    if (scene.kind === "question") starts[scene.question.number] = start + TRANSITION_FRAMES;
    cursor = start + scene.durationInFrames;
  });
  return starts;
}
