import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  return Response.json({ isAdmin: !!admin }, { headers: { "Cache-Control": "no-store" } });
}
