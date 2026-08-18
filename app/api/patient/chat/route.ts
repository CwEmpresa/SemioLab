import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient, OPENAI_MODEL, extractUsage, safeErrorMeta } from "@/lib/openai";
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
    await service.from("patient_messages").insert([
      { session_id: sessionId, role: "student", content: message },
      { session_id: sessionId, role: "patient", content: INJECTION_DEFLECTION },
    ]);
    await service.from("patient_sessions").update({ message_count: questionsUsed }).eq("id", sessionId);
    return new Response(INJECTION_DEFLECTION, {
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
  const firstStudentIndex = (historyRows ?? []).findIndex((row) => row.role === "student");
  const relevantHistory = firstStudentIndex === -1 ? [] : (historyRows ?? []).slice(firstStudentIndex);

  let usedChars = 0;
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const row of relevantHistory) {
    if (row.role === "exam") continue;
    usedChars += row.content.length;
    if (usedChars > MAX_HISTORY_CHARS_SENT_TO_MODEL) break;
    turns.push({ role: row.role === "student" ? "user" : "assistant", content: row.content });
  }
  turns.push({ role: "user", content: message });

  await service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: message });

  try {
    const client = getOpenAIClient();
    const stream = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: buildPatientSystemInstruction(hidden, caseRow?.opening_line),
      input: turns,
      max_output_tokens: 400,
      stream: true,
    });

    const encoder = new TextEncoder();
    let fullText = "";
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              const delta = event.delta ?? "";
              if (delta) {
                fullText += delta;
                controller.enqueue(encoder.encode(delta));
              }
            } else if (event.type === "response.completed") {
              usage = extractUsage(event.response?.usage);
            }
          }
        } catch (err) {
          console.error("[patient/chat] erro no streaming", safeErrorMeta(err));
        } finally {
          // Grava a resposta COMPLETA antes de fechar o stream, para o cliente
          // só liberar a próxima pergunta quando tudo já estiver persistido.
          await service.from("patient_messages").insert({
            session_id: sessionId,
            role: "patient",
            content: fullText || "Desculpa, pode repetir a pergunta?",
          });
          await service.from("patient_sessions").update({ message_count: questionsUsed }).eq("id", sessionId);
          await logAiUsage(service, {
            userId: user.id,
            sessionId,
            operation: "chat",
            model: OPENAI_MODEL,
            usage,
          });
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
