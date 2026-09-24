import { createHmac, timingSafeEqual } from "crypto";

/** Assinatura de uma frase que o servidor mandou o paciente falar. Serve
 * para o endpoint de voz só aceitar texto que ELE MESMO gerou nesta sessão —
 * sem isso, qualquer usuário poderia pedir voz para texto arbitrário. */
function hmacKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Chave de assinatura ausente: configuração de servidor incompleta.");
  return key;
}

export function signSentence(sessionId: string, text: string): string {
  return createHmac("sha256", hmacKey()).update(`${sessionId}\n${text}`).digest("hex");
}

export function verifySentence(sessionId: string, text: string, sig: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = Buffer.from(signSentence(sessionId, text), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Marcador que o servidor coloca no fim de cada frase completa do stream de
 * texto: `\u0001<assinatura>\u0001`. O cliente usa para começar a falar a
 * primeira frase enquanto o resto da resposta ainda está sendo escrita. */
export const SENTENCE_MARKER_RE = /\u0001([0-9a-f]{64})\u0001/;

const MIN_SENTENCE_CHARS = 12;

/** Divide o texto que chega em pedaços (deltas) em frases, devolvendo o
 * texto a enviar ao cliente já com o marcador de fim de frase. Frases
 * curtíssimas ("Oi.", "Dr.") são juntadas à seguinte. */
export function createSentenceMarker(sign: (sentence: string) => string) {
  let buf = "";
  let emitted = 0;
  let segStart = 0;
  const marker = (sentence: string) => `\u0001${sign(sentence)}\u0001`;

  function push(delta: string): string {
    buf += delta;
    let out = "";
    const re = /[.!?]+(?=\s)/g;
    re.lastIndex = segStart;
    for (let m = re.exec(buf); m; m = re.exec(buf)) {
      const end = m.index + m[0].length;
      const sentence = buf.slice(segStart, end).trim();
      if (sentence.length < MIN_SENTENCE_CHARS) continue;
      out += buf.slice(emitted, end) + marker(sentence);
      emitted = end;
      segStart = end;
      re.lastIndex = end;
    }
    // Não envia a pontuação final ainda: só se sabe que a frase terminou
    // quando chega o espaço depois dela (evita cortar "3.5" ou "Dr. Silva").
    const trailing = /[.!?]+$/.exec(buf);
    const safeEnd = trailing ? trailing.index : buf.length;
    if (safeEnd > emitted) {
      out += buf.slice(emitted, safeEnd);
      emitted = safeEnd;
    }
    return out;
  }

  function flush(): string {
    let out = buf.slice(emitted);
    emitted = buf.length;
    const sentence = buf.slice(segStart).trim();
    if (sentence.length > 0) out += marker(sentence);
    segStart = buf.length;
    return out;
  }

  return { push, flush };
}
