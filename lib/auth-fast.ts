import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Id do usuário autenticado pelo caminho mais rápido disponível.
 *
 * `getClaims()` valida o JWT localmente (chaves assimétricas, JWKS em
 * cache) — sem a ida ao servidor de Auth que o `getUser()` faz em toda
 * requisição. Se o projeto ainda usa segredo simétrico, o próprio
 * `getClaims()` cai no mesmo caminho do `getUser()`, então nunca fica
 * menos seguro, só mais rápido quando pode. */
export async function getAuthUserId(supabase: ServerClient): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!error && typeof sub === "string" && sub.length > 0) return sub;
  } catch {
    /* cai no getUser abaixo */
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
