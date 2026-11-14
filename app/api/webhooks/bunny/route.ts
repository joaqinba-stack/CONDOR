import { NextResponse, type NextRequest } from "next/server";
import { verifyBunnyWebhook } from "@/lib/bunny";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";
import { syncVideoFromBunny } from "@/lib/sync";

/** Aviso de Bunny: un video terminó de procesarse (o falló). */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: { VideoLibraryId?: number | string; VideoGuid?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const libraryId = String(body.VideoLibraryId ?? "");
  const guid = body.VideoGuid ?? "";

  const key =
    libraryId === env.bunnyLibraryId
      ? env.bunnyReadOnlyKey
      : libraryId === env.bunnyTrailerLibraryId
        ? env.bunnyTrailerReadOnlyKey
        : null;
  if (key === null) return NextResponse.json({ ok: false }, { status: 400 });
  // Con la Read-Only key configurada se exige la firma. Sin ella igual es seguro:
  // el aviso solo dispara una consulta a la API de Bunny, que es la fuente de verdad.
  if (key && !verifyBunnyWebhook(raw, req.headers.get("x-bunnystream-signature"), key)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(guid)) return NextResponse.json({ ok: true });
  try {
    const video = await getStore().getVideoByBunnyId(guid);
    if (video) await syncVideoFromBunny(video);
  } catch (err) {
    console.error("[bunny webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
