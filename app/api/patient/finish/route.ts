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
type Evaluation = z.infer<typeof EvaluationSchema>;

function clamp(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

/** Remove cercas de código markdown (```json ... ``` ou ``` ... ```) que
 * o modelo às vezes inclui mesmo com responseMimeType "application/json". */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeEvaluation(raw: unknown): Evaluation {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return EvaluationSchema.parse({
    score: clamp(r.score, 100),
    historyScore: clamp(r.historyScore, 30),
    physicalScore: clamp(r.physicalScore, 15),
    examsScore: clamp(r.examsScore, 15),
    reasoningScore: clamp(r.reasoningScore, 40),
    strengths: Array.isArray(r.strengths) ? r.strengths.slice(0, 8) : [],
    gaps: Array.isArray(r.gaps) ? r.gaps.slice(0, 8) : [],
    examLearning: Array.isArray(r.examLearning) ? r.examLearning.slice(0, 8) : [],
    feedback: typeof r.feedback === "string" ? r.feedback.slice(0, 1200) : "",
  });
}

async function revertToActive(service: ReturnType<typeof createServiceClient>, sessionId: string) {
  await service.from("patient_sessions").update({ status: "active" }).eq("id", sessionId);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

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
    return Response.json({ error: "Preencha hipótese e conduta para finalizar.", code: "MISSING_FIELDS" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("patient_sessions")
    .select("id, case_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return Response.json({ error: "Sessão inválida.", code: "SESSION_NOT_FOUND" }, { status: 404 });
  if (session.status === "finished") {
    return Response.json({ error: "Este atendimento já foi finalizado.", code: "ALREADY_FINISHED" }, { status: 409 });
  }
  if (session.status !== "active") {
    return Response.json({ error: "Sessão inválida ou já encerrada.", code: "SESSION_NOT_ACTIVE" }, { status: 404 });
  }

  const service = createServiceClient();

  // Trava atômica contra clique duplo / requisições concorrentes: só quem
  // conseguir mudar active -> evaluating segue em frente.
  let claimed = (
    await service
      .from("patient_sessions")
      .update({ status: "evaluating" })
      .eq("id", sessionId)
      .eq("status", "active")
      .select("id")
      .maybeSingle()
  ).data;

  if (!claimed) {
    // A trava pode ficar presa em "evaluating" se a função serverless for
    // encerrada por timeout antes de reverter (ex.: Gemini demorando demais).
    // Nesse caso, e só nesse caso, uma trava "evaluating" há mais de 2
    // minutos é considerada órfã e pode ser reivindicada de novo — sem isso
    // o estudante ficaria permanentemente impedido de finalizar.
    const { data: current } = await service
      .from("patient_sessions")
      .select("status, updated_at")
      .eq("id", sessionId)
      .single();
    const staleMs = current?.updated_at ? Date.now() - new Date(current.updated_at).getTime() : 0;
    if (current?.status === "evaluating" && staleMs > 2 * 60 * 1000) {
      claimed = (
        await service
          .from("patient_sessions")
          .update({ status: "evaluating" })
          .eq("id", sessionId)
          .eq("status", "evaluating")
          .select("id")
          .maybeSingle()
      ).data;
    }
  }
  if (!claimed) {
    return Response.json({ error: "Este atendimento já está sendo avaliado.", code: "ALREADY_EVALUATING" }, { status: 409 });
  }

  const [{ data: caseRow }, { data: caseDetails }, { data: historyRows }] = await Promise.all([
    service.from("patient_cases").select("specialty, title").eq("id", session.case_id).single(),
    service.from("patient_case_details").select("hidden_case").eq("case_id", session.case_id).single(),
    service.from("patient_messages").select("role, content").eq("session_id", sessionId).order("created_at", { ascending: true }),
  ]);
  if (!caseDetails || !caseRow) {
    await revertToActive(service, sessionId);
    console.error("[patient/finish] etapa=carregar_caso status=error", { sessionId, code: "CASE_NOT_FOUND" });
    return Response.json({ error: "Caso clínico indisponível.", code: "CASE_NOT_FOUND" }, { status: 500 });
  }
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
    "Responda APENAS com um objeto JSON válido, sem markdown, sem cercas de código, no formato exato:",
    '{"score":0-100,"historyScore":0-30,"physicalScore":0-15,"examsScore":0-15,"reasoningScore":0-40,"strengths":["..."],"gaps":["..."],"examLearning":["..."],"feedback":"texto curto em português"}',
    "score deve ser a soma dos quatro sub-escores. Seja justo e educativo, em português do Brasil.",
  ].join("\n");

  // ── Etapa 1: chamada ao Gemini ────────────────────────────────
  let rawText: string;
  try {
    const ai = getGeminiClient();
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: evalPrompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 900 },
    });
    rawText = result.text ?? "";
    if (!rawText.trim()) {
      throw Object.assign(new Error("Resposta vazia do Gemini"), {
        finishReason: result.candidates?.[0]?.finishReason ?? null,
      });
    }
  } catch (err) {
    const errObj = err as { message?: string; status?: number; code?: string | number; finishReason?: string } | undefined;
    console.error("[patient/finish] etapa=chamada_gemini status=error", {
      sessionId,
      status: errObj?.status ?? null,
      code: errObj?.code ?? null,
      finishReason: errObj?.finishReason ?? null,
      message: errObj?.message ?? String(err),
      model: GEMINI_MODEL,
      geminiApiKeyPresent: Boolean(process.env.GEMINI_API_KEY),
    });
    await revertToActive(service, sessionId);
    return Response.json({ error: "Não foi possível avaliar o atendimento agora. Tente novamente.", code: "GEMINI_ERROR" }, { status: 502 });
  }

  // ── Etapa 2 e 3: parsing do JSON + validação Zod (com 1 tentativa de reparo) ──
  let evaluation: Evaluation;
  try {
    const cleaned = stripCodeFences(rawText);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      // 1 tentativa de reparo: pede ao próprio Gemini para corrigir o JSON,
      // sem alterar os valores.
      console.error("[patient/finish] etapa=parse_json status=malformed_retry_repair", { sessionId, length: cleaned.length });
      const ai = getGeminiClient();
      const repair = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [{ text: `Corrija o texto abaixo para ser um JSON válido, mantendo exatamente os mesmos valores e chaves, sem markdown:\n\n${cleaned}` }] }],
        config: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 900 },
      });
      parsedJson = JSON.parse(stripCodeFences(repair.text ?? "{}"));
    }
    evaluation = normalizeEvaluation(parsedJson);
  } catch (err) {
    console.error("[patient/finish] etapa=parse_ou_validacao status=error", {
      sessionId,
      message: err instanceof Error ? err.message : String(err),
      rawLength: rawText.length,
    });
    await revertToActive(service, sessionId);
    return Response.json({ error: "A avaliação retornou em formato inválido. Tente novamente.", code: "INVALID_AI_RESPONSE" }, { status: 502 });
  }

  // ── Etapa 4: marca a sessão como concluída (feita ANTES do XP: garante
  // que uma falha na gravação do attempt não deixe a sessão "solta" nem
  // permita reenvio que duplicaria o XP já concedido) ──────────────
  const { error: sessionUpdateError } = await service
    .from("patient_sessions")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      score: evaluation.score,
      xp_awarded: evaluation.score,
      feedback: { evaluation, submission: { hypothesis, differentials, conduct } },
    })
    .eq("id", sessionId)
    .eq("status", "evaluating");
  if (sessionUpdateError) {
    console.error("[patient/finish] etapa=atualizar_sessao status=error", { sessionId, message: sessionUpdateError.message });
    await revertToActive(service, sessionId);
    return Response.json({ error: "Não foi possível salvar o resultado do atendimento.", code: "SESSION_UPDATE_ERROR" }, { status: 500 });
  }

  // ── Etapa 5: concede XP (só depois que a sessão já está marcada como
  // concluída — se isto falhar, a sessão permanece "finished" e não pode
  // ser reenviada, evitando XP duplicado; fica registrado para conciliação) ──
  const { error: attemptError } = await service.from("patient_attempts").insert({
    user_id: user.id,
    topic: caseRow.specialty,
    score: evaluation.score,
    history_score: evaluation.historyScore,
    physical_score: evaluation.physicalScore,
    exams_score: evaluation.examsScore,
    reasoning_score: evaluation.reasoningScore,
  });
  if (attemptError) {
    console.error("[patient/finish] etapa=conceder_xp status=error", { sessionId, message: attemptError.message });
    return Response.json(
      { error: "Avaliação salva, mas houve um problema ao conceder o XP.", code: "ATTEMPT_INSERT_ERROR" },
      { status: 500 },
    );
  }

  return Response.json({ ...evaluation, correctDiagnosis: hidden.diagnosis });
}
