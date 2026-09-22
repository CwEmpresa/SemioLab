import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient, OPENAI_TTS_MODEL, OPENAI_TTS_VOICE, estimateTtsCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage, isRateLimited } from "@/lib/ai-usage";
import { resolveUserAccess } from "@/lib/user-access";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET (não POST) de propósito: é o que permite tocar direto de
// `new Audio(url)`, com o navegador fazendo streaming/buffer progressivo
// nativo — sem isso, o áudio só começa a tocar depois do download inteiro.
// A autenticação continua vindo do cookie de sessão (SameSite=Lax barra
// embeds de terceiros), sessionId/messageId na URL não são segredo.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  // Recurso do plano Pro e do período de teste — não disponível no free.
  const access = await resolveUserAccess(supabase, user.id);
  if (access.tier !== "pro" && access.tier !== "trial") {
    return Response.json({ error: "Ouvir a resposta do paciente é exclusiva do plano Pro e do período de teste.", code: "PRO_REQUIRED" }, { status: 403 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const messageId = url.searchParams.get("messageId");
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
      instructions:
        "Fale em português brasileiro como uma pessoa de verdade batendo papo, informal e espontâneo, nunca formal ou lendo um texto. Ritmo natural de fala, com as pequenas variações e pausas de quem está pensando enquanto fala — nunca robótico, nunca narrado, nunca com entonação de locutor.",
      response_format: "mp3",
      // Envia o áudio em pedaços conforme é gerado (em vez de só no final):
      // é o que permite o navegador começar a tocar quase imediatamente.
      stream_format: "audio",
    });

    // Custo é estimado a partir do texto (a Speech API não devolve tokens
    // reais) — loga sem bloquear a resposta, para o primeiro byte de áudio
    // chegar ao navegador o quanto antes.
    logAudioUsage(service, {
      userId: user.id,
      sessionId,
      operation: "tts",
      model: OPENAI_TTS_MODEL,
      estimatedCostUsd: estimateTtsCostUsd(message.content),
    }).catch((err) => console.error("[patient/tts] falha ao logar uso", safeErrorMeta(err)));

    const headers = {
      "Content-Type": "audio/mpeg",
      // Cache privado (só neste navegador) e de longa duração: tocar de
      // novo a mesma resposta não gera nem cobra áudio outra vez.
      "Cache-Control": "private, max-age=86400, immutable",
    };
    if (!speech.body) {
      // Fallback só por segurança de tipos — na prática a Speech API sempre
      // devolve um corpo com stream_format "audio".
      return new Response(Buffer.from(await speech.arrayBuffer()), { headers });
    }
    return new Response(speech.body, { headers });
  } catch (err) {
    console.error("[patient/tts] erro ao gerar áudio", {
      ...safeErrorMeta(err),
      model: OPENAI_TTS_MODEL,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    });
    return Response.json({ error: "Não foi possível gerar o áudio agora.", code: "TTS_ERROR" }, { status: 502 });
  }
}
