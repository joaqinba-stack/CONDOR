import { NextResponse, type NextRequest } from "next/server";
import { createPhotoUpload, photosEnabled } from "@/lib/photos";
import { getSessionEmail, isAdminEmail } from "@/lib/session";
import { getStore } from "@/lib/store";

/**
 * Prepara la subida de una foto: devuelve una URL firmada de un solo uso para que el navegador
 * del admin la suba directo al bucket privado (sin pasar por este servidor).
 */
export async function POST(req: NextRequest) {
  if (!isAdminEmail(await getSessionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!photosEnabled()) {
    return NextResponse.json({ error: "La subida de fotos necesita la base de datos configurada (ver README)." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { videoId?: string; contentType?: string };
  const video = body.videoId ? await getStore().getVideoById(body.videoId) : null;
  if (!video || video.kind !== "fotos") return NextResponse.json({ error: "No se encontró el producto" }, { status: 404 });

  try {
    return NextResponse.json(await createPhotoUpload(video.id, String(body.contentType ?? "")));
  } catch (err) {
    console.error("[photo-ticket]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo preparar la subida" }, { status: 400 });
  }
}
