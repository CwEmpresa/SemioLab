import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isProActive } from "@/lib/pro";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";
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
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { data: sub } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
  if (!isProActive(sub?.status)) {
    return Response.json({ error: "Este recurso é exclusivo do plano Pro.", requiresPro: true }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; message?: string };
  const sessionId = body.sessionId;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!sessionId || !message) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).` }, { status: 400 });
  }

  // Sessão precisa pertencer ao usuário (RLS: select own) e estar ativa.
  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, case_id, status, message_count")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada." }, { status: 404 });
  }
  if (session.message_count >= MAX_STUDENT_MESSAGES_PER_SESSION) {
    return Response.json({ error: "Limite de mensagens desta consulta atingido. Finalize o atendimento.", limitReached: true }, { status: 429 });
  }

  const service = createServiceClient();
  const { data: caseDetails } = await service
    .from("patient_case_details")
    .select("hidden_case")
    .eq("case_id", session.case_id)
    .single();
  if (!caseDetails) return Response.json({ error: "Caso clínico indisponível." }, { status: 500 });
  const hidden = caseDetails.hidden_case as HiddenCase;

  // 2) Defesa contra prompt injection: bloqueia ANTES de chamar o modelo.
  if (looksLikePromptInjection(message)) {
    await service.from("patient_messages").insert([
      { session_id: sessionId, role: "student", content: message },
      { session_id: sessionId, role: "patient", content: INJECTION_DEFLECTION },
    ]);
    await service
      .from("patient_sessions")
      .update({ message_count: session.message_count + 1 })
      .eq("id", sessionId);
    return new Response(INJECTION_DEFLECTION, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const { data: historyRows } = await service
    .from("patient_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  let usedChars = 0;
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const row of historyRows ?? []) {
    if (row.role === "exam") continue; // resultados de exame não entram no diálogo do modelo
    const role = row.role === "student" ? "user" : "model";
    usedChars += row.content.length;
    if (usedChars > MAX_HISTORY_CHARS_SENT_TO_MODEL) break;
    contents.push({ role, parts: [{ text: row.content }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  await service.from("patient_messages").insert({ session_id: sessionId, role: "student", content: message });

  let ai: ReturnType<typeof getGeminiClient>;
  try {
    ai = getGeminiClient();
  } catch {
    return Response.json({ error: "Simulação por IA indisponível no momento." }, { status: 500 });
  }

  try {
    const streamResult = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: buildPatientSystemInstruction(hidden),
        maxOutputTokens: 400,
        temperature: 0.8,
      },
    });

    const encoder = new TextEncoder();
    let fullText = "";
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of streamResult) {
            const text = chunk.text;
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          console.error("[patient/chat] erro no streaming", err instanceof Error ? err.message : err);
        } finally {
          controller.close();
          await service.from("patient_messages").insert({
            session_id: sessionId,
            role: "patient",
            content: fullText || "Desculpa, pode repetir a pergunta?",
          });
          await service
            .from("patient_sessions")
            .update({ message_count: session.message_count + 1 })
            .eq("id", sessionId);
        }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    console.error("[patient/chat] erro ao chamar Gemini", err instanceof Error ? err.message : err);
    return Response.json({ error: "Não foi possível obter resposta do paciente agora." }, { status: 502 });
  }
}
