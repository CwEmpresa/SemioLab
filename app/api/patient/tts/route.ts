import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient, OPENAI_TTS_MODEL, OPENAI_TTS_VOICE, estimateTtsCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage, isRateLimited } from "@/lib/ai-usage";
import { resolveUserAccess } from "@/lib/user-access";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const access = await resolveUserAccess(supabase, user.id);
  if (access.tier !== "pro") {
    return Response.json({ error: "Ouvir a resposta do paciente é exclusivo do plano Pro.", code: "PRO_REQUIRED" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; messageId?: string };
  const sessionId = body.sessionId;
  const messageId = body.messageId;
  if (!sessionId || !messageId) return Response.json({ error: "Dados inválidos." }, { status: 400 });

  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return Response.json({ error: "Sessão inválida." }, { status: 404 });

  const service = createServiceClient();
  const { data: message } = await service
    .from("patient_messages")
    .select("id, content")
    .eq("id", messageId)
    .eq("session_id", sessionId)
    .eq("role", "patient")
    .maybeSingle();
  if (!message || !message.content?.trim()) {
    return Response.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }

  if (await isRateLimited(service, { userId: user.id, operation: "tts", maxPerWindow: 20, windowSeconds: 120 })) {
    return Response.json({ error: "Muitos pedidos de áudio em pouco tempo. Aguarde um instante.", code: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const client = getOpenAIClient();
    const speech = await client.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: message.content,
      instructions: "Fale em português brasileiro, com tom natural, humano e caloroso, como um paciente numa consulta médica.",
      response_format: "mp3",
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    await logAudioUsage(service, {
      userId: user.id,
      sessionId,
      operation: "tts",
      model: OPENAI_TTS_MODEL,
      estimatedCostUsd: estimateTtsCostUsd(message.content),
    });

    return new Response(audioBuffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[patient/tts] erro ao gerar áudio", {
      ...safeErrorMeta(err),
      model: OPENAI_TTS_MODEL,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    });
    return Response.json({ error: "Não foi possível gerar o áudio agora.", code: "TTS_ERROR" }, { status: 502 });
  }
}
