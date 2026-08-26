import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const CASE_ID = "first_experience_pneumonia";
const EXAM_ID = "chest_xray";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();
  const { data: asset } = await service
    .from("first_experience_exam_assets")
    .select("case_id, exam_id, storage_path, author, source_url, license, attribution")
    .eq("case_id", CASE_ID)
    .eq("exam_id", EXAM_ID)
    .maybeSingle();

  // Garante que o asset pertence ao mesmo caso+exame antes de qualquer
  // outra coisa — nunca serve arquivo de origem diferente.
  if (!asset || asset.case_id !== CASE_ID || asset.exam_id !== EXAM_ID) {
    return Response.json({ available: false });
  }
  if (!asset.storage_path) {
    // Imagem ainda não cadastrada — o cliente usa o fallback de laudo
    // textual, nunca uma imagem aleatória.
    return Response.json({ available: false, attribution: asset.attribution });
  }

  const { data: signed } = await service.storage.from("exam-images").createSignedUrl(asset.storage_path, 600);
  if (!signed?.signedUrl) return Response.json({ available: false });

  return Response.json({ available: true, url: signed.signedUrl, attribution: asset.attribution });
}
