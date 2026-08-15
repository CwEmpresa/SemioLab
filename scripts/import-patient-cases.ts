/**
 * Importa casos clínicos para a simulação de paciente-IA, em lote.
 *
 * Uso:
 *   npx tsx scripts/import-patient-cases.ts data/patient-cases/pilot-20.json
 *   npx tsx scripts/import-patient-cases.ts data/patient-cases/lote-02.json data/patient-cases/lote-03.json
 *
 * Cada arquivo deve ser um JSON array de casos no formato de
 * lib/patient-case-schema.ts (PatientCaseSchema). O script:
 *   1. Valida todos os casos com Zod antes de gravar qualquer coisa.
 *   2. Faz upsert em patient_cases (metadados públicos) por `slug`.
 *   3. Faz upsert em patient_case_details (caso oculto) vinculado ao id gerado.
 *
 * Requer SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL no ambiente
 * (mesmas variáveis usadas pelo servidor Next.js — nunca commitar valores
 * reais). Rode localmente ou em CI, nunca no browser.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PatientCaseBatchSchema } from "../lib/patient-case-schema";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Uso: npx tsx scripts/import-patient-cases.ts <arquivo.json> [outro.json ...]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar.");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let totalImported = 0;
  for (const file of files) {
    console.log(`\n→ Lendo ${file}`);
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    const parsed = PatientCaseBatchSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`✗ Validação falhou em ${file}:`);
      for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exit(1);
    }

    for (const item of parsed.data) {
      const { data: caseRow, error: caseError } = await supabase
        .from("patient_cases")
        .upsert(
          {
            slug: item.slug,
            title: item.title,
            specialty: item.specialty,
            difficulty: item.difficulty,
            opening_line: item.openingLine,
            is_active: item.isActive,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single();

      if (caseError || !caseRow) {
        console.error(`✗ Falha ao gravar caso "${item.slug}": ${caseError?.message}`);
        process.exit(1);
      }

      const { error: detailsError } = await supabase
        .from("patient_case_details")
        .upsert({ case_id: caseRow.id, hidden_case: item.hiddenCase }, { onConflict: "case_id" });

      if (detailsError) {
        console.error(`✗ Falha ao gravar detalhes de "${item.slug}": ${detailsError.message}`);
        process.exit(1);
      }

      console.log(`  ✓ ${item.slug} (${item.specialty} · ${item.difficulty})`);
      totalImported += 1;
    }
  }

  console.log(`\n${totalImported} caso(s) importado(s) com sucesso.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
