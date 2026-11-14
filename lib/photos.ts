import { randomUUID } from "node:crypto";
import { env } from "./env";
import { getStore } from "./store";
import { SupabaseStore } from "./store/supabase";
import type { ProductImage } from "./types";

const BUCKET = "fotos";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface SignedPhoto {
  id: string;
  url: string;
  width: number;
  height: number;
}

/**
 * URLs para mostrar las fotos de un producto a quien lo compró.
 * Producción: URLs firmadas del bucket privado, válidas por poco tiempo.
 * Modo demo: los archivos de `public/demo/`.
 * Quien llama tiene que haber comprobado antes el acceso (ver lib/access.ts).
 */
export async function signPhotos(images: ProductImage[], ttlSeconds = 2 * 3600): Promise<SignedPhoto[]> {
  if (images.length === 0) return [];
  const store = getStore();
  if (!(store instanceof SupabaseStore)) {
    return images.map((i) => ({ id: i.id, url: i.path, width: i.width, height: i.height }));
  }
  const { data, error } = await store.client.storage.from(BUCKET).createSignedUrls(
    images.map((i) => i.path),
    ttlSeconds,
  );
  if (error) throw new Error(`No se pudieron firmar las fotos: ${error.message}`);
  return images.flatMap((img, n) => {
    const url = data?.[n]?.signedUrl;
    return url ? [{ id: img.id, url, width: img.width, height: img.height }] : [];
  });
}

export const photosEnabled = () => !env.isDemo;

/** Permiso de un solo uso para que el navegador del admin suba una foto directo al bucket privado. */
export async function createPhotoUpload(videoId: string, contentType: string): Promise<{ path: string; url: string }> {
  const ext = TYPES[contentType];
  if (!ext) throw new Error("Las fotos tienen que ser JPG, PNG o WebP.");
  const store = getStore();
  if (!(store instanceof SupabaseStore)) throw new Error("La subida de fotos necesita la base de datos configurada.");
  const path = `${videoId}/${randomUUID()}.${ext}`;
  const { data, error } = await store.client.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`No se pudo preparar la subida: ${error?.message ?? "sin respuesta"}`);
  return { path, url: data.signedUrl };
}

export async function deletePhotoFiles(paths: string[]): Promise<void> {
  const store = getStore();
  if (paths.length === 0 || !(store instanceof SupabaseStore)) return;
  await store.client.storage.from(BUCKET).remove(paths);
}
