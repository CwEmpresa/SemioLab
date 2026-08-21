import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient, OPENAI_TRANSCRIPTION_MODEL, estimateTranscriptionCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage, isRateLimited } from "@/lib/ai-usage";
import { resolveUserAccess } from "@/lib/user-access";
import { toFile } from "openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_SECONDS = 30;
// Formatos seguros aceitos do MediaRecorder do navegador.
const ALLOWED_MIME_PREFIXES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];

/** Confere a assinatura binária (magic bytes) do arquivo — nunca confia
 * só no Content-Type declarado pelo cliente, que pode ser forjado. */
function sniffAudioSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  // WebM/Matroska (EBML header)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
  // OGG
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return true;
  // MP4/M4A ("....ftyp" a partir do byte 4)
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return true;
  // MP3 (ID3 ou frame sync)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return true;
  // WAV (RIFF....WAVE)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
  return false;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  // Recurso exclusivo do plano Pro.
  const access = await resolveUserAccess(supabase, user.id);
  if (access.tier !== "pro") {
    return Response.json({ error: "A pergunta por voz é exclusiva do plano Pro.", code: "PRO_REQUIRED" }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const sessionId = form.get("sessionId");
  const audio = form.get("audio");
  const durationRaw = form.get("durationSeconds");
  if (typeof sessionId !== "string" || !(audio instanceof Blob)) {
    return Response.json({ error: "Dados inválidos.", code: "INVALID_INPUT" }, { status: 400 });
  }
  const durationSeconds = typeof durationRaw === "string" ? Number(durationRaw) : NaN;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_SECONDS + 1) {
    return Response.json({ error: "Gravação inválida ou maior que 30 segundos.", code: "AUDIO_TOO_LONG" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "Áudio maior que 2 MB.", code: "AUDIO_TOO_LARGE" }, { status: 400 });
  }
  const declaredType = audio.type || "";
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => declaredType.startsWith(prefix))) {
    return Response.json({ error: "Formato de áudio não suportado.", code: "AUDIO_INVALID_FORMAT" }, { status: 400 });
  }

  // Sessão precisa pertencer ao usuário autenticado e estar ativa.
  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
  }

  const buffer = new Uint8Array(await audio.arrayBuffer());
  if (!sniffAudioSignature(buffer)) {
    return Response.json({ error: "Arquivo de áudio inválido.", code: "AUDIO_SIGNATURE_INVALID" }, { status: 400 });
  }

  const service = createServiceClient();
  if (await isRateLimited(service, { userId: user.id, operation: "transcription", maxPerWindow: 10, windowSeconds: 120 })) {
    return Response.json({ error: "Muitas gravações em pouco tempo. Aguarde um instante.", code: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const client = getOpenAIClient();
    const file = await toFile(buffer, "gravacao.webm", { type: declaredType });
    const result = await client.audio.transcriptions.create({
      model: OPENAI_TRANSCRIPTION_MODEL,
      file,
      language: "pt",
    });

    const usage = (result as { usage?: { input_tokens?: number; output_tokens?: number; type?: string } }).usage;
    const inputTokens = usage?.type === "tokens" ? (usage.input_tokens ?? 0) : 0;
    const outputTokens = usage?.type === "tokens" ? (usage.output_tokens ?? 0) : 0;
    await logAudioUsage(service, {
      userId: user.id,
      sessionId,
      operation: "transcription",
      model: OPENAI_TRANSCRIPTION_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateTranscriptionCostUsd(inputTokens, outputTokens),
    });

    // Não consome pergunta aqui — só quando o estudante revisar e ENVIAR o
    // texto pela rota de chat normal (/api/patient/chat) é que uma das 20
    // perguntas é debitada.
    return Response.json({ transcript: result.text ?? "" });
  } catch (err) {
    console.error("[patient/transcribe] erro ao transcrever", {
      ...safeErrorMeta(err),
      model: OPENAI_TRANSCRIPTION_MODEL,
      apiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    });
    return Response.json({ error: "Não foi possível transcrever o áudio agora. Tente digitar sua pergunta.", code: "TRANSCRIBE_ERROR" }, { status: 502 });
  }
}
