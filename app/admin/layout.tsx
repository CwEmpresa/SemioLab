import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  // Não-admin: 404, nunca uma tela de "acesso negado" que revele que a
  // rota existe.
  if (!admin) notFound();
  return <>{children}</>;
}
