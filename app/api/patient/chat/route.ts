import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { getOpenAIClient, OPENAI_MODEL, safeErrorMeta, type UsageTokens } from "@/lib/openai";
import { consumeResponseStream, shouldRetry, ZERO_USAGE } from "@/lib/response-stream";
import { logAiUsage } from "@/lib/ai-usage";
import { createSentenceMarker, signSentence } from "@/lib/sentence-audio";
import type { HiddenCase } from "@/lib/patient-case-schema";
import {
  adaptToDoctorTitle,
  buildPatientSystemInstruction,
  injectionDeflection,
  looksLikePromptInjection,
  parseDoctorTitle,
  MAX_STUDENT_MESSAGES_PER_SESSION,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_CHARS_SENT_TO_MODEL,
} from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Modelo da conversa com o paciente. Separado do OPENAI_MODEL para dar
 * para trocar só a conversa por um modelo mais rápido, sem mexer na
 * avaliação/correção. */
const PATIENT_CHAT_MODEL = process.env.OPENAI_PATIENT_MODEL || OPENAI_MODEL;

/** Nível de processamento da conversa. Medido em 10/11/2026 com o mesmo
 * modelo e o mesmo prompt: "priority" derruba o tempo até a primeira
 * palavra de ~1,4 s para ~0,66 s (mediana) e reduz a variação. Custa mais
 * por token, mas a conversa inteira do app soma centavos por mês. Para
 * voltar ao padrão sem novo deploy de código: OPENAI_PATIENT_SERVICE_TIER=default. */
const PATIENT_SERVICE_TIER: "priority" | "default" =
  process.env.OPENAI_PATIENT_SERVICE_TIER === "default" ? "default" : "priority";

type Turn = { role: "user" | "assistant"; content: string };

/** Chama a Responses API em streaming e consome os eventos com
 * lib/response-stream.ts (delta, done, completed, incomplete, failed,
 * error, refusal). Loga o motivo do término para diagnóstico, sem expor
 * conteúdo clínico. */
async function runResponseStream(
  client: ReturnType<typeof getOpenAIClient>,
  params: { instructions: string; input: Turn[]; maxOutputTokens: number; cacheKey: string },
  onDelta: (text: string) => void,
) {
  const createStream = (serviceTier: "priority" | "default") =>
    client.responses.create({
      model: PATIENT_CHAT_MODEL,
      instructions: params.instructions,
      input: params.input,
      max_output_tokens: params.maxOutputTokens,
      reasoning: { effort: "minimal" },
      // Mesmo prefixo (instruções do caso) a cada pergunta da consulta: a
      // chave de cache aumenta a chance de reaproveitar o prefixo já
      // processado, o que reduz o tempo até a primeira palavra.
      prompt_cache_key: params.cacheKey,
      service_tier: serviceTier,
      stream: true,
    });
  let stream: Awaited<ReturnType<typeof createStream>>;
  try {
    stream = await createStream(PATIENT_SERVICE_TIER);
  } catch (err) {
    // Se o nível prioritário for recusado (conta/modelo sem acesso), a
    // consulta segue no nível padrão em vez de falhar.
    if (PATIENT_SERVICE_TIER === "default") throw err;
    console.error("[patient/chat] etapa=service_tier status=fallback_default", safeErrorMeta(err));
    stream = await createStream("default");
  }
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

function limitResponse(used: number) {
  return Response.json(
    {
      error: `Você atingiu o limite de ${MAX_STUDENT_MESSAGES_PER_SESSION} perguntas desta consulta. Finalize o atendimento.`,
      limitReached: true,
      code: "QUESTION_LIMIT_REACHED",
      questionsUsed: used,
      questionsLimit: MAX_STUDENT_MESSAGES_PER_SESSION,
    },
    { status: 429 },
  );
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const supabase = await createClient();
  const [userId, body] = await Promise.all([
    getAuthUserId(supabase),
    request.json().catch(() => ({})) as Promise<{ sessionId?: string; message?: string; voice?: boolean; doctorTitle?: string }>,
  ]);
  if (!userId) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const sessionId = body.sessionId;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const doctorTitle = parseDoctorTitle(body.doctorTitle);
  // Modo conversa por voz: o texto sai com marcadores de fim de frase, para
  // o cliente já começar a falar a primeira frase enquanto o resto é escrito.
  const wantsVoice = body.voice === true;
  if (!sessionId || !message) return Response.json({ error: "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).`, code: "MESSAGE_TOO_LONG" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // Sessão (RLS: só a do próprio usuário) e histórico da conversa são lidos
  // juntos — antes eram esperas em sequência antes de chamar o modelo.
  const [{ data: session }, { data: historyRows }] = await Promise.all([
    supabase.from("patient_sessions").select("id, case_id, status, message_count").eq("id", sessionId).maybeSingle(),
    service
      .from("patient_messages")
      .select("id, role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
  }
  if (session.message_count >= MAX_STUDENT_MESSAGES_PER_SESSION) return limitResponse(session.message_count);

  // Reserva atômica da pergunta (compare-and-swap em message_count) em
  // paralelo com a leitura do caso — nada é gravado nem enviado ao modelo
  // antes de a reserva ser confirmada.
  const questionsUsed = session.message_count + 1;
  const [{ data: claimedSession }, { data: caseDetails }, { data: caseRow }] = await Promise.all([
    service
      .from("patient_sessions")
      .update({ message_count: questionsUsed })
      .eq("id", sessionId)
      .eq("status", "active")
      .eq("message_count", session.message_count)
      .select("id")
      .maybeSingle(),
    service.from("patient_case_details").select("hidden_case").eq("case_id", session.case_id).single(),
    service.from("patient_cases").select("opening_line").eq("id", session.case_id).single(),
  ]);

  if (!claimedSession) {
    // Perdeu a corrida: relê o estado real para responder corretamente.
    const { data: latestSession } = await service
      .from("patient_sessions")
      .select("status, message_count")
      .eq("id", sessionId)
      .maybeSingle();
    if (!latestSession || latestSession.status !== "active") {
      return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
    }
    if (latestSession.message_count >= MAX_STUDENT_MESSAGES_PER_SESSION) return limitResponse(latestSession.message_count);
    return Response.json({ error: "A sessão foi atualizada por outra requisição. Tente novamente.", code: "SESSION_UPDATED" }, { status: 409 });
  }
  if (!caseDetails) return Response.json({ error: "Caso clínico indisponível.", code: "CASE_NOT_FOUND" }, { status: 500 });
  const hidden = caseDetails.hidden_case as HiddenCase;
  const fallbackReply = `Como assim, ${doctorTitle ?? "doutor(a)"}? Pode falar de novo?`;

  // Defesa contra prompt injection: bloqueia ANTES de chamar o provedor.
  // A pergunta recusada TAMBÉM conta no limite (já reservado acima).
  if (looksLikePromptInjection(message)) {
    const deflection = injectionDeflection(doctorTitle);
    await service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: message });
    const { data: deflectionMessage } = await service
      .from("patient_messages")
      .insert({ session_id: sessionId, role: "patient", content: deflection })
      .select("id")
      .single();
    return new Response(deflectionMessage?.id ? `${deflection}\u0000MSGID:${deflectionMessage.id}` : deflection, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Questions-Used": String(questionsUsed),
        "X-Questions-Limit": String(MAX_STUDENT_MESSAGES_PER_SESSION),
      },
    });
  }

  // Contexto otimizado: prompt fixo primeiro (favorece cache de prefixo) e
  // apenas o histórico necessário, começando na 1ª fala do estudante.
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

  // A gravação da fala do estudante roda EM PARALELO com a chamada ao
  // modelo; só é aguardada antes de gravar a resposta do paciente, para
  // manter a ordem correta na conversa.
  const studentInsert = Promise.resolve(service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: message }));

  const openingLine = caseRow?.opening_line ? adaptToDoctorTitle(caseRow.opening_line, doctorTitle) : undefined;
  const instructions = buildPatientSystemInstruction(hidden, openingLine, doctorTitle);
  const cacheKey = `patient-${session.case_id}-${doctorTitle ?? "n"}`;
  const encoder = new TextEncoder();

  // O registro de custo/latência roda DEPOIS de a resposta fechar (after):
  // antes o stream ficava aberto esperando esse INSERT, e o campo de
  // pergunta do estudante só destravava quando ele terminava.
  let settleUsageLogs: (work: Promise<unknown>) => void = () => {};
  const usageLogsDone = new Promise<unknown>((resolve) => {
    settleUsageLogs = resolve;
  });
  after(() => usageLogsDone);

  try {
    const client = getOpenAIClient();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const usageLog: UsageTokens[] = [];
        let fullText = "";
        let firstDeltaAt: number | null = null;
        const splitter = wantsVoice ? createSentenceMarker((sentence) => signSentence(sessionId, sentence)) : null;
        const emit = (delta: string) => {
          if (firstDeltaAt === null) firstDeltaAt = Date.now();
          const chunk = splitter ? splitter.push(delta) : delta;
          if (chunk) controller.enqueue(encoder.encode(chunk));
        };
        try {
          const first = await runResponseStream(client, { instructions, input: turns, maxOutputTokens: 500, cacheKey }, emit);
          usageLog.push(first.usage);
          fullText = first.text;

          if (shouldRetry(first)) {
            // No máximo 1 nova tentativa, com orçamento maior. NÃO consome
            // outra pergunta do aluno, mas AMBAS aparecem no log de custo.
            console.error("[patient/chat] etapa=retry status=aplicado", { motivo: first.finishReason });
            const retry = await runResponseStream(client, { instructions, input: turns, maxOutputTokens: 700, cacheKey }, emit);
            usageLog.push(retry.usage);
            if (retry.text.trim().length > 0) fullText = retry.text;
          }
        } catch (err) {
          console.error("[patient/chat] erro no streaming", safeErrorMeta(err));
        } finally {
          if (splitter) {
            const rest = splitter.flush();
            if (rest) controller.enqueue(encoder.encode(rest));
          }
          const trimmed = fullText.trim();
          // Nunca grava nem envia bolha vazia/só espaço.
          const contentToSave = trimmed.length > 0 ? fullText : fallbackReply;
          if (trimmed.length === 0) controller.enqueue(encoder.encode(fallbackReply));

          await studentInsert;
          const { data: savedMessage } = await service
            .from("patient_messages")
            .insert({ session_id: sessionId, role: "patient", content: contentToSave })
            .select("id")
            .single();
          // Marcador invisível no fim do stream com o id real da mensagem
          // salva — usado pelo botão "Ouvir resposta" (TTS). O cliente remove
          // esse marcador antes de exibir o texto.
          if (savedMessage?.id) controller.enqueue(encoder.encode(`\u0000MSGID:${savedMessage.id}`));
          controller.close();
          // Latência real percebida: da entrada da requisição até a 1ª
          // palavra (ttft) e até o fim da resposta. Vai só no 1º registro
          // (uma nova tentativa não é outra resposta para o estudante).
          const ttftMs = firstDeltaAt === null ? null : firstDeltaAt - requestStartedAt;
          const durationMs = Date.now() - requestStartedAt;
          settleUsageLogs(
            Promise.all(
              (usageLog.length ? usageLog : [ZERO_USAGE]).map((usage, index) =>
                logAiUsage(service, {
                  userId,
                  sessionId,
                  operation: "chat",
                  model: PATIENT_CHAT_MODEL,
                  usage,
                  ttftMs: index === 0 ? ttftMs : null,
                  durationMs: index === 0 ? durationMs : null,
                }),
              ),
            ),
          );
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
    settleUsageLogs(Promise.resolve());
    console.error("[patient/chat] erro ao chamar provedor", {
      ...safeErrorMeta(err),
      model: PATIENT_CHAT_MODEL,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    });
    return Response.json(
      { error: "Não foi possível obter resposta do paciente agora.", code: "PROVIDER_ERROR" },
      { status: 502 },
    );
  }
}
