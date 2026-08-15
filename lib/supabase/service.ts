import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave "service role": ignora RLS por completo.
 * NUNCA importar isto em código que roda no browser, nem usar fora de
 * rotas de servidor já protegidas por validação própria (ex.: o segredo
 * do webhook da Cakto). Toda escrita em `subscriptions`/`payment_events`
 * passa por aqui, pois usuários comuns não têm policy de escrita nessas
 * tabelas (só SELECT da própria assinatura).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente: configuração de servidor incompleta.");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
