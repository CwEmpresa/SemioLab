type SupabaseUser = { id: string; email?: string; user_metadata?: { name?: string; full_name?: string } };

async function config() {
  return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
}

export async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, key } = await config();
  if (!url || !key) return new Response(JSON.stringify({ message: "Autenticação ainda não configurada." }), { status: 503, headers: { "content-type": "application/json" } });
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("content-type", "application/json");
  return fetch(`${url.replace(/\/$/, "")}/auth/v1${path}`, { ...init, headers });
}

export async function getSupabaseUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const response = await supabaseRequest("/user", { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const user = await response.json() as SupabaseUser;
  if (!user.email) return null;
  return { email: user.email, displayName: user.user_metadata?.name || user.user_metadata?.full_name || user.email.split("@")[0] };
}
