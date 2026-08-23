import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function sniffImageSignature(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false;
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mime === "image/webp") return bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind"); // "avatar" | "cover"
  if (!(file instanceof Blob) || (kind !== "avatar" && kind !== "cover")) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "Arquivo maior que 2 MB." }, { status: 400 });
  const ext = ALLOWED_MIME[file.type];
  if (!ext) return Response.json({ error: "Formato não suportado. Use JPG, PNG ou WebP." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffImageSignature(bytes, file.type)) {
    return Response.json({ error: "Arquivo de imagem inválido." }, { status: 400 });
  }

  const service = createServiceClient();
  // Caminho sempre dentro da própria pasta do usuário (RLS de storage já
  // trava por (storage.foldername(name))[1] = auth.uid()) — nome fixo por
  // tipo, então um novo upload substitui o anterior (upsert).
  const path = `${user.id}/${kind}.${ext}`;
  const { error: uploadError } = await service.storage.from("avatars").upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadError) return Response.json({ error: "Falha no upload." }, { status: 500 });

  const column = kind === "avatar" ? "avatar_path" : "cover_path";
  await service.from("profiles").update({ [column]: path }).eq("id", user.id);

  const { data: signed } = await service.storage.from("avatars").createSignedUrl(path, 300);
  return Response.json({ ok: true, path, url: signed?.signedUrl ?? null });
}
