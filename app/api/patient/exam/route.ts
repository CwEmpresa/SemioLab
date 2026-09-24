import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserAccess } from "@/lib/user-access";
import type { HiddenCase } from "@/lib/patient-case-schema";
import { resolveExamOrder, type ResolvedItem } from "@/lib/exam-resolver";
import { logAiUsage } from "@/lib/ai-usage";
import { OPENAI_MODEL } from "@/lib/openai";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  const order = typeof body.order === "string" ? body.order.trim().slice(0, 400) : "";
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

  // Impede solicitação duplicada: busca todos os exames já liberados nesta
  // sessão (ids canônicos, ou ids "gen_*" dos resultados gerados) e verifica
  // sobreposição com o que está sendo pedido agora.
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

  // Resolve o pedido: regras rápidas primeiro (catálogo, modalidade + região
  // do exame), e só chama o modelo para o que as regras não entenderam.
  const resolution = await resolveExamOrder(hidden, order);
  if (resolution.usage) {
    await logAiUsage(service, { userId: user.id, sessionId, operation: "chat", model: OPENAI_MODEL, usage: resolution.usage });
  }

  const idsOf = (item: ResolvedItem) => (item.kind === "registered" ? item.exam.examIds : [item.id]);
  const newItems = resolution.items.filter((item) => !idsOf(item).some((id) => alreadyRequestedIds.has(id)));
  const duplicateCount = resolution.items.length - newItems.length;

  if (resolution.items.length === 0) {
    return Response.json({ order, report: { summary: UNRECOGNIZED_MESSAGE, labs: [], imaging: [] } });
  }
  if (newItems.length === 0) {
    // Todos os exames pedidos já tinham sido solicitados: nenhuma evidência
    // ou pontuação nova é concedida, e nada é gravado de novo.
    return Response.json({
      order,
      report: { summary: ALREADY_REQUESTED_MESSAGE, labs: [], imaging: [] },
      duplicate: true,
    });
  }

  const normalized = newItems.map((item) =>
    item.kind === "registered"
      ? { name: item.exam.name, type: item.exam.type, result: item.exam.result, examId: item.exam.examIds[0], ids: item.exam.examIds }
      : { name: item.name, type: item.type, result: item.result, examId: undefined as string | undefined, ids: [item.id] },
  );

  const notes: string[] = [];
  if (duplicateCount > 0) notes.push("um dos exames já havia sido solicitado antes");
  if (resolution.unresolved.length > 0) notes.push(`não identifiquei: ${resolution.unresolved.join("; ")}`);
  const report = {
    summary: `Resultados liberados com base no pedido registrado${notes.length ? ` (${notes.join(" · ")})` : ""}.`,
    labs: normalized.filter((e) => e.type === "lab").map((e) => ({ name: e.name, value: e.result, unit: "", reference: "" })),
    imaging: normalized
      .filter((e) => e.type === "imaging")
      .map((e) => ({ title: e.name, findings: e.result, comparison: "Sem exame anterior para comparação.", examId: e.examId })),
  };

  await service.from("patient_messages").insert({
    session_id: sessionId,
    role: "exam",
    content: order,
    exam_report: { ...report, examIds: normalized.flatMap((e) => e.ids) },
  });

  return Response.json({ order, report });
}
