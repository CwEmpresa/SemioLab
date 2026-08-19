import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; examId?: string };
  const sessionId = body.sessionId;
  const examId = body.examId;
  if (!sessionId || !examId) return Response.json({ error: "Dados inválidos." }, { status: 400 });

  // A sessão precisa pertencer ao usuário autenticado (RLS: select own).
  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, case_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return Response.json({ error: "Sessão inválida." }, { status: 404 });

  const service = createServiceClient();

  // Gate central: a imagem só é entregue se o estudante JÁ solicitou este
  // exame (mesmo examId canônico) nesta sessão — nunca antes da solicitação,
  // e nunca de outra sessão/caso. Reaproveita a mesma verificação usada
  // para bloquear duplicidade em /api/patient/exam.
  const { data: pastExamMessages } = await service
    .from("patient_messages")
    .select("exam_report")
    .eq("session_id", sessionId)
    .eq("role", "exam")
    .neq("content", "Exame físico realizado");
  const requestedIds = new Set<string>();
  for (const row of pastExamMessages ?? []) {
    const ids = (row.exam_report as { examIds?: string[] } | null)?.examIds;
    ids?.forEach((id) => requestedIds.add(id));
  }
  if (!requestedIds.has(examId)) {
    // Não revela se existem assets cadastrados — só que o acesso não está
    // liberado ainda.
    return Response.json({ images: [] });
  }

  const { data: assets } = await service
    .from("patient_exam_assets")
    .select("id, storage_path, caption, alt_text, source_url, author, license, license_url, attribution, sort_order")
    .eq("case_id", session.case_id)
    .eq("exam_id", examId)
    .order("sort_order", { ascending: true })
    .limit(3);

  if (!assets || assets.length === 0) {
    // Sem imagem cadastrada: o laudo em texto continua funcionando
    // normalmente, sem esta seção extra.
    return Response.json({ images: [] });
  }

  const images = await Promise.all(
    assets.map(async (asset) => {
      const { data: signed } = await service.storage
        .from("exam-images")
        .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
      return {
        url: signed?.signedUrl ?? null,
        caption: asset.caption,
        altText: asset.alt_text,
        sourceUrl: asset.source_url,
        author: asset.author,
        license: asset.license,
        licenseUrl: asset.license_url,
        attribution: asset.attribution,
      };
    }),
  );

  return Response.json({ images: images.filter((img) => img.url) });
}
