import { NextResponse, type NextRequest } from "next/server";
import { createBunnyVideo, deleteBunnyVideo, signUpload } from "@/lib/bunny";
import { bunnyEnabled, bunnyTrailersEnabled } from "@/lib/env";
import { getSessionEmail, isAdminEmail } from "@/lib/session";
import { getStore } from "@/lib/store";

/**
 * Prepara la subida de un archivo de video: crea el video en Bunny y devuelve credenciales
 * firmadas, válidas solo para ese video, para que el navegador suba directo (sin pasar por
 * este servidor y sin exponer la API key).
 */
export async function POST(req: NextRequest) {
  if (!isAdminEmail(await getSessionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { videoId?: string; kind?: string };
  const kind = body.kind === "trailer" ? "trailer" : "full";
  if (kind === "full" ? !bunnyEnabled() : !bunnyTrailersEnabled()) {
    return NextResponse.json({ error: "Bunny no está configurado todavía (ver README)." }, { status: 503 });
  }

  const store = getStore();
  const video = body.videoId ? await store.getVideoById(body.videoId) : null;
  if (!video) return NextResponse.json({ error: "No se encontró el video" }, { status: 404 });

  try {
    const previous = kind === "full" ? video.bunny_video_id : video.trailer_video_id;
    const guid = await createBunnyVideo(kind, kind === "full" ? video.title : `${video.title} (tráiler)`);
    await store.updateVideo(
      video.id,
      kind === "full"
        ? { bunny_video_id: guid, status: "procesando" }
        : { trailer_video_id: guid, trailer_url: null, status: video.status === "publicado" ? "publicado" : "procesando" },
    );
    if (previous) await deleteBunnyVideo(kind, previous).catch(() => {});
    return NextResponse.json(signUpload(kind, guid));
  } catch (err) {
    console.error("[upload-ticket]", err);
    return NextResponse.json({ error: "No se pudo preparar la subida" }, { status: 502 });
  }
}
