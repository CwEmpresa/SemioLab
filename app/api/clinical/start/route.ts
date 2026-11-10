import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { toPublicCase } from "@/lib/clinical-cases";
import { CASES_PER_SIMULADO, appendSeen, generateNewCases, loadAllCases, pickCases, readSeenHistory } from "@/lib/clinical-simulado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sorteia os 3 casos do Simulado clínico deste aluno, priorizando os que
 * ele nunca viu. O histórico do que já foi visto fica nos metadados da
 * conta (vale em qualquer aparelho). Quando os inéditos estão acabando,
 * gera casos novos em segundo plano para a próxima rodada. */
export async function POST() {
  const supabase = await createClient();
  // getUser (e não só o JWT): precisa dos metadados mais recentes, que o
  // token só reflete depois de renovado.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();
  const { cases: all, tableAvailable } = await loadAllCases(service);
  const seen = readSeenHistory(user.user_metadata);
  const chosen = pickCases(all, seen);
  const nextSeen = appendSeen(seen, chosen.map((c) => c.id));

  const { error: updateError } = await supabase.auth.updateUser({ data: { clinical_seen: nextSeen } });
  if (updateError) console.error("[clinical/start] falha ao salvar histórico", updateError.message);

  const unseenLeft = all.filter((c) => !nextSeen.includes(c.id)).length;
  if (tableAvailable && unseenLeft < CASES_PER_SIMULADO * 2) {
    after(() => generateNewCases(service, all).then(() => undefined));
  }

  return Response.json({ cases: chosen.map(toPublicCase), durationSeconds: 15 * 60 });
}
