import { getSupabaseUser } from "../../supabase-auth";

export const dynamic = "force-dynamic";

const pending = () => Response.json(
  {
    error: "Banco de dados ainda não configurado",
    message: "A autenticação e as tabelas do SemioLab precisam ser conectadas ao Supabase.",
  },
  { status: 503 },
);

export async function GET(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  return pending();
}

export async function POST(request: Request) {
  const user = await getSupabaseUser(request);
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });
  return pending();
}
