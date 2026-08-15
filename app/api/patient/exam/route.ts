import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserAccess } from "@/lib/user-access";
import type { HiddenCase } from "@/lib/patient-case-schema";
import { matchExamFindings } from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";

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
      return Response.json(
        {
          error:
            access.tier === "free"
              ? "Você atingiu o limite de 1 exame por atendimento do plano básico. Assine o Pro para exames ilimitados."
              : "Você atingiu o limite de exames deste atendimento no período de teste.",
          limitReached: true,
          tier: access.tier,
        },
        { status: 403 },
      );
    }
  }

  const service = createServiceClient();
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

  const found = matchExamFindings(hidden, order);
  const report = {
    summary: found.length
      ? "Resultados liberados com base no pedido registrado."
      : "Nenhum exame compatível com esse pedido foi encontrado. Revise o nome do exame solicitado.",
    labs: found
      .filter((e) => e.type === "lab")
      .map((e) => ({ name: e.name, value: e.result, unit: "", reference: "" })),
    imaging: found
      .filter((e) => e.type === "imaging")
      .map((e) => ({ title: e.name, findings: e.result, comparison: "" })),
  };

  await service.from("patient_messages").insert({
    session_id: sessionId,
    role: "exam",
    content: order,
    exam_report: report,
  });

  return Response.json({ order, report });
}
