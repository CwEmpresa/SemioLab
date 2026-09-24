import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient, OPENAI_TTS_MODEL, resolvePatientVoice, estimateTtsCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage, isRateLimited } from "@/lib/ai-usage";
import { resolveUserAccess } from "@/lib/user-access";
import { verifySentence } from "@/lib/sentence-audio";

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

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const messageId = url.searchParams.get("messageId");
  // Modo frase (conversa por voz): o cliente pede a voz de UMA frase assim
  // que ela fica pronta, antes da resposta inteira terminar. O texto só é
  // aceito se vier com a assinatura que o servidor gerou para ele nesta
  // sessão — nunca fala texto arbitrário.
  const sentenceText = url.searchParams.get("text")?.trim() ?? "";
  const sentenceSig = url.searchParams.get("sig") ?? "";
  const sentenceMode = sentenceText.length > 0;
  if (!sessionId || (!sentenceMode && !messageId)) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  if (sentenceMode && (sentenceText.length > 500 || !verifySentence(sessionId, sentenceText, sentenceSig))) {
    return Response.json({ error: "Texto inválido.", code: "INVALID_SENTENCE" }, { status: 400 });
  }

  // Tudo que o áudio precisa é lido em paralelo (antes eram 5 idas seguidas
  // ao banco antes do primeiro byte de voz).
  const service = createServiceClient();
  const [access, { data: session }, { data: message }, rateLimited] = await Promise.all([
    resolveUserAccess(supabase, user.id),
    supabase.from("patient_sessions").select("id, case_id").eq("id", sessionId).maybeSingle(),
    sentenceMode
      ? Promise.resolve({ data: { id: "sentence", content: sentenceText } })
      : service
          .from("patient_messages")
          .select("id, content")
          .eq("id", messageId as string)
          .eq("session_id", sessionId)
          .eq("role", "patient")
          .maybeSingle(),
    isRateLimited(service, { userId: user.id, operation: "tts", maxPerWindow: 80, windowSeconds: 120 }),
  ]);
  // Recurso do plano Pro e do período de teste — não disponível no free.
  if (access.tier !== "pro" && access.tier !== "trial") {
    return Response.json({ error: "Ouvir a resposta do paciente é exclusiva do plano Pro e do período de teste.", code: "PRO_REQUIRED" }, { status: 403 });
  }

  if (!session) return Response.json({ error: "Sessão inválida." }, { status: 404 });
  if (!message || !message.content?.trim()) {
    return Response.json({ error: "Mensagem não encontrada." }, { status: 404 });
  }
  if (rateLimited) {
    return Response.json({ error: "Muitos pedidos de áudio em pouco tempo. Aguarde um instante.", code: "RATE_LIMITED" }, { status: 429 });
  }
  const { data: caseDetails } = await service
    .from("patient_case_details")
    .select("hidden_case")
    .eq("case_id", session.case_id)
    .single();
  const persona = (caseDetails?.hidden_case as { persona?: { sex?: string; age?: number; tone?: string } } | null)?.persona;
  const { voice, ageHint } = resolvePatientVoice(persona?.sex ?? "feminino", persona?.age ?? 40);

  try {
    const client = getOpenAIClient();
    const speech = await client.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice,
      input: message.content,
      instructions:
        "Fale em português brasileiro como uma pessoa de verdade batendo papo, informal e espontâneo, nunca formal ou lendo um texto. Ritmo natural de fala, com as pequenas variações e pausas de quem está pensando enquanto fala, nunca robótico, nunca narrado, nunca com entonação de locutor. " +
        "Tenha emoção de verdade na voz: quem está doente soa um pouco cansado, incomodado ou preocupado, e hesita de leve quando o assunto é delicado; ao contar algo que dói, a voz acompanha. Sem exagero de teatro. " +
        (persona?.tone ? `Jeito da pessoa: ${persona.tone}. ` : "") +
        ageHint,
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
