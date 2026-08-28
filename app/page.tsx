import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "./user-context";
import AppGate from "./app-gate";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AppGate authenticated={false} />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, xp")
    .eq("id", user.id)
    .single();

  const currentUser = {
    id: user.id,
    name: profile?.name || user.email?.split("@")[0] || "Usuário",
    email: profile?.email || user.email || "",
    xp: profile?.xp ?? 0,
  };
  // Perfil incompleto = nunca preencheu o nome de verdade (o fallback pro
  // prefixo do e-mail em currentUser.name é só de exibição, não conta).
  const profileComplete = !!profile?.name?.trim();

  return (
    <UserProvider user={currentUser}>
      <AppGate authenticated={true} profileComplete={profileComplete} />
    </UserProvider>
  );
}
