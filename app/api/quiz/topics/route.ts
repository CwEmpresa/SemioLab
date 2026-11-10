import { getAuthUserId } from "@/lib/auth-fast";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { countPublishedByTopic, countPublishedTotal } from "@/lib/question-bank";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const authUserId = await getAuthUserId(supabase);
  const user = authUserId ? { id: authUserId } : null;
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();
  const [byTopic, total] = await Promise.all([countPublishedByTopic(service), countPublishedTotal(service)]);
  return Response.json({ byTopic, total });
}
