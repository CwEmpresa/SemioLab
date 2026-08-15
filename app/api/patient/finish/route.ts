import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini";
import type { HiddenCase } from "@/lib/patient-case-schema";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  historyScore: z.number().min(0).max(30),
  physicalScore: z.number().min(0).max(15),
  examsScore: z.number().min(0).max(15),
  reasoningScore: z.number().min(0).max(40),
  strengths: z.array(z.string()).default([]),
  gaps: z.array(z.string()).default([]),
  examLearning: z.array(z.string()).default([]),
  feedback: z.string().default(""),
});

function clamp(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
    hypothesis?: string;
    differentials?: string;
    conduct?: string;
  };
  const sessionId = body.sessionId;
  const hypothesis = (body.hypothesis || "").trim().slice(0, 800);
  const differentials = (body.differentials || "").trim().slice(0, 800);
  const conduct = (body.conduct || "").trim().slice(0, 800);
  if (!sessionId || !hypothesis || !conduct) {
    return Response.json({ error: "Preencha hipótese e conduta para finalizar." }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, case_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada." }, { status: 404 });
  }

  const service = createServiceClient();
  const [{ data: caseRow }, { data: caseDetails }, { data: historyRows }] = await Promise.all([
    service.from("patient_cases").select("specialty, title").eq("id", session.case_id).single(),
    service.from("patient_case_details").select("hidden_case").eq("case_id", session.case_id).single(),
    service.from("patient_messages").select("role, content").eq("session_id", sessionId).order("created_at", { ascending: true }),
  ]);
  if (!caseDetails || !caseRow) return Response.json({ error: "Caso clínico indisponível." }, { status: 500 });
  const hidden = caseDetails.hidden_case as HiddenCase;

  const transcript = (historyRows ?? [])
    .map((row) => `${row.role === "student" ? "Estudante" : row.role === "patient" ? "Paciente" : "Exame"}: ${row.content}`)
    .join("\n")
    .slice(0, 14000);

  const evalPrompt = [
    "Você é um preceptor de medicina avaliando um atendimento simulado.",
    `Caso: ${caseRow.title} (${caseRow.specialty}).`,
    `Diagnóstico correto (gabarito, NÃO mostrar ao estudante): ${hidden.diagnosis}`,
    `Diferenciais esperados: ${hidden.differentials.join(", ")}`,
    `Conduta ideal: ${hidden.idealConduct.join("; ")}`,
    `Perguntas-chave esperadas na anamnese: ${hidden.keyQuestions.join("; ")}`,
    "",
    "Transcrição do atendimento:",
    transcript || "(sem perguntas registradas)",
    "",
    "Hipótese diagnóstica do estudante:",
    hypothesis,
    "Diagnósticos diferenciais do estudante:",
    differentials || "(não informado)",
    "Conduta proposta pelo estudante:",
    conduct,
    "",
    "Avalie e responda APENAS com um JSON no formato:",
    '{"score":0-100,"historyScore":0-30,"physicalScore":0-15,"examsScore":0-15,"reasoningScore":0-40,"strengths":["..."],"gaps":["..."],"examLearning":["..."],"feedback":"texto curto em português"}',
    "score deve ser a soma dos quatro sub-escores. Seja justo e educativo, em português do Brasil.",
  ].join("\n");

  let evaluation: z.infer<typeof EvaluationSchema>;
  try {
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: evalPrompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 900 },
    });
    const raw = JSON.parse(result.text ?? "{}");
    evaluation = EvaluationSchema.parse({
      score: clamp(raw.score, 100),
      historyScore: clamp(raw.historyScore, 30),
      physicalScore: clamp(raw.physicalScore, 15),
      examsScore: clamp(raw.examsScore, 15),
      reasoningScore: clamp(raw.reasoningScore, 40),
      strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 8) : [],
      gaps: Array.isArray(raw.gaps) ? raw.gaps.slice(0, 8) : [],
      examLearning: Array.isArray(raw.examLearning) ? raw.examLearning.slice(0, 8) : [],
      feedback: typeof raw.feedback === "string" ? raw.feedback.slice(0, 1200) : "",
    });
  } catch (err) {
    console.error("[patient/finish] erro na avaliação Gemini", err instanceof Error ? err.message : err);
    return Response.json({ error: "Não foi possível avaliar o atendimento agora. Tente novamente." }, { status: 502 });
  }

  // XP concedido com segurança no servidor: insere em patient_attempts, cuja
  // trigger apply_patient_xp (já existente no banco) soma XP ao perfil.
  const { error: insertError } = await service.from("patient_attempts").insert({
    user_id: user.id,
    topic: caseRow.specialty,
    score: evaluation.score,
    history_score: evaluation.historyScore,
    physical_score: evaluation.physicalScore,
    exams_score: evaluation.examsScore,
    reasoning_score: evaluation.reasoningScore,
  });
  if (insertError) {
    console.error("[patient/finish] erro ao gravar patient_attempts", insertError.message);
  }

  await service
    .from("patient_sessions")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      score: evaluation.score,
      xp_awarded: evaluation.score,
      feedback: evaluation,
    })
    .eq("id", sessionId);

  return Response.json(evaluation);
}
