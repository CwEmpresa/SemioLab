import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I — evita confusão ao digitar/ler em voz alta
const CODE_LENGTH = 7;
const MAX_CODE_ATTEMPTS = 5;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/** Gera e persiste o código de indicação na primeira vez que o usuário abre
 * a tela — nunca no cadastro, porque só quem realmente compartilha precisa
 * de um. Reintenta em caso de colisão (extremamente rara com 7 caracteres
 * de um alfabeto de 32, mas o unique constraint pode rejeitar). */
async function ensureReferralCode(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  existing: string | null,
): Promise<string> {
  if (existing) return existing;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    const { error } = await service.from("profiles").update({ referral_code: code }).eq("id", userId);
    if (!error) return code;
  }
  throw new Error("Não foi possível gerar o código de indicação.");
}

/** Mostra só a inicial do primeiro nome pro indicador — quem indicou não
 * precisa ver o nome/e-mail completo dos amigos indicados. */
function maskName(name: string | null, email: string): string {
  const base = (name || email.split("@")[0] || "Aluno").trim();
  const first = base.split(" ")[0] || "Aluno";
  return first.length > 1 ? `${first[0]}${"*".repeat(first.length - 1)}` : first;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();
  const { data: me } = await service
    .from("profiles")
    .select("referral_code, pro_granted_until")
    .eq("id", user.id)
    .single();
  const code = await ensureReferralCode(service, user.id, me?.referral_code ?? null);

  const [{ data: invitedRows }, { count: grantsCount }] = await Promise.all([
    service
      .from("profiles")
      .select("name, email, created_at, referral_qualified")
      .eq("referred_by", user.id)
      .order("created_at", { ascending: false }),
    service
      .from("referral_grants")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", user.id),
  ]);

  const rows = invitedRows ?? [];
  const qualifiedCount = rows.filter((r) => r.referral_qualified).length;

  return Response.json({
    code,
    shareUrl: `https://semiolab.vercel.app/?ref=${code}`,
    invited: rows.map((r) => ({
      name: maskName(r.name, r.email),
      joinedAt: r.created_at,
      qualified: r.referral_qualified,
    })),
    qualifiedCount,
    progressToNext: qualifiedCount % 3,
    rewardsGranted: grantsCount ?? 0,
    proGrantedUntil: me?.pro_granted_until ?? null,
  });
}
