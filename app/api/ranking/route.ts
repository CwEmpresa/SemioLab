import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { brasiliaDateKey } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

/** Segunda-feira da semana atual, calendário de Brasília (mesma fonte de
 * data usada em todo o projeto — nunca o fuso do runtime). */
function currentWeekStart(): string {
  const todayKey = brasiliaDateKey();
  const d = new Date(`${todayKey}T12:00:00Z`);
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - weekday);
  return brasiliaDateKey(d);
}
function previousWeekStart(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return brasiliaDateKey(d);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { data: rows, error } = await supabase.rpc("ranking_top");
  if (error || !rows) return Response.json({ error: "Não foi possível carregar o ranking." }, { status: 500 });

  const me = rows.find((r: { is_me: boolean }) => r.is_me);
  const service = createServiceClient();
  const weekStart = currentWeekStart();

  // Fotos só para quem já está neste conjunto (Top10 + eu + a posição
  // imediatamente anterior) — a RPC já restringe isso, nunca busca além.
  const userIds = rows.map((r: { user_id: string }) => r.user_id);
  const { data: avatarRows } = await service.from("profiles").select("id, avatar_path").in("id", userIds).not("avatar_path", "is", null);
  const avatarUrlByUser = new Map<string, string>();
  for (const row of avatarRows ?? []) {
    if (!row.avatar_path) continue;
    const { data: signed } = await service.storage.from("avatars").createSignedUrl(row.avatar_path, 3600);
    if (signed?.signedUrl) avatarUrlByUser.set(row.id, signed.signedUrl);
  }
  const withAvatars = rows.map((r: { user_id: string }) => ({ ...r, avatarUrl: avatarUrlByUser.get(r.user_id) ?? null }));

  // Snapshot semanal preguiçoso e idempotente: só grava se ainda não existe
  // um snapshot desta semana para este usuário (unique constraint garante
  // 1 por usuário+semana mesmo com requisições concorrentes).
  if (me) {
    await service
      .from("weekly_rank_snapshots")
      .insert({ user_id: user.id, week_start: weekStart, rank: me.rank, xp: me.xp })
      .then(() => {}, () => {}); // conflito = já existe; ignora silenciosamente
  }

  let weeklyChange: number | null = null;
  if (me) {
    const { data: prevSnapshot } = await service
      .from("weekly_rank_snapshots")
      .select("rank")
      .eq("user_id", user.id)
      .eq("week_start", previousWeekStart(weekStart))
      .maybeSingle();
    // Só mostra movimento quando existe um snapshot real da semana
    // anterior — nunca inventa "mudança" antes de haver histórico.
    if (prevSnapshot) weeklyChange = prevSnapshot.rank - me.rank; // positivo = subiu
  }

  const podium = withAvatars.filter((r: { rank: number }) => r.rank <= 3);
  const list = withAvatars.filter((r: { rank: number }) => r.rank >= 4 && r.rank <= 10);
  const meWithAvatar = withAvatars.find((r: { is_me: boolean }) => r.is_me);
  const outsideTop10 = meWithAvatar && meWithAvatar.rank > 10 ? meWithAvatar : null;
  const previousRankRow = outsideTop10 ? withAvatars.find((r: { rank: number }) => r.rank === outsideTop10.rank - 1) : null;
  const distanceToPrevious = outsideTop10 && previousRankRow ? previousRankRow.xp - outsideTop10.xp : null;

  return Response.json({
    podium,
    list,
    me: meWithAvatar ? { ...meWithAvatar, weeklyChange } : null,
    outsideTop10: outsideTop10 ? { ...outsideTop10, weeklyChange, distanceToPrevious } : null,
  });
}
