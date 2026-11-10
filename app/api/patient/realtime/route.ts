import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { getOpenAIClient, safeErrorMeta } from "@/lib/openai";
import { isRateLimited, logAudioUsage } from "@/lib/ai-usage";
import { resolveUserAccess } from "@/lib/user-access";
import type { HiddenCase } from "@/lib/patient-case-schema";
import { adaptToDoctorTitle, buildPatientSystemInstruction, parseDoctorTitle, MAX_STUDENT_MESSAGES_PER_SESSION, MAX_HISTORY_CHARS_SENT_TO_MODEL } from "@/lib/patient-ai-rules";
import {
  REALTIME_MODEL,
  REALTIME_SILENCE_MS,
  REALTIME_TRANSCRIPTION_MODEL,
  realtimeVoiceAddendum,
  resolveRealtimeVoice,
} from "@/lib/realtime-voice";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CONNECT_MARKER_MODEL = `${REALTIME_MODEL}:connect`;

/** Abre a conversa por voz em tempo real: devolve uma chave temporária
 * (vale ~1 min para abrir UMA ligação) já configurada com o roteiro do
 * paciente, a voz certa e a conversa até aqui. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const [userId, body] = await Promise.all([
    getAuthUserId(supabase),
    request.json().catch(() => ({})) as Promise<{ sessionId?: string; doctorTitle?: string }>,
  ]);
  if (!userId) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });
  const sessionId = body.sessionId;
  if (!sessionId) return Response.json({ error: "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
  const doctorTitle = parseDoctorTitle(body.doctorTitle);

  const service = createServiceClient();
  const [access, { data: session }, rateLimited] = await Promise.all([
    resolveUserAccess(supabase, userId),
    // RLS: só encontra a sessão se for do próprio usuário.
    supabase.from("patient_sessions").select("id, case_id, status, message_count").eq("id", sessionId).maybeSingle(),
    isRateLimited(service, { userId, operation: "chat", model: CONNECT_MARKER_MODEL, maxPerWindow: 8, windowSeconds: 300 }),
  ]);
  if (access.tier !== "pro" && access.tier !== "trial") {
    return Response.json({ error: "A conversa por voz é exclusiva do plano Pro e do período de teste.", code: "PRO_REQUIRED" }, { status: 403 });
  }
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
  }
  if (session.message_count >= MAX_STUDENT_MESSAGES_PER_SESSION) {
    return Response.json(
      { error: `Você atingiu o limite de ${MAX_STUDENT_MESSAGES_PER_SESSION} perguntas desta consulta. Finalize o atendimento.`, code: "QUESTION_LIMIT_REACHED", limitReached: true },
      { status: 429 },
    );
  }
  if (rateLimited) {
    return Response.json({ error: "Muitas conexões de voz em pouco tempo. Aguarde um instante.", code: "RATE_LIMITED" }, { status: 429 });
  }

  const [{ data: caseDetails }, { data: caseRow }, { data: historyRows }] = await Promise.all([
    service.from("patient_case_details").select("hidden_case").eq("case_id", session.case_id).single(),
    service.from("patient_cases").select("opening_line").eq("id", session.case_id).single(),
    service
      .from("patient_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);
  if (!caseDetails) return Response.json({ error: "Caso clínico indisponível.", code: "CASE_NOT_FOUND" }, { status: 500 });
  const hidden = caseDetails.hidden_case as HiddenCase;
  const openingLine = caseRow?.opening_line ? adaptToDoctorTitle(caseRow.opening_line, doctorTitle) : undefined;

  // Conversa até aqui (ex.: o aluno trocou de texto para voz no meio da
  // consulta, ou a ligação caiu e foi reaberta): o paciente continua de
  // onde parou, sem repetir o que já contou.
  const turns: string[] = [];
  let usedChars = 0;
  for (const row of [...(historyRows ?? [])].reverse()) {
    if (row.role === "exam" || !row.content?.trim()) continue;
    usedChars += row.content.length;
    if (usedChars > MAX_HISTORY_CHARS_SENT_TO_MODEL) break;
    turns.unshift(`${row.role === "student" ? "Médico" : "Você"}: ${row.content.trim()}`);
  }
  const persona = hidden.persona;
  const instructions = [
    buildPatientSystemInstruction(hidden, openingLine, doctorTitle),
    realtimeVoiceAddendum(persona?.tone, persona?.age),
    ...(turns.length
      ? ["", "CONVERSA ATÉ AGORA (continue daqui, sem repetir o que já disse):", ...turns]
      : []),
  ].join("\n");

  try {
    const client = getOpenAIClient();
    const secret = await client.realtime.clientSecrets.create({
      expires_after: { anchor: "created_at", seconds: 60 },
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions,
        output_modalities: ["audio"],
        max_output_tokens: 600,
        audio: {
          input: {
            noise_reduction: { type: "near_field" },
            transcription: {
              model: REALTIME_TRANSCRIPTION_MODEL,
              language: "pt",
              prompt: "Consulta médica em português do Brasil entre estudante de medicina e paciente.",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.55,
              prefix_padding_ms: 300,
              silence_duration_ms: REALTIME_SILENCE_MS,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: { voice: resolveRealtimeVoice(persona?.sex, persona?.age) },
        },
      },
    });

    // Marca a conexão (custo zero) — serve de limite de reconexões.
    void logAudioUsage(service, { userId, sessionId, operation: "chat", model: CONNECT_MARKER_MODEL, estimatedCostUsd: 0 });

    return Response.json({
      clientSecret: secret.value,
      model: REALTIME_MODEL,
      questionsUsed: session.message_count,
      questionsLimit: MAX_STUDENT_MESSAGES_PER_SESSION,
    });
  } catch (err) {
    console.error("[patient/realtime] falha ao criar a chave da ligação", { ...safeErrorMeta(err), model: REALTIME_MODEL });
    return Response.json({ error: "Não foi possível iniciar a conversa por voz agora.", code: "PROVIDER_ERROR" }, { status: 502 });
  }
}
