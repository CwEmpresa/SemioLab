import "server-only";

/** Conversa por voz em tempo real (OpenAI Realtime, fala → fala).
 *
 * Em vez de 4 etapas em sequência (gravar → transcrever → responder →
 * gerar voz), o navegador abre uma ligação WebRTC direto com a OpenAI e o
 * modelo ouve e responde em áudio na hora. O servidor só entrega uma chave
 * temporária (que vale para abrir UMA ligação) com o roteiro do paciente já
 * configurado, e depois salva cada troca na consulta.
 *
 * O roteiro enviado tem só o que o paciente sabe sobre si (persona,
 * sintomas e exame físico) — nunca o diagnóstico nem a avaliação, que
 * continuam só no servidor. */

export const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
export const REALTIME_TRANSCRIPTION_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";

/** Pausa (ms) que encerra a vez do aluno. Curta para a resposta vir logo,
 * mas não tão curta a ponto de cortar quem faz uma pausa para pensar. */
export const REALTIME_SILENCE_MS = Number(process.env.OPENAI_REALTIME_SILENCE_MS ?? 500);

export type RealtimeVoice = "marin" | "coral" | "cedar" | "ash";

/** Mesmo critério das vozes da TTS (sexo × idade), com as vozes que existem
 * no modo tempo real. */
export function resolveRealtimeVoice(sex: string | undefined, age: number | undefined): RealtimeVoice {
  const isMale = (sex ?? "").trim().toLowerCase() === "masculino";
  const isYoung = (age ?? 40) < 45;
  if (isMale) return isYoung ? "cedar" : "ash";
  return isYoung ? "marin" : "coral";
}

/** Orientações extras de VOZ (o roteiro e as regras do paciente vêm de
 * buildPatientSystemInstruction, as mesmas da consulta por texto). */
export function realtimeVoiceAddendum(tone: string | undefined, age: number | undefined): string {
  const young = (age ?? 40) < 45;
  return [
    "",
    "COMO FALAR NESTA LIGAÇÃO (é uma conversa por voz, ao vivo):",
    "- Fale em português do Brasil, com sotaque brasileiro natural, nunca de Portugal e nunca em inglês.",
    "- Responda LOGO e curto: em geral 1 ou 2 frases. Comece pela resposta, sem 'hum', sem enrolar.",
    "- Voz de pessoa real batendo papo, informal, com emoção de quem está doente (cansaço, incômodo, preocupação), sem exagero de teatro. Nunca soe como locutor ou assistente.",
    young ? "- Ritmo um pouco mais vivo, como alguém mais jovem." : "- Ritmo mais pausado e calmo, como alguém mais velho.",
    tone ? `- Jeito da pessoa: ${tone}.` : "",
    "- Se o estudante falar por cima de você, pare e escute.",
    "- Se só ouvir ruído, barulho ou uma palavra solta sem sentido, não responda nada de novo: no máximo diga 'oi?' bem curto.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Preço por 1 milhão de tokens (US$). Ajustável por variável de ambiente;
 * os padrões são estimativas — confira a tabela da OpenAI do modelo usado. */
const REALTIME_PRICES = {
  textIn: Number(process.env.OPENAI_PRICE_REALTIME_TEXT_INPUT ?? 0.6),
  textCachedIn: Number(process.env.OPENAI_PRICE_REALTIME_TEXT_CACHED_INPUT ?? 0.06),
  audioIn: Number(process.env.OPENAI_PRICE_REALTIME_AUDIO_INPUT ?? 10),
  audioCachedIn: Number(process.env.OPENAI_PRICE_REALTIME_AUDIO_CACHED_INPUT ?? 0.3),
  textOut: Number(process.env.OPENAI_PRICE_REALTIME_TEXT_OUTPUT ?? 2.4),
  audioOut: Number(process.env.OPENAI_PRICE_REALTIME_AUDIO_OUTPUT ?? 20),
};

export type RealtimeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number; cached_tokens_details?: { text_tokens?: number; audio_tokens?: number } };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, 1_000_000) : 0);

export function estimateRealtimeCostUsd(usage: RealtimeUsage | null | undefined): { inputTokens: number; outputTokens: number; costUsd: number } {
  if (!usage) return { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const inD = usage.input_token_details ?? {};
  const outD = usage.output_token_details ?? {};
  const cachedText = n(inD.cached_tokens_details?.text_tokens);
  const cachedAudio = n(inD.cached_tokens_details?.audio_tokens);
  const textIn = Math.max(0, n(inD.text_tokens) - cachedText);
  const audioIn = Math.max(0, n(inD.audio_tokens) - cachedAudio);
  const p = REALTIME_PRICES;
  const costUsd =
    (textIn * p.textIn +
      cachedText * p.textCachedIn +
      audioIn * p.audioIn +
      cachedAudio * p.audioCachedIn +
      n(outD.text_tokens) * p.textOut +
      n(outD.audio_tokens) * p.audioOut) /
    1_000_000;
  return { inputTokens: n(usage.input_tokens), outputTokens: n(usage.output_tokens), costUsd };
}
