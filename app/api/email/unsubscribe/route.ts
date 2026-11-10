import { createServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "@/lib/lifecycle-email";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readLink(request: Request): { userId: string; valid: boolean } {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!UUID.test(userId)) return { userId, valid: false };
  try {
    return { userId, valid: verifyUnsubscribeToken(userId, token) };
  } catch {
    return { userId, valid: false };
  }
}

function page(body: string, status: number): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SemioLab</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f7f6;font-family:Arial,sans-serif;color:#17353a"><div style="max-width:420px;padding:24px;font-size:17px;line-height:1.5;text-align:center">${body}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/** Link do rodapé do e-mail. Só mostra o botão: quem descadastra é o POST,
 * para que antivírus e pré-carregadores de link (que abrem todo GET do
 * e-mail) não descadastrem ninguém sem querer. */
export async function GET(request: Request) {
  if (!readLink(request).valid) return page("Este link de descadastro está incompleto ou expirou.", 400);
  return page(
    `<p>Parar de receber os e-mails de lembrete do SemioLab?</p><form method="post"><button style="padding:13px 22px;background:#087f72;color:#fff;border:0;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer">Não quero mais receber</button></form>`,
    200,
  );
}

/** Confirmação do botão acima e descadastro em um clique dos clientes de
 * e-mail (List-Unsubscribe-Post). */
export async function POST(request: Request) {
  const { userId, valid } = readLink(request);
  if (!valid) return page("Este link de descadastro está incompleto ou expirou.", 400);
  const { error } = await createServiceClient().from("profiles").update({ email_opt_out: true }).eq("id", userId);
  if (error) return page("Não foi possível concluir agora. Tente de novo em alguns minutos.", 500);
  return page("Pronto. Você não vai mais receber e-mails de lembrete do SemioLab.", 200);
}
