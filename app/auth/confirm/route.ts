import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Previne open redirect: só aceita caminhos relativos internos, nunca
  // URLs absolutas para domínios externos.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      if (type === "recovery") redirect("/auth/update-password");
      if (type === "signup") {
        // verifyOtp cria uma sessão local automaticamente ao confirmar —
        // encerra essa sessão para forçar o login explícito com
        // e-mail+senha, nunca deixando o usuário "meio autenticado".
        await supabase.auth.signOut();
        redirect("/?confirmed=1");
      }
      redirect(next);
    }
  }

  redirect("/auth/error");
}
