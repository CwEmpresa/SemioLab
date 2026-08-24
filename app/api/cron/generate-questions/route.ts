import { createServiceClient } from "@/lib/supabase/service";
import { QUESTION_GENERATION_ENABLED } from "@/lib/openai";
import { countPublishedByTopic, countPublishedTotal } from "@/lib/question-bank";
import { generateAndValidateBatch, getTodayGenerationCostUsd } from "@/lib/question-generation";
import { timingSafeEqualStrings } from "@/lib/pro";

export const dynamic = "force-dynamic";
// Teto do plano Hobby da Vercel é 60s por função — mantém exatamente nesse
// limite (não dá pra pedir mais no Hobby).
export const maxDuration = 60;

const TOPICS = ["Cardiovascular", "Respiratório", "Neurológico", "Abdome", "Anamnese", "Exame físico"];
const QUIZ_TARGET_PER_TOPIC = 30;
const TRIAL_TARGET_TOTAL = 70;
const PRO_TARGET_TOTAL = 500;
const PRO_REPLENISH_THRESHOLD = 150;
// Até 40 aprovadas por execução (antes eram 8) — mas nunca de uma vez só:
// sempre em lotes pequenos internos, para nunca estourar o timeout do
// Hobby nem gerar uma única chamada gigante à API.
const MAX_APPROVED_PER_RUN = 40;
const BATCH_SIZE = 8;
// Margem de segurança bem abaixo dos 60s do Hobby — pára de pedir novos
// lotes antes de arriscar timeout no meio de uma chamada à API.
const TIME_BUDGET_MS = 45_000;
// Limite de custo diário — configurável, padrão conservador. Ao atingir,
// pára sem tentar mais nenhum lote nesta execução nem em outras no mesmo
// dia (verificado de novo em cada execução, soma real de ai_usage_logs).
const DAILY_COST_LIMIT_USD = Number(process.env.QUESTION_GENERATION_DAILY_COST_LIMIT_USD ?? "1.00");
const DIFFICULTIES = ["facil", "medio", "dificil"] as const;

async function pickTarget(service: ReturnType<typeof createServiceClient>): Promise<{ topic: string; reason: string } | null> {
  const countsByTopic = await countPublishedByTopic(service);
  const total = await countPublishedTotal(service);

  const belowQuiz = TOPICS.find((t) => (countsByTopic[t] ?? 0) < QUIZ_TARGET_PER_TOPIC);
  if (belowQuiz) return { topic: belowQuiz, reason: `completar Quiz (${countsByTopic[belowQuiz] ?? 0}/${QUIZ_TARGET_PER_TOPIC}) no tema ${belowQuiz}` };

  const weakest = () => [...TOPICS].sort((a, b) => (countsByTopic[a] ?? 0) - (countsByTopic[b] ?? 0))[0];
  if (total < TRIAL_TARGET_TOTAL) return { topic: weakest(), reason: `completar estoque Trial (${total}/${TRIAL_TARGET_TOTAL})` };
  if (total < PRO_TARGET_TOTAL) return { topic: weakest(), reason: `completar estoque Pro (${total}/${PRO_TARGET_TOTAL})` };

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
    return { topic: weakest(), reason: `reposição Pro (usuário mais avançado com ${unseenForMostAdvanced} inéditas)` };
  }
  return null;
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET não configurado — job inacessível." }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(auth, `Bearer ${secret}`)) {
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

  const startedAt = Date.now();
  let totalCreated = 0;
  let totalRejected = 0;
  let stopReason: string | null = null;
  let consecutiveEmptyBatches = 0;

  try {
    while (totalCreated < MAX_APPROVED_PER_RUN) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        stopReason = "margem de tempo da execução atingida (protege o timeout do Hobby)";
        break;
      }

      const costToday = await getTodayGenerationCostUsd(service);
      if (costToday >= DAILY_COST_LIMIT_USD) {
        stopReason = `limite de custo diário atingido ($${costToday.toFixed(4)} de $${DAILY_COST_LIMIT_USD.toFixed(2)})`;
        break;
      }

      const target = await pickTarget(service);
      if (!target) {
        stopReason = "estoque suficiente em todas as metas — nada a gerar";
        break;
      }

      const difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
      const batchAsk = Math.min(BATCH_SIZE, MAX_APPROVED_PER_RUN - totalCreated);

      try {
        const outcome = await generateAndValidateBatch(service, target.topic, difficulty, batchAsk);
        totalCreated += outcome.created;
        totalRejected += outcome.rejected;
        consecutiveEmptyBatches = outcome.created === 0 ? consecutiveEmptyBatches + 1 : 0;
        if (consecutiveEmptyBatches >= 3) {
          stopReason = "vários lotes seguidos sem nenhuma aprovação — interrompido por segurança";
          break;
        }
      } catch (batchErr) {
        // Um lote com falha NUNCA apaga os lotes já aprovados antes dele
        // (cada questão já foi inserida individualmente, de forma
        // definitiva, dentro de generateAndValidateBatch) — só encerra a
        // execução aqui, preservando tudo que já foi publicado.
        console.error("[cron/generate-questions] falha em um lote", batchErr instanceof Error ? batchErr.message : String(batchErr));
        stopReason = "falha em um lote — execução interrompida, lotes já aprovados foram preservados";
        break;
      }
    }
    if (!stopReason && totalCreated >= MAX_APPROVED_PER_RUN) stopReason = "teto de questões aprovadas desta execução atingido";

    await service
      .from("question_generation_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        target_summary: { stopReason },
        questions_created: totalCreated,
        questions_rejected: totalRejected,
      })
      .eq("id", job.id);

    return Response.json({ ok: true, created: totalCreated, rejected: totalRejected, stopReason });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/generate-questions] falha na execução", message);
    // Mesmo numa falha inesperada, o job nunca fica preso em "running":
    // sempre é fechado como failed, com o que já tinha sido aprovado até
    // aqui preservado (cada insert de questão já foi confirmado antes).
    await service
      .from("question_generation_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message.slice(0, 500),
        questions_created: totalCreated,
        questions_rejected: totalRejected,
      })
      .eq("id", job.id);
    return Response.json({ ok: false, error: "Falha na execução do job.", created: totalCreated, rejected: totalRejected }, { status: 500 });
  }
}

// A Vercel Cron sempre dispara via GET, enviando o cabeçalho
// Authorization com CRON_SECRET automaticamente. POST continua disponível
// para disparo manual/teste com a mesma proteção.
export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
