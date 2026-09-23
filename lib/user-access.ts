import type { createClient } from "@/lib/supabase/server";
import { isProActive } from "@/lib/pro";
import { startOfBrasiliaDayUtc } from "@/lib/ai-usage";
import { getAccessTier, trialDaysLeft, TIER_LIMITS, type AccessTier, type TierLimits } from "@/lib/access-tier";

/** Início da janela de um limite: meia-noite de Brasília (dia) ou os
 * últimos 7 dias corridos (semana). */
export function limitWindowStart(window: "dia" | "semana"): string {
  return window === "dia" ? startOfBrasiliaDayUtc() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export type UserAccess = {
  tier: AccessTier;
  trialDaysLeft: number;
  limits: TierLimits;
};

export async function resolveUserAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<UserAccess> {
  const [{ data: sub }, { data: profile }] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("trial_started_at, pro_granted_until").eq("id", userId).single(),
  ]);
  // Pro "de verdade" (Cakto) OU Pro ganho pelo programa de indicação — o
  // segundo nunca substitui o primeiro, só soma outra forma de ter acesso.
  const grantedProActive = !!profile?.pro_granted_until && new Date(profile.pro_granted_until).getTime() > Date.now();
  const tier = getAccessTier(isProActive(sub?.status) || grantedProActive, profile?.trial_started_at);
  return { tier, trialDaysLeft: trialDaysLeft(profile?.trial_started_at), limits: TIER_LIMITS[tier] };
}
