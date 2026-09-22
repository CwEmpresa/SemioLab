import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserAccess } from "@/lib/user-access";
import { startOfBrasiliaDayUtc } from "@/lib/ai-usage";
import { buildResearch, normalizeQuery, ResearchError } from "@/lib/research";
import { RESEARCH_LIMITS, type ResearchHistoryItem, type ResearchQuota, type ResearchResult } from "@/lib/research-types";

export const dynamic = "force-dynamic";
/** Busca nas fontes + geração com IA pode passar de 30 s. */
export const maxDuration = 60;

const MIN_QUERY = 3;
const MAX_QUERY = 80;

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Pesquisas usadas na janela do plano (dia de Brasília ou últimos 7 dias). */
async function getQuota(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<ResearchQuota> {
  const { tier } = await resolveUserAccess(supabase, userId);
  const rule = RESEARCH_LIMITS[tier];
  const since = rule.window === "dia" ? startOfBrasiliaDayUtc() : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("topic_research")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return { used: count ?? 0, limit: rule.limit, window: rule.window, tier };
}

export async function GET(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    // RLS garante que só as pesquisas do próprio aluno são lidas.
    const { data } = await supabase.from("topic_research").select("id, result, saved_flashcards").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!data) return Response.json({ error: "Pesquisa não encontrada." }, { status: 404 });
    return Response.json({ id: data.id, result: data.result as ResearchResult, savedFlashcards: data.saved_flashcards });
  }

  const [{ data: rows }, quota] = await Promise.all([
    supabase.from("topic_research").select("id, query, result->>title, saved_flashcards, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    getQuota(supabase, user.id),
  ]);
  const history: ResearchHistoryItem[] = (rows ?? []).map((row) => {
    const r = row as unknown as { id: string; query: string; title: string | null; saved_flashcards: boolean; created_at: string };
    return { id: r.id, query: r.query, title: r.title ?? r.query, createdAt: r.created_at, savedFlashcards: r.saved_flashcards };
  });
  return Response.json({ history, quota });
}

export async function POST(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? "").replace(/\s+/g, " ").trim();
  if (query.length < MIN_QUERY || query.length > MAX_QUERY) {
    return Response.json({ error: `Digite um tema entre ${MIN_QUERY} e ${MAX_QUERY} caracteres.` }, { status: 400 });
  }
  const key = normalizeQuery(query);

  // Mesmo tema já pesquisado: devolve o salvo, sem gastar IA nem cota.
  const { data: existing } = await supabase.from("topic_research").select("id, result, saved_flashcards").eq("user_id", user.id).eq("query_key", key).maybeSingle();
  if (existing) {
    return Response.json({ id: existing.id, result: existing.result as ResearchResult, savedFlashcards: existing.saved_flashcards, reused: true });
  }

  const quota = await getQuota(supabase, user.id);
  if (quota.used >= quota.limit) {
    return Response.json(
      {
        error:
          quota.tier === "free"
            ? "Você já usou a pesquisa desta semana no plano gratuito. No Pro são até 10 por dia."
            : `Você chegou ao limite de ${quota.limit} pesquisas por dia. O limite reinicia à meia-noite (horário de Brasília).`,
        limitReached: true,
        quota,
      },
      { status: 403 },
    );
  }

  const service = createServiceClient();
  let result: ResearchResult;
  try {
    result = await buildResearch(query, user.id, service);
  } catch (error) {
    if (error instanceof ResearchError) return Response.json({ error: error.message }, { status: 422 });
    console.error("[research] falha ao gerar pesquisa", error instanceof Error ? error.message : "erro desconhecido");
    return Response.json({ error: "Não consegui montar o material agora. Tente de novo em instantes." }, { status: 502 });
  }

  const { data: inserted, error } = await service
    .from("topic_research")
    .upsert({ user_id: user.id, query, query_key: key, result }, { onConflict: "user_id,query_key" })
    .select("id")
    .single();
  if (error || !inserted) return Response.json({ error: "Não foi possível salvar a pesquisa." }, { status: 500 });

  return Response.json({ id: inserted.id, result, savedFlashcards: false, quota: { ...quota, used: quota.used + 1 } });
}

/** Salva os flashcards da pesquisa na tela de Flashcards. */
export async function PATCH(request: Request) {
  const { user } = await getContext();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; saveFlashcards?: boolean };
  if (!body.id || typeof body.saveFlashcards !== "boolean") return Response.json({ error: "Dados inválidos." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("topic_research")
    .update({ saved_flashcards: body.saveFlashcards })
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return Response.json({ error: "Pesquisa não encontrada." }, { status: 404 });
  return Response.json({ ok: true });
}
