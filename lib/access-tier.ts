export const TRIAL_DAYS = 7;

export type AccessTier = "trial" | "free" | "pro";

export type TierLimits = {
  /** Atendimentos com o Paciente Virtual por janela (dia ou semana). */
  consultations: number;
  consultationWindow: "dia" | "semana";
  examsPerConsultation: number;
  auscultationAllowed: boolean;
  simuladosPerDay: number;
  /** Cartas diferentes revisadas por dia nos Flashcards. */
  flashcardsPerDay: number;
};

/* O gratuito prova um pouco do Pro (1 consulta por semana, flashcards
   diários) para criar o hábito e encontrar o limite no momento de valor. */
export const TIER_LIMITS: Record<AccessTier, TierLimits> = {
  trial: { consultations: 2, consultationWindow: "dia", examsPerConsultation: 5, auscultationAllowed: true, simuladosPerDay: 1, flashcardsPerDay: Infinity },
  free: { consultations: 1, consultationWindow: "semana", examsPerConsultation: 2, auscultationAllowed: false, simuladosPerDay: 0, flashcardsPerDay: 20 },
  pro: { consultations: 3, consultationWindow: "dia", examsPerConsultation: Infinity, auscultationAllowed: true, simuladosPerDay: 3, flashcardsPerDay: Infinity },
};

export function daysSince(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const diffMs = Date.now() - new Date(dateIso).getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/** Determina o nível de acesso: Pro pago > trial de 7 dias > básico gratuito. */
export function getAccessTier(proActive: boolean, trialStartedAt: string | null | undefined): AccessTier {
  if (proActive) return "pro";
  const elapsed = daysSince(trialStartedAt);
  if (elapsed !== null && elapsed <= TRIAL_DAYS) return "trial";
  return "free";
}

export function trialDaysLeft(trialStartedAt: string | null | undefined): number {
  const elapsed = daysSince(trialStartedAt);
  if (elapsed === null) return 0;
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}
