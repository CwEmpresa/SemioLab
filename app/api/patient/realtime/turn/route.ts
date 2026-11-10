import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { logAudioUsage } from "@/lib/ai-usage";
import { MAX_MESSAGE_LENGTH, MAX_STUDENT_MESSAGES_PER_SESSION } from "@/lib/patient-ai-rules";
import { estimateRealtimeCostUsd, REALTIME_MODEL, type RealtimeUsage } from "@/lib/realtime-voice";

export const dynamic = "force-dynamic";

/** Salva uma troca da conversa por voz (pergunta do aluno + resposta do
 * paciente) e conta a pergunta no limite da consulta — a mesma conta da
 * consulta por texto, para a avaliação final ver a conversa inteira. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const [userId, body] = await Promise.all([
    getAuthUserId(supabase),
    request.json().catch(() => ({})) as Promise<{ sessionId?: string; student?: string; patient?: string; usage?: RealtimeUsage[] }>,
  ]);
  if (!userId) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const sessionId = body.sessionId;
  const student = typeof body.student === "string" ? body.student.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  const patient = typeof body.patient === "string" ? body.patient.trim().slice(0, 2000) : "";
  const hasUsage = Array.isArray(body.usage) && body.usage.length > 0;
  if (!sessionId || (!student && !patient && !hasUsage)) return Response.json({ error: "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });

  const service = createServiceClient();
  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, status, message_count")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
  }

  // Conta a pergunta (compare-and-swap; tenta de novo se outra troca gravou
  // ao mesmo tempo). A fala já aconteceu na ligação, então a troca é salva
  // mesmo no limite — o cliente encerra a ligação quando chega nele.
  let questionsUsed = session.message_count;
  if (student) {
    let current = session.message_count;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: claimed } = await service
        .from("patient_sessions")
        .update({ message_count: current + 1 })
        .eq("id", sessionId)
        .eq("status", "active")
        .eq("message_count", current)
        .select("message_count")
        .maybeSingle();
      if (claimed) {
        questionsUsed = claimed.message_count;
        break;
      }
      const { data: latest } = await service.from("patient_sessions").select("message_count").eq("id", sessionId).maybeSingle();
      current = latest?.message_count ?? current;
      questionsUsed = current;
    }
  }

  // Ordem garantida: pergunta antes da resposta.
  if (student) await service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: student });
  let messageId: string | null = null;
  if (patient) {
    const { data } = await service.from("patient_messages").insert({ session_id: sessionId, role: "patient", content: patient }).select("id").single();
    messageId = data?.id ?? null;
  }

  // Custo informado pelo próprio evento da OpenAI (response.done). Valores
  // limitados no cálculo — serve para acompanhamento de custo.
  const usages = Array.isArray(body.usage) ? body.usage.slice(0, 4) : [];
  await Promise.all(
    usages.map((usage) => {
      const { inputTokens, outputTokens, costUsd } = estimateRealtimeCostUsd(usage);
      return logAudioUsage(service, { userId, sessionId, operation: "chat", model: REALTIME_MODEL, inputTokens, outputTokens, estimatedCostUsd: costUsd });
    }),
  );

  return Response.json({
    messageId,
    questionsUsed,
    questionsLimit: MAX_STUDENT_MESSAGES_PER_SESSION,
    limitReached: questionsUsed >= MAX_STUDENT_MESSAGES_PER_SESSION,
  });
}
