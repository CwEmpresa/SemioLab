import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/auth/confirm", "/auth/update-password", "/auth/error"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não remover. Renova o token de sessão se necessário.
  //
  // getClaims() valida o JWT localmente (chave assimétrica ES256, JWKS em
  // cache) e só vai à rede quando o token expirou e precisa ser renovado.
  // Antes era getUser(), que fazia uma ida ao servidor de Auth (us-west-2)
  // em TODA requisição — inclusive antes de cada pergunta ao Paciente IA.
  // As rotas e páginas continuam validando a sessão por conta própria.
  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (!error && typeof sub === "string" && sub) user = { id: sub };
  } catch {
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id } : null;
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // Protege as APIs no próprio route handler (retornam 401), então o
  // middleware só precisa evitar acesso indevido às páginas internas.
  if (!user && !isPublicPath && !isApiRoute) {
    // A própria página raiz decide se mostra login ou app (server component),
    // então não redirecionamos aqui — apenas garantimos que a sessão esteja
    // sempre atualizada nas requisições.
  }

  return response;
}
