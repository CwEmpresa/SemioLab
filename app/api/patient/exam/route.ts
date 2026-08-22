import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserAccess } from "@/lib/user-access";
import type { HiddenCase } from "@/lib/patient-case-schema";
import { matchExamFindings, matchCanonicalExamIds } from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";

const NOT_AVAILABLE_MESSAGE = "Este exame não está disponível neste caso simulado.";
const UNRECOGNIZED_MESSAGE = "Nenhum exame compatível com esse pedido foi encontrado. Revise o nome do exame solicitado.";
const ALREADY_REQUESTED_MESSAGE = "Este exame já foi solicitado.";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string; order?: string; physical?: boolean };
  const sessionId = body.sessionId;
  const wantsPhysical = body.physical === true;
  const order = typeof body.order === "string" ? body.order.trim().slice(0, 300) : "";
  if (!sessionId || (!order && !wantsPhysical)) return Response.json({ error: "Dados inválidos." }, { status: 400 });

  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, case_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada." }, { status: 404 });
  }

  const service = createServiceClient();

  // Exame físico não conta no limite de exames laboratoriais/imagem — é uma
  // etapa central da anamnese, não um "exame solicitado".
  if (!wantsPhysical) {
    const access = await resolveUserAccess(supabase, user.id);
    const { count: examsUsed } = await supabase
      .from("patient_messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("role", "exam")
      .neq("content", "Exame físico realizado");
    if ((examsUsed ?? 0) >= access.limits.examsPerConsultation) {
      const limit = access.limits.examsPerConsultation;
      return Response.json(
        {
          error:
            limit === 0
              ? "O Paciente Virtual é um recurso exclusivo do plano Pro (ou do período de teste)."
              : access.tier === "free"
                ? `Você atingiu o limite de ${limit} exame${limit > 1 ? "s" : ""} por atendimento do plano básico. Assine o Pro para exames ilimitados.`
                : "Você atingiu o limite de exames deste atendimento no período de teste.",
          limitReached: true,
          tier: access.tier,
        },
        { status: 403 },
      );
    }
  }

  const { data: caseDetails } = await service
    .from("patient_case_details")
    .select("hidden_case")
    .eq("case_id", session.case_id)
    .single();
  if (!caseDetails) return Response.json({ error: "Caso clínico indisponível." }, { status: 500 });
  const hidden = caseDetails.hidden_case as HiddenCase;

  if (wantsPhysical) {
    const findings = Object.entries(hidden.physicalExam).map(([key, value]) => `${key}: ${value}`).join(" · ");
    await service.from("patient_messages").insert({
      session_id: sessionId,
      role: "exam",
      content: "Exame físico realizado",
      exam_report: { summary: "Exame físico direcionado.", findings },
    });
    return Response.json({ physicalExam: hidden.physicalExam });
  }

  // IDs canônicos citados no pedido (correspondência exata antes de
  // qualquer busca aproximada — ver lib/exam-catalog.ts).
  const requestedIds = matchCanonicalExamIds(order);

  // Impede solicitação duplicada pelo MESMO id canônico: busca todos os
  // exames já liberados nesta sessão e verifica sobreposição.
  const { data: pastExamMessages } = await service
    .from("patient_messages")
    .select("exam_report")
    .eq("session_id", sessionId)
    .eq("role", "exam")
    .neq("content", "Exame físico realizado");
  const alreadyRequestedIds = new Set<string>();
  for (const row of pastExamMessages ?? []) {
    const ids = (row.exam_report as { examIds?: string[] } | null)?.examIds;
    ids?.forEach((id) => alreadyRequestedIds.add(id));
  }
  const duplicateIds = requestedIds.filter((id) => alreadyRequestedIds.has(id));
  const newIds = requestedIds.filter((id) => !alreadyRequestedIds.has(id));

  if (requestedIds.length > 0 && newIds.length === 0) {
    // Todos os exames pedidos já tinham sido solicitados: nenhuma evidência
    // ou pontuação nova é concedida, e nada é gravado de novo.
    return Response.json({
      order,
      report: { summary: ALREADY_REQUESTED_MESSAGE, labs: [], imaging: [] },
      duplicate: true,
    });
  }

  // Busca no CASO REAL (nunca inventa) só os exames com id novo.
  const found = matchExamFindings(hidden, order).filter((exam) => exam.examIds.some((id) => newIds.includes(id)));

  // A API NUNCA retorna corpo vazio: se o exame pedido foi reconhecido mas
  // não está cadastrado NESTE caso, a mensagem é explícita e diferente de
  // "pedido não reconhecido" (texto livre sem exame correspondente).
  const summary =
    found.length > 0
      ? duplicateIds.length > 0
        ? "Resultados liberados com base no pedido registrado (um dos exames já havia sido solicitado antes)."
        : "Resultados liberados com base no pedido registrado."
      : newIds.length > 0
        ? NOT_AVAILABLE_MESSAGE
        : UNRECOGNIZED_MESSAGE;

  const report = {
    summary,
    labs: found
      .filter((e) => e.type === "lab")
      .map((e) => ({ name: e.name, value: e.result, unit: "", reference: "" })),
    imaging: found
      .filter((e) => e.type === "imaging")
      .map((e) => ({ title: e.name, findings: e.result, comparison: "Sem exame anterior para comparação.", examId: e.examIds[0] })),
  };

  if (found.length > 0) {
    await service.from("patient_messages").insert({
      session_id: sessionId,
      role: "exam",
      content: order,
      exam_report: { ...report, examIds: found.flatMap((e) => e.examIds) },
    });
  }

  return Response.json({ order, report });
}
