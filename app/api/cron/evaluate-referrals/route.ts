import { createServiceClient } from "@/lib/supabase/service";
import { timingSafeEqualStrings } from "@/lib/pro";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const QUALIFY_DAYS_REQUIRED = 3;
const QUALIFY_WINDOW_DAYS = 7;
const REFERRALS_PER_REWARD = 3;
const GRANT_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET não configurado — job inacessível." }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const service = createServiceClient();

  // 1) Qualifica indicados pendentes: 3 dias DISTINTOS de uso (login_days
  // tem uma linha por (user_id, activity_date), então contar linhas aqui já
  // é contar dias distintos — nunca conta duas vezes o mesmo dia) dentro de
  // 7 dias corridos desde o cadastro.
  const { data: pending } = await service
    .from("profiles")
    .select("id, created_at")
    .not("referred_by", "is", null)
    .eq("referral_qualified", false);

  let qualifiedNow = 0;
  for (const row of pending ?? []) {
    const windowEnd = new Date(new Date(row.created_at).getTime() + QUALIFY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await service
      .from("login_days")
      .select("activity_date", { count: "exact", head: true })
      .eq("user_id", row.id)
      .lt("activity_date", windowEnd);
    if ((count ?? 0) >= QUALIFY_DAYS_REQUIRED) {
      await service.from("profiles").update({ referral_qualified: true }).eq("id", row.id);
      qualifiedNow++;
    }
  }

  // 2) Concede 1 mês de Pro a cada 3 indicados qualificados, sem duplicar —
  // sempre compara contra quantos meses já foram registrados em
  // referral_grants antes de conceder a diferença.
  const { data: qualifiedReferrals } = await service
    .from("profiles")
    .select("referred_by")
    .not("referred_by", "is", null)
    .eq("referral_qualified", true);

  const qualifiedCountByReferrer = new Map<string, number>();
  for (const row of qualifiedReferrals ?? []) {
    const referrerId = row.referred_by as string;
    qualifiedCountByReferrer.set(referrerId, (qualifiedCountByReferrer.get(referrerId) ?? 0) + 1);
  }

  let grantsCreated = 0;
  for (const [referrerId, qualifiedCount] of qualifiedCountByReferrer) {
    const owed = Math.floor(qualifiedCount / REFERRALS_PER_REWARD);
    if (owed <= 0) continue;
    const { count: alreadyGranted } = await service
      .from("referral_grants")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", referrerId);
    const toGrant = owed - (alreadyGranted ?? 0);
    if (toGrant <= 0) continue;

    const { data: referrerProfile } = await service
      .from("profiles")
      .select("pro_granted_until")
      .eq("id", referrerId)
      .single();
    const currentUntilMs = referrerProfile?.pro_granted_until ? new Date(referrerProfile.pro_granted_until).getTime() : 0;
    const base = Math.max(Date.now(), currentUntilMs);
    const newUntil = new Date(base + toGrant * GRANT_MONTH_MS).toISOString();

    await service.from("profiles").update({ pro_granted_until: newUntil }).eq("id", referrerId);
    await service.from("referral_grants").insert(
      Array.from({ length: toGrant }, () => ({ referrer_id: referrerId, months: 1 })),
    );
    grantsCreated += toGrant;
  }

  return Response.json({ ok: true, qualifiedNow, grantsCreated });
}

// A Vercel Cron sempre dispara via GET, enviando o cabeçalho Authorization
// com CRON_SECRET automaticamente. POST continua disponível para disparo
// manual/teste com a mesma proteção — mesmo padrão de
// app/api/cron/generate-questions/route.ts.
export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
