import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "./user-context";
import LoginGate from "./login-gate";
import SemioLab from "./semiolab";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <LoginGate />;

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

  return (
    <UserProvider user={currentUser}>
      <SemioLab />
    </UserProvider>
  );
}
