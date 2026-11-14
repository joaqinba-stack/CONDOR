import { hmacHex, safeEqual, sha256Hex } from "./crypto";
import { env } from "./env";

const API = "https://video.bunnycdn.com";
export const TUS_ENDPOINT = `${API}/tusupload`;

export type LibraryKind = "full" | "trailer";

function lib(kind: LibraryKind) {
  const id = kind === "full" ? env.bunnyLibraryId : env.bunnyTrailerLibraryId;
  const key = kind === "full" ? env.bunnyApiKey : env.bunnyTrailerApiKey;
  if (!id || !key) throw new Error(`Bunny no está configurado (biblioteca ${kind})`);
  return { id, key };
}

/** Crea el "contenedor" del video en Bunny; devuelve su id (guid). */
export async function createBunnyVideo(kind: LibraryKind, title: string): Promise<string> {
  const { id, key } = lib(kind);
  const res = await fetch(`${API}/library/${id}/videos`, {
    method: "POST",
    headers: { AccessKey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny: no se pudo crear el video (${res.status})`);
  return ((await res.json()) as { guid: string }).guid;
}

export interface UploadTicket {
  endpoint: string;
  headers: Record<string, string>;
}

/**
 * Credenciales de un solo video para que el navegador suba directo a Bunny (TUS),
 * sin exponer la API key. Firma: SHA256(library_id + api_key + expiration + video_id).
 */
export function signUpload(kind: LibraryKind, videoId: string, nowSec = Math.floor(Date.now() / 1000)): UploadTicket {
  const { id, key } = lib(kind);
  const expire = nowSec + 6 * 3600;
  return {
    endpoint: TUS_ENDPOINT,
    headers: {
      AuthorizationSignature: sha256Hex(`${id}${key}${expire}${videoId}`),
      AuthorizationExpire: String(expire),
      VideoId: videoId,
      LibraryId: id,
    },
  };
}

export interface BunnyVideoInfo {
  guid: string;
  /** 4 = terminado, 5 = error, 6 = falló la subida. */
  status: number;
  width: number;
  height: number;
  length: number;
  availableResolutions: string | null;
  hasMP4Fallback?: boolean;
  encodeProgress?: number;
}

/**
 * (Servidor) Sube a un video ya creado en Bunny el contenido de un archivo remoto.
 * Se usa al importar adelantos públicos: Bunny "traer desde URL" no devuelve el ID del video,
 * así que se crea primero (createBunnyVideo) y se sube acá.
 */
export async function uploadBunnyFromUrl(
  kind: LibraryKind,
  videoId: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<void> {
  const { id, key } = lib(kind);
  const src = await fetch(url, { headers });
  if (!src.ok || !src.body) throw new Error(`No se pudo bajar ${url} (${src.status})`);
  const body = Buffer.from(await src.arrayBuffer());
  const res = await fetch(`${API}/library/${id}/videos/${videoId}`, {
    method: "PUT",
    headers: { AccessKey: key, "Content-Type": "application/octet-stream" },
    body,
  });
  if (!res.ok) throw new Error(`Bunny: no se pudo subir el video (${res.status})`);
}

export async function getBunnyVideo(kind: LibraryKind, videoId: string): Promise<BunnyVideoInfo | null> {
  const { id, key } = lib(kind);
  const res = await fetch(`${API}/library/${id}/videos/${videoId}`, {
    headers: { AccessKey: key },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Bunny: no se pudo consultar el video (${res.status})`);
  return (await res.json()) as BunnyVideoInfo;
}

export async function deleteBunnyVideo(kind: LibraryKind, videoId: string): Promise<void> {
  const { id, key } = lib(kind);
  await fetch(`${API}/library/${id}/videos/${videoId}`, { method: "DELETE", headers: { AccessKey: key } });
}

/**
 * URL del reproductor para un comprador: firmada y con vencimiento corto.
 * token = SHA256_HEX(token_security_key + video_id + expiration)
 */
export function signedEmbedUrl(videoId: string, ttlSeconds = 4 * 3600, nowSec = Math.floor(Date.now() / 1000)): string {
  if (!env.bunnyLibraryId || !env.bunnyTokenKey) throw new Error("Bunny no está configurado");
  const expires = nowSec + ttlSeconds;
  const token = sha256Hex(`${env.bunnyTokenKey}${videoId}${expires}`);
  return `https://player.mediadelivery.net/embed/${env.bunnyLibraryId}/${videoId}?token=${token}&expires=${expires}&autoplay=false&preload=true`;
}

/** URLs públicas del tráiler (biblioteca sin protección). */
export function trailerUrls(videoId: string, info: Pick<BunnyVideoInfo, "availableResolutions" | "hasMP4Fallback">) {
  const host = env.bunnyTrailerCdnHost;
  if (!host) return { cover: null, mp4: null };
  const base = `https://${host}/${videoId}`;
  const available = (info.availableResolutions ?? "").split(",").map((s) => s.trim());
  // Los MP4 solo existen si "MP4 fallback" estaba activado al subir.
  const pick = ["720p", "360p", "240p"].find((r) => available.includes(r));
  const mp4 = info.hasMP4Fallback !== false && pick ? `${base}/play_${pick}.mp4` : null;
  return { cover: `${base}/thumbnail.jpg`, mp4 };
}

/** Firma del webhook de Bunny: HMAC-SHA256 del cuerpo con la Read-Only API key de la biblioteca. */
export function verifyBunnyWebhook(rawBody: string, signature: string | null, readOnlyKey: string): boolean {
  if (!signature) return false;
  return safeEqual(hmacHex(readOnlyKey, rawBody), signature.toLowerCase());
}
