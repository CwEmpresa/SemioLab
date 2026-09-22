/** Contrato entre o servidor (lib/smart-review.ts) e a composition
 * SmartReview. Tudo aqui é JSON serializável, para servir tanto ao
 * <Player> quanto a uma renderização futura em MP4 via inputProps. */

export type ReviewDifficulty = "facil" | "medio" | "dificil" | "desconhecida";

export type ReviewQuestion = {
  /** Número da questão no simulado (1-based, na ordem em que foi exibida). */
  number: number;
  topic: string;
  subtopic: string | null;
  difficulty: ReviewDifficulty;
  statement: string;
  /** null = não respondida (tempo esgotado ou simulado finalizado antes). */
  selectedLetter: string | null;
  selectedText: string | null;
  correctLetter: string;
  correctText: string;
  /** null quando a questão não tem explicação cadastrada. */
  explanation: string | null;
  /** Conceito central extraído da explicação (ou da alternativa correta). */
  keyPoint: string;
};

export type TopicPerformance = {
  topic: string;
  total: number;
  correct: number;
  /** 0–100 */
  accuracy: number;
};

/** Um bloco da revisão: vários erros do mesmo assunto viram um grupo; um
 * erro isolado vira uma questão individual. */
export type ReviewSection =
  | { kind: "group"; title: string; topic: string; accuracy: number; questions: ReviewQuestion[] }
  | { kind: "single"; question: ReviewQuestion };

export type SmartReviewProps = {
  attemptId: string;
  studentFirstName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  /** 0–100 */
  score: number;
  /** Ordenados do pior para o melhor desempenho. */
  topics: TopicPerformance[];
  /** Já na ordem de prioridade da revisão. */
  sections: ReviewSection[];
  /** Até 3 conceitos prioritários (pontos para memorizar dos erros mais relevantes). */
  priorityConcepts: string[];
  nextStep: string;
};
