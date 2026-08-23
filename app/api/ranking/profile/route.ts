import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { brasiliaDateKey } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

function computeStreak(loginDays: string[]): number {
  const set = new Set(loginDays);
  const cursor = new Date();
  let streak = 0;
  for (;;) {
    const key = brasiliaDateKey(cursor);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const targetUserId = new URL(request.url).searchParams.get("userId");
  if (!targetUserId) return Response.json({ error: "userId obrigatório." }, { status: 400 });

  const { data: rows, error } = await supabase.rpc("ranking_top");
  if (error || !rows) return Response.json({ error: "Não foi possível verificar o acesso." }, { status: 500 });

  const target = rows.find((r: { user_id: string; rank: number }) => r.user_id === targetUserId);
  const isSelf = targetUserId === user.id;
  const isTop10 = target && target.rank <= 10;
  if (!target || (!isSelf && !isTop10)) {
    return Response.json({ error: "Perfil não disponível." }, { status: 403 });
  }

  const service = createServiceClient();
  const [{ data: profile }, { data: loginDaysRows }] = await Promise.all([
    service.from("profiles").select("avatar_path, cover_path").eq("id", targetUserId).maybeSingle(),
    service.from("login_days").select("activity_date").eq("user_id", targetUserId),
  ]);

  let avatarUrl: string | null = null;
  let coverUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await service.storage.from("avatars").createSignedUrl(profile.avatar_path, 300);
    avatarUrl = data?.signedUrl ?? null;
  }
  if (profile?.cover_path) {
    const { data } = await service.storage.from("avatars").createSignedUrl(profile.cover_path, 300);
    coverUrl = data?.signedUrl ?? null;
  }

  const xp = target.xp;
  const level = Math.floor(xp / 500) + 1;
  const levelProgress = Math.round(((xp % 500) / 500) * 100);

  return Response.json({
    displayName: target.display_name,
    rank: target.rank,
    xp,
    level,
    levelProgress,
    streak: computeStreak((loginDaysRows ?? []).map((r) => r.activity_date)),
    avatarUrl,
    coverUrl,
  });
}
