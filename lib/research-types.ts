/** Formato de uma Pesquisa por tema, igual no servidor e na tela. */

export type ResearchSource = {
  n: number;
  /** "wikipedia" só aparece em pesquisas salvas antes da troca de fontes. */
  kind: "semiolab" | "statpearls" | "pubmed" | "medlineplus" | "wikipedia";
  title: string;
  url: string | null;
  /** Módulo da área de Semiologia, quando a fonte é o próprio SemioLab. */
  moduleId: string | null;
};

export type ResearchImage = {
  title: string;
  description: string;
  thumbUrl: string;
  fullUrl: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string | null;
};

export type ResearchQuizItem = { question: string; options: string[]; correctIndex: number; explanation: string };

export type ResearchResult = {
  query: string;
  title: string;
  overview: string;
  sections: { heading: string; paragraphs: string[] }[];
  keyPoints: string[];
  mindMap: { center: string; branches: { label: string; children: string[] }[] };
  flashcards: { front: string; back: string }[];
  quiz: ResearchQuizItem[];
  sources: ResearchSource[];
  images: ResearchImage[];
  semiologyModules: { id: string; title: string }[];
  /** Tema do banco de questões para o botão "Quiz do banco", se houver. */
  quizTopic: string | null;
  generatedAt: string;
};

export type ResearchQuota = { used: number; limit: number; window: "dia" | "semana"; tier: "trial" | "free" | "pro" };

export type ResearchHistoryItem = { id: string; query: string; title: string; createdAt: string; savedFlashcards: boolean };

/** Pesquisas permitidas por plano: Pro e trial por dia, gratuito por semana. */
export const RESEARCH_LIMITS = {
  pro: { limit: 10, window: "dia" },
  trial: { limit: 3, window: "dia" },
  free: { limit: 1, window: "semana" },
} as const;
