import { createServiceClient } from "@/lib/supabase/service";
import { QUESTION_GENERATION_ENABLED } from "@/lib/openai";
import { countPublishedByTopic, countPublishedTotal } from "@/lib/question-bank";
import { generateAndValidateBatch } from "@/lib/question-generation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TOPICS = ["Cardiovascular", "Respiratório", "Neurológico", "Abdome", "Anamnese", "Exame físico"];
const QUIZ_TARGET_PER_TOPIC = 30;
const TRIAL_TARGET_TOTAL = 70;
const PRO_TARGET_TOTAL = 500;
const PRO_REPLENISH_THRESHOLD = 150;
// Teto de questões geradas por execução — evita custo descontrolado e
// timeout; jobs repetidos vão completando as metas aos poucos.
const MAX_QUESTIONS_PER_RUN = 8;
const DIFFICULTIES = ["facil", "medio", "dificil"] as const;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET não configurado — job inacessível." }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!QUESTION_GENERATION_ENABLED) {
    return Response.json({ ok: true, skipped: true, reason: "QUESTION_GENERATION_ENABLED não está ativo." });
  }

  const service = createServiceClient();

  // Trava: só uma execução por vez (índice único parcial em status='running').
  const { data: job, error: jobError } = await service
    .from("question_generation_jobs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (jobError || !job) {
    return Response.json({ ok: false, error: "Já existe uma execução de abastecimento em andamento." }, { status: 409 });
  }

  try {
    const countsByTopic = await countPublishedByTopic(service);
    const total = await countPublishedTotal(service);
    const difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];

    let target: { topic: string; reason: string } | null = null;

    const belowQuiz = TOPICS.find((t) => (countsByTopic[t] ?? 0) < QUIZ_TARGET_PER_TOPIC);
    if (belowQuiz) {
      target = { topic: belowQuiz, reason: `completar Quiz (${countsByTopic[belowQuiz] ?? 0}/${QUIZ_TARGET_PER_TOPIC}) no tema ${belowQuiz}` };
    } else if (total < TRIAL_TARGET_TOTAL) {
      const weakest = [...TOPICS].sort((a, b) => (countsByTopic[a] ?? 0) - (countsByTopic[b] ?? 0))[0];
      target = { topic: weakest, reason: `completar estoque Trial (${total}/${TRIAL_TARGET_TOTAL})` };
    } else if (total < PRO_TARGET_TOTAL) {
      const weakest = [...TOPICS].sort((a, b) => (countsByTopic[a] ?? 0) - (countsByTopic[b] ?? 0))[0];
      target = { topic: weakest, reason: `completar estoque Pro (${total}/${PRO_TARGET_TOTAL})` };
    } else {
      // Estoque-base atingido: só repõe se o usuário mais avançado estiver
      // com menos de 150 questões inéditas restantes.
      const { data: exposureRows } = await service
        .from("simulado_attempt_questions")
        .select("question_id, simulado_attempts!inner(user_id)");
      const perUser = new Map<string, Set<string>>();
      for (const row of exposureRows ?? []) {
        const userId = (row.simulado_attempts as unknown as { user_id: string }).user_id;
        if (!perUser.has(userId)) perUser.set(userId, new Set());
        perUser.get(userId)!.add(row.question_id);
      }
      const maxSeen = Math.max(0, ...[...perUser.values()].map((s) => s.size));
      const unseenForMostAdvanced = total - maxSeen;
      if (unseenForMostAdvanced < PRO_REPLENISH_THRESHOLD) {
        const weakest = [...TOPICS].sort((a, b) => (countsByTopic[a] ?? 0) - (countsByTopic[b] ?? 0))[0];
        target = { topic: weakest, reason: `reposição Pro (usuário mais avançado com ${unseenForMostAdvanced} inéditas)` };
      }
    }

    if (!target) {
      await service.from("question_generation_jobs").update({
        status: "completed", finished_at: new Date().toISOString(),
        target_summary: { note: "estoque suficiente em todas as metas, nada gerado" }, questions_created: 0, questions_rejected: 0,
      }).eq("id", job.id);
      return Response.json({ ok: true, generated: 0, note: "Estoque suficiente em todas as metas — nada foi gerado." });
    }

    const outcome = await generateAndValidateBatch(service, target.topic, difficulty, MAX_QUESTIONS_PER_RUN);

    await service.from("question_generation_jobs").update({
      status: "completed", finished_at: new Date().toISOString(),
      target_summary: { topic: target.topic, difficulty, reason: target.reason },
      questions_created: outcome.created, questions_rejected: outcome.rejected,
    }).eq("id", job.id);

    return Response.json({ ok: true, target: target.reason, difficulty, ...outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/generate-questions] falha na execução", message);
    await service.from("question_generation_jobs").update({
      status: "failed", finished_at: new Date().toISOString(), error_message: message.slice(0, 500),
    }).eq("id", job.id);
    // Nunca publica conteúdo parcial: qualquer falha no meio do lote só
    // deixa questões já validadas (published) ou já marcadas (rejected);
    // nada fica em estado intermediário.
    return Response.json({ ok: false, error: "Falha na execução do job." }, { status: 500 });
  }
}
