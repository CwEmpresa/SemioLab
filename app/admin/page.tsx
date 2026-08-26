import AdminDashboard from "./admin-dashboard";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  return <AdminDashboard adminEmail={admin?.email ?? ""} adminRole={admin?.role ?? "admin"} />;
}
