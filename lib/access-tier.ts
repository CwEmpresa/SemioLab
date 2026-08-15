export const TRIAL_DAYS = 7;

export type AccessTier = "trial" | "free" | "pro";

export const TIER_LIMITS: Record<AccessTier, { consultationsPerDay: number; examsPerConsultation: number; auscultationAllowed: boolean }> = {
  trial: { consultationsPerDay: 3, examsPerConsultation: 5, auscultationAllowed: true },
  free: { consultationsPerDay: 1, examsPerConsultation: 1, auscultationAllowed: false },
  pro: { consultationsPerDay: Infinity, examsPerConsultation: Infinity, auscultationAllowed: true },
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
