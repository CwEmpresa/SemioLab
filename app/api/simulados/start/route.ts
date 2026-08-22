import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserAccess } from "@/lib/user-access";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import { startOfBrasiliaDayUtc } from "@/lib/ai-usage";

export const dynamic = "force-dynamic";

const QUESTIONS_PER_SIMULADO = 10;

type PublicQuestion = { id: string; topic: string; difficulty: string; text: string; options: string[]; orderIndex: number; answered: boolean };

async function loadAttemptQuestions(service: ReturnType<typeof createServiceClient>, attemptId: string): Promise<PublicQuestion[]> {
  const { data: rows } = await service
    .from("simulado_attempt_questions")
    .select("question_id, order_index, selected_index, simulado_questions(id, topic, difficulty, text, options)")
    .eq("attempt_id", attemptId)
    .order("order_index", { ascending: true });
  return (rows ?? []).map((row) => {
    const q = row.simulado_questions as unknown as { id: string; topic: string; difficulty: string; text: string; options: string[] };
    return {
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      text: q.text,
      options: q.options,
      orderIndex: row.order_index,
      answered: row.selected_index !== null,
    };
  });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const access = await resolveUserAccess(supabase, user.id);
  const service = createServiceClient();

  // 1) Retomada: se já existe tentativa em andamento (de qualquer dia), ela
  // é devolvida — nunca cria outra nem consome novo cupo diário.
  const { data: existing } = await service
    .from("simulado_attempts")
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .maybeSingle();
  if (existing) {
    const questions = await loadAttemptQuestions(service, existing.id);
    return Response.json({ attemptId: existing.id, resumed: true, questions, totalQuestions: QUESTIONS_PER_SIMULADO });
  }

  // 2) Limite diário — sempre do usuário autenticado e de dados do
  // Supabase, nunca do cliente. Reinicia à meia-noite de Brasília.
  const dailyLimit = access.limits.simuladosPerDay;
  const startOfDay = startOfBrasiliaDayUtc();
  const { count: usedToday } = await supabase
    .from("simulado_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("started_at", startOfDay);
  const simuladosUsedToday = usedToday ?? 0;

  if (simuladosUsedToday >= dailyLimit) {
    return Response.json(
      {
        error:
          dailyLimit === 0
            ? "Simulados são um recurso exclusivo do plano Pro (ou do período de teste)."
            : `Você atingiu o limite diário de ${dailyLimit} simulado${dailyLimit > 1 ? "s" : ""}. O limite reinicia à meia-noite (horário de Brasília).`,
        limitReached: true,
        code: "DAILY_LIMIT_REACHED",
        tier: access.tier,
        simuladosUsedToday,
        simuladosLimitToday: dailyLimit,
        checkoutUrls: CAKTO_CHECKOUT_URLS,
      },
      { status: 403 },
    );
  }

  // 3) Seleciona 10 questões nunca vistas por este usuário (nenhuma
  // tentativa, concluída ou não, já expôs essas questões a ele). Nunca
  // reatribui, mesmo após trial→pro, logout ou troca de dispositivo.
  const { data: seenRows } = await service
    .from("simulado_attempt_questions")
    .select("question_id, simulado_attempts!inner(user_id)")
    .eq("simulado_attempts.user_id", user.id);
  const seenIds = new Set((seenRows ?? []).map((r) => r.question_id));

  const { data: allActive } = await service
    .from("simulado_questions")
    .select("id")
    .eq("is_active", true);
  const availableIds = (allActive ?? []).map((q) => q.id).filter((id) => !seenIds.has(id));

  if (availableIds.length < QUESTIONS_PER_SIMULADO) {
    // Nunca inventa nem repete questão em tempo real: estado explícito.
    return Response.json(
      {
        error: "Banco de questões insuficiente para um novo simulado no momento.",
        code: "INSUFFICIENT_QUESTION_BANK",
        availableQuestions: availableIds.length,
        requiredQuestions: QUESTIONS_PER_SIMULADO,
      },
      { status: 409 },
    );
  }

  const chosen = [...availableIds].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_SIMULADO);

  // 4) Criação atômica: se duas requisições concorrentes tentarem iniciar
  // ao mesmo tempo, o índice único parcial (user_id) where status='in_progress'
  // deixa só uma vencer; a outra recebe 23505 e simplesmente relê a
  // tentativa que a primeira já criou (mesma resposta de "retomada").
  const { data: created, error: createError } = await service
    .from("simulado_attempts")
    .insert({ user_id: user.id, status: "in_progress" })
    .select("id")
    .single();

  if (createError || !created) {
    const { data: raceWinner } = await service
      .from("simulado_attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle();
    if (raceWinner) {
      const questions = await loadAttemptQuestions(service, raceWinner.id);
      return Response.json({ attemptId: raceWinner.id, resumed: true, questions, totalQuestions: QUESTIONS_PER_SIMULADO });
    }
    console.error("[simulados/start] falha ao criar tentativa", createError?.message);
    return Response.json({ error: "Não foi possível iniciar o simulado agora.", code: "CREATE_ERROR" }, { status: 500 });
  }

  const { error: linkError } = await service.from("simulado_attempt_questions").insert(
    chosen.map((questionId, index) => ({ attempt_id: created.id, question_id: questionId, order_index: index })),
  );
  if (linkError) {
    // Reverte a tentativa para não deixar um "in_progress" órfão sem
    // questões — libera o índice único para uma nova tentativa real.
    await service.from("simulado_attempts").delete().eq("id", created.id);
    console.error("[simulados/start] falha ao vincular questões", linkError.message);
    return Response.json({ error: "Não foi possível iniciar o simulado agora.", code: "CREATE_ERROR" }, { status: 500 });
  }

  const questions = await loadAttemptQuestions(service, created.id);
  return Response.json({ attemptId: created.id, resumed: false, questions, totalQuestions: QUESTIONS_PER_SIMULADO, simuladosUsedToday: simuladosUsedToday + 1, simuladosLimitToday: dailyLimit });
}
