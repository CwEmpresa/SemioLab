import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Referência do projeto Supabase que este app deve usar. Usada só para
// diagnóstico (log de uma string pública, não sensível) — nunca alteramos
// o valor real de env aqui, apenas conferimos se bate com o esperado.
const EXPECTED_PROJECT_REF = "vlkahuodqveochsiwghw";

function projectRefFromUrl(url: string | undefined): string {
  if (!url) return "(ausente)";
  try {
    return new URL(url).hostname.split(".")[0] || "(host inválido)";
  } catch {
    return "(url inválida)";
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Diagnóstico seguro: confirma se o ambiente do servidor aponta para o
  // projeto Supabase correto. Loga apenas a referência do projeto (dado
  // público, presente na própria URL), nunca a URL completa nem chaves.
  const configuredRef = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (configuredRef !== EXPECTED_PROJECT_REF) {
    console.error("[auth/confirm] project_ref_mismatch", {
      configuredRef,
      expectedRef: EXPECTED_PROJECT_REF,
    });
  }

  if (!token_hash || !type) {
    console.error("[auth/confirm] missing_params", {
      hasTokenHash: Boolean(token_hash),
      type: type ?? null,
    });
    redirect("/auth/error");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  // Log seguro: nunca registra o token, só metadados do resultado.
  console.log("[auth/confirm] verify_otp_result", {
    type,
    hasTokenHash: Boolean(token_hash),
    ok: !error,
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    projectRef: configuredRef,
  });

  if (!error) {
    if (type === "recovery") redirect("/auth/update-password");
    redirect(next);
  }

  redirect("/auth/error");
}
