import "server-only";
import crypto from "node:crypto";

/** E-mails de retorno (D1, D3, D7). Só 4% da base ativou push, então sem
 * e-mail não havia como chamar de volta quem se cadastrou e sumiu.
 *
 * Envio pela API HTTP do Resend — sem dependência nova. Sem RESEND_API_KEY
 * a rotina inteira fica desligada (nada é enviado nem marcado como enviado). */

export type LifecycleKind = "d1" | "d3" | "d7";

export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://semiolab.vercel.app").replace(/\/$/, "");

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function unsubscribeSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error("EMAIL_UNSUBSCRIBE_SECRET/CRON_SECRET ausente.");
  return secret;
}

/** Assinatura do link de descadastro: só quem recebeu o e-mail consegue
 * descadastrar aquele usuário, sem precisar estar logado. */
export function unsubscribeToken(userId: string): string {
  return crypto.createHmac("sha256", unsubscribeSecret()).update(`unsubscribe:${userId}`).digest("hex");
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId));
  const received = Buffer.from(token || "");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function unsubscribeUrl(userId: string): string {
  return `${APP_URL}/api/email/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

type Copy = { subject: string; heading: string; body: string; cta: string; path: string };

function copyFor(kind: LifecycleKind, finishedConsult: boolean): Copy {
  if (kind === "d1") {
    return finishedConsult
      ? {
          subject: "Seu próximo paciente já está na sala de espera",
          heading: "Um caso novo por dia fixa o que você estudou",
          body: "Você já atendeu seu primeiro paciente. O de hoje é um caso diferente: 10 minutos de anamnese, exame e hipótese, com a avaliação do que faltou investigar.",
          cta: "Atender o paciente de hoje",
          path: "/?screen=patient",
        }
      : {
          subject: "Seu primeiro paciente ainda está esperando",
          heading: "Faça sua primeira consulta em 10 minutos",
          body: "A consulta guiada mostra o roteiro da anamnese e sugere perguntas quando você travar. No fim, você recebe a nota e o checklist do que um avaliador esperava ver.",
          cta: "Atender meu primeiro paciente",
          path: "/?screen=patient",
        };
  }
  if (kind === "d3") {
    return {
      subject: "5 questões para não perder o ritmo",
      heading: "Um treino curto vale mais que uma maratona na véspera",
      body: "Escolha o tema que você está vendo na faculdade e responda 5 questões comentadas. Cada erro vira um flashcard para revisar depois.",
      cta: "Fazer 5 questões agora",
      path: "/?screen=quiz",
    };
  }
  return {
    subject: "Seu teste terminou, mas uma consulta por semana continua grátis",
    heading: "Você ainda tem uma consulta grátis por semana",
    body: "O período de teste acabou, e o plano gratuito segue com uma consulta com o Paciente Virtual por semana e flashcards todos os dias. Se a prova prática está chegando, o modo cronometrado simula uma estação de OSCE.",
    cta: "Usar minha consulta da semana",
    path: "/?screen=patient",
  };
}

export function buildLifecycleEmail(params: { kind: LifecycleKind; userId: string; name: string | null; finishedConsult: boolean }) {
  const copy = copyFor(params.kind, params.finishedConsult);
  const firstName = (params.name || "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Oi, ${escapeHtml(firstName)}.` : "Oi.";
  const link = `${APP_URL}${copy.path}`;
  const unsubscribe = unsubscribeUrl(params.userId);
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#17353a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#087f72;letter-spacing:.06em">SEMIOLAB</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#10262b">${escapeHtml(copy.heading)}</h1>
<p style="margin:0 0 10px;font-size:15px;line-height:1.6">${greeting}</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6">${escapeHtml(copy.body)}</p>
<p style="margin:0 0 26px"><a href="${link}" style="display:inline-block;padding:13px 22px;background:#087f72;color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:bold">${escapeHtml(copy.cta)}</a></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#6b8380">Você recebeu este e-mail porque criou uma conta no SemioLab. <a href="${unsubscribe}" style="color:#6b8380">Não quero mais receber</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${firstName ? `Oi, ${firstName}.` : "Oi."}\n\n${copy.body}\n\n${copy.cta}: ${link}\n\nNão quer mais receber? ${unsubscribe}`;
  return { subject: copy.subject, html, text, unsubscribe };
}

export async function sendEmail(params: { to: string; subject: string; html: string; text: string; unsubscribe: string }): Promise<boolean> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: { "List-Unsubscribe": `<${params.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  return response.ok;
}
