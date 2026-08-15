import type { createClient } from "@/lib/supabase/server";
import { isProActive } from "@/lib/pro";
import { getAccessTier, trialDaysLeft, TIER_LIMITS, type AccessTier } from "@/lib/access-tier";

export type UserAccess = {
  tier: AccessTier;
  trialDaysLeft: number;
  limits: (typeof TIER_LIMITS)[AccessTier];
};

export async function resolveUserAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<UserAccess> {
  const [{ data: sub }, { data: profile }] = await Promise.all([
    supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("trial_started_at").eq("id", userId).single(),
  ]);
  const tier = getAccessTier(isProActive(sub?.status), profile?.trial_started_at);
  return { tier, trialDaysLeft: trialDaysLeft(profile?.trial_started_at), limits: TIER_LIMITS[tier] };
}
