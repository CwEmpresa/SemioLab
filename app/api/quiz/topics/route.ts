import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { countPublishedByTopic, countPublishedTotal } from "@/lib/question-bank";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();
  const [byTopic, total] = await Promise.all([countPublishedByTopic(service), countPublishedTotal(service)]);
  return Response.json({ byTopic, total });
}
