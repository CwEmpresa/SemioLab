import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient, OPENAI_MODEL, safeErrorMeta, type UsageTokens } from "@/lib/openai";
import { consumeResponseStream, shouldRetry, ZERO_USAGE } from "@/lib/response-stream";
import { logAiUsage } from "@/lib/ai-usage";
import type { HiddenCase } from "@/lib/patient-case-schema";
import {
  buildPatientSystemInstruction,
  looksLikePromptInjection,
  INJECTION_DEFLECTION,
  MAX_STUDENT_MESSAGES_PER_SESSION,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_CHARS_SENT_TO_MODEL,
} from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FALLBACK_REPLY = "Desculpa, pode repetir a pergunta?";

type Turn = { role: "user" | "assistant"; content: string };

/** Chama a Responses API em streaming e consome os eventos com
 * lib/response-stream.ts (delta, done, completed, incomplete, failed,
 * error, refusal). Loga o motivo do término para diagnóstico, sem expor
 * conteúdo clínico. */
async function runResponseStream(
  client: ReturnType<typeof getOpenAIClient>,
  params: { instructions: string; input: Turn[]; maxOutputTokens: number; reasoningEffort: "minimal" | "low" },
  onDelta: (text: string) => void,
) {
  const stream = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: params.instructions,
    input: params.input,
    max_output_tokens: params.maxOutputTokens,
    reasoning: { effort: params.reasoningEffort },
    stream: true,
  });
  const result = await consumeResponseStream(stream, onDelta);
  console.error("[patient/chat] etapa=stream_finalizado", {
    finishReason: result.finishReason,
    incompleteReason: result.incompleteReason,
    textLength: result.text.trim().length,
    reasoningTokens: result.usage.reasoningTokens,
    outputTokens: result.usage.outputTokens,
  });
  return result;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; message?: string };
  const sessionId = body.sessionId;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!sessionId || !message) return Response.json({ error: "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).`, code: "MESSAGE_TOO_LONG" },
      { status: 400 },
    );
  }

  // Sessão precisa pertencer ao usuário autenticado (RLS: select own) e
  // estar ativa. O user_id nunca vem do cliente.
  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, case_id, status, message_count")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
  }
  if (session.message_count >= MAX_STUDENT_MESSAGES_PER_SESSION) {
    return Response.json(
      {
        error: `Você atingiu o limite de ${MAX_STUDENT_MESSAGES_PER_SESSION} perguntas desta consulta. Finalize o atendimento.`,
        limitReached: true,
        code: "QUESTION_LIMIT_REACHED",
        questionsUsed: session.message_count,
        questionsLimit: MAX_STUDENT_MESSAGES_PER_SESSION,
      },
      { status: 429 },
    );
  }

  const service = createServiceClient();
  const [{ data: caseDetails }, { data: caseRow }] = await Promise.all([
    service.from("patient_case_details").select("hidden_case").eq("case_id", session.case_id).single(),
    service.from("patient_cases").select("opening_line").eq("id", session.case_id).single(),
  ]);
  if (!caseDetails) return Response.json({ error: "Caso clínico indisponível.", code: "CASE_NOT_FOUND" }, { status: 500 });
  const hidden = caseDetails.hidden_case as HiddenCase;

  const questionsUsed = session.message_count + 1;

  // Defesa contra prompt injection: bloqueia ANTES de chamar o provedor.
  // A pergunta recusada TAMBÉM conta no limite do atendimento.
  if (looksLikePromptInjection(message)) {
    await service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: message });
    const { data: deflectionMessage } = await service
      .from("patient_messages")
      .insert({ session_id: sessionId, role: "patient", content: INJECTION_DEFLECTION })
      .select("id")
      .single();
    await service.from("patient_sessions").update({ message_count: questionsUsed }).eq("id", sessionId);
    return new Response(deflectionMessage?.id ? `${INJECTION_DEFLECTION}\u0000MSGID:${deflectionMessage.id}` : INJECTION_DEFLECTION, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Questions-Used": String(questionsUsed),
        "X-Questions-Limit": String(MAX_STUDENT_MESSAGES_PER_SESSION),
      },
    });
  }

  const { data: historyRows } = await service
    .from("patient_messages")
    .select("id, role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  // Contexto otimizado: prompt fixo primeiro (favorece cache de prefixo) e
  // apenas o histórico necessário, começando na 1ª fala do estudante.
  // Mensagens antigas vazias/só espaço (não devem existir mais, mas por
  // segurança) são filtradas — nunca entram no contexto do modelo.
  const firstStudentIndex = (historyRows ?? []).findIndex((row) => row.role === "student");
  const relevantHistory = firstStudentIndex === -1 ? [] : (historyRows ?? []).slice(firstStudentIndex);

  let usedChars = 0;
  const turns: Turn[] = [];
  for (const row of relevantHistory) {
    if (row.role === "exam") continue;
    if (!row.content || row.content.trim().length === 0) continue;
    usedChars += row.content.length;
    if (usedChars > MAX_HISTORY_CHARS_SENT_TO_MODEL) break;
    turns.push({ role: row.role === "student" ? "user" : "assistant", content: row.content });
  }
  turns.push({ role: "user", content: message });

  await service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: message });

  const instructions = buildPatientSystemInstruction(hidden, caseRow?.opening_line);
  const encoder = new TextEncoder();

  try {
    const client = getOpenAIClient();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const usageLog: UsageTokens[] = [];
        let fullText = "";
        try {
          // Tentativa 1: reasoning mínimo, orçamento suficiente para
          // reasoning + texto visível (o limite de 1-3 frases é imposto
          // pelo prompt, não por um orçamento perigosamente baixo).
          const first = await runResponseStream(
            client,
            { instructions, input: turns, maxOutputTokens: 500, reasoningEffort: "minimal" },
            (delta) => controller.enqueue(encoder.encode(delta)),
          );
          usageLog.push(first.usage);
          fullText = first.text;

          const cutShort = shouldRetry(first);
          if (cutShort) {
            // No máximo 1 nova tentativa, com orçamento maior. NÃO consome
            // outra pergunta do aluno (message_count já fixado abaixo), mas
            // AMBAS as chamadas aparecem no log de custo.
            console.error("[patient/chat] etapa=retry status=aplicado", { motivo: first.finishReason });
            const retry = await runResponseStream(
              client,
              { instructions, input: turns, maxOutputTokens: 700, reasoningEffort: "minimal" },
              (delta) => controller.enqueue(encoder.encode(delta)),
            );
            usageLog.push(retry.usage);
            if (retry.text.trim().length > 0) fullText = retry.text;
          }
        } catch (err) {
          console.error("[patient/chat] erro no streaming", safeErrorMeta(err));
        } finally {
          const trimmed = fullText.trim();
          // Nunca grava nem envia bolha vazia/só espaço.
          const contentToSave = trimmed.length > 0 ? fullText : FALLBACK_REPLY;
          if (trimmed.length === 0) controller.enqueue(encoder.encode(FALLBACK_REPLY));

          const { data: savedMessage } = await service
            .from("patient_messages")
            .insert({ session_id: sessionId, role: "patient", content: contentToSave })
            .select("id")
            .single();
          // Marcador invisível no fim do stream com o id real da mensagem
          // salva — necessário para o botão "Ouvir resposta" (TTS), já que
          // o id só existe depois do insert, e os headers HTTP já foram
          // fixados antes do corpo do stream começar a ser gerado. O
          // cliente remove esse marcador antes de exibir o texto.
          if (savedMessage?.id) controller.enqueue(encoder.encode(`\u0000MSGID:${savedMessage.id}`));
          await service.from("patient_sessions").update({ message_count: questionsUsed }).eq("id", sessionId);
          for (const usage of usageLog.length ? usageLog : [ZERO_USAGE]) {
            await logAiUsage(service, { userId: user.id, sessionId, operation: "chat", model: OPENAI_MODEL, usage });
          }
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Questions-Used": String(questionsUsed),
        "X-Questions-Limit": String(MAX_STUDENT_MESSAGES_PER_SESSION),
      },
    });
  } catch (err) {
    console.error("[patient/chat] erro ao chamar provedor", {
      ...safeErrorMeta(err),
      model: OPENAI_MODEL,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    });
    return Response.json(
      { error: "Não foi possível obter resposta do paciente agora.", code: "PROVIDER_ERROR" },
      { status: 502 },
    );
  }
}
