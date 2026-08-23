import webpush from "web-push";

let configured = false;

/** Configura o web-push (chaves VAPID) uma única vez por processo. Nunca
 * expõe a chave privada — só é usada aqui, server-side. */
export function getWebPush() {
  if (!configured) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:suporte.semiolab@gmail.com";
    if (!publicKey || !privateKey) {
      throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes: configuração de servidor incompleta.");
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return webpush;
}

export const DEEP_LINKS = {
  patient: "/?screen=patient",
  simulado: "/?screen=quiz",
  auscultation: "/?screen=auscultation",
  streak: "/?screen=home",
} as const;

export const NOTIFICATION_MESSAGES = {
  patient: { title: "Novo paciente", body: "Seu paciente está esperando para ser atendido." },
  simulado: { title: "Novo simulado", body: "Seu desafio clínico de hoje está disponível." },
  auscultation: { title: "Treino de ausculta", body: "Pratique um som clínico hoje." },
  streak: { title: "Mantenha sua sequência", body: "Entre hoje para manter seu streak." },
} as const;
