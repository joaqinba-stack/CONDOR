"use server";

import { revalidatePath } from "next/cache";
import { deleteBunnyVideo } from "@/lib/bunny";
import { bunnyEnabled, bunnyTrailersEnabled, env } from "@/lib/env";
import { isEmail, normalizeEmail, slugify } from "@/lib/format";
import { deletePhotoFiles } from "@/lib/photos";
import { requireAdmin } from "@/lib/session";
import { getStore } from "@/lib/store";
import { SupabaseStore } from "@/lib/store/supabase";
import { syncVideoFromBunny } from "@/lib/sync";

/** "Twerk, Outdoors ,twerk" → ["Twerk", "Outdoors"] (sin repetidas, máx. 30). */
function parseTags(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(",")) {
    const t = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.slice(0, 30);
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const toCents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};
const usdToCents = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function uploadCover(videoId: string, file: File): Promise<string | null> {
  const ext = COVER_TYPES[file.type];
  if (!ext) throw new Error("La portada tiene que ser JPG, PNG o WebP.");
  if (file.size > 4 * 1024 * 1024) throw new Error("La portada no puede pesar más de 4 MB.");
  const store = getStore();
  if (!(store instanceof SupabaseStore)) return null; // modo demo: no hay dónde guardarla
  const path = `${videoId}-${Date.now()}.${ext}`;
  const up = await store.client.storage
    .from("covers")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" });
  if (up.error) throw new Error(`No se pudo subir la portada: ${up.error.message}`);
  return store.client.storage.from("covers").getPublicUrl(path).data.publicUrl;
}

/** Crea o actualiza la ficha de un video (los archivos de video se suben aparte, directo a Bunny). */
export async function saveVideo(form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const store = getStore();
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const usd = usdToCents(form.get("price_usd"));
  const ars = toCents(form.get("price_ars"));
  if (!title) return { ok: false, error: "Falta el título." };
  if (Number.isNaN(usd) || Number.isNaN(ars)) return { ok: false, error: "Revisá los precios." };

  const fields = {
    title: title.slice(0, 140),
    description: String(form.get("description") ?? "").trim().slice(0, 5000),
    title_en: String(form.get("title_en") ?? "").trim().slice(0, 140) || null,
    description_en: String(form.get("description_en") ?? "").trim().slice(0, 5000) || null,
    price_usd_cents: usd,
    price_ars_cents: ars,
    publish_when_ready: form.get("publish_when_ready") === "on",
    tags: parseTags(String(form.get("tags") ?? "")),
  };

  try {
    let video;
    if (id) {
      video = await store.updateVideo(id, fields);
      if (!video) return { ok: false, error: "No se encontró el video." };
    } else {
      let slug = slugify(title);
      for (let i = 2; await store.getVideoBySlug(slug); i++) slug = `${slugify(title)}-${i}`;
      const kind = form.get("kind") === "fotos" ? "fotos" : "video";
      const w = Number(form.get("width"));
      const h = Number(form.get("height"));
      video = await store.createVideo({
        ...fields,
        manyvids_id: null,
        kind,
        image_count: 0,
        slug,
        bunny_video_id: null,
        trailer_video_id: null,
        trailer_url: null,
        cover_url: null,
        width: kind === "fotos" && w > 0 ? Math.round(w) : 16,
        height: kind === "fotos" && h > 0 ? Math.round(h) : 9,
        duration_seconds: 0,
        status: "borrador",
      });
    }
    const cover = form.get("cover");
    if (cover instanceof File && cover.size > 0) {
      const url = await uploadCover(video.id, cover);
      if (url) await store.updateVideo(video.id, { cover_url: url });
    }
    revalidatePath("/admin");
    return { ok: true, id: video.id };
  } catch (err) {
    console.error("[admin saveVideo]", err);
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo guardar." };
  }
}

export async function setVideoStatus(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get("id"));
  const status = form.get("status") === "publicado" ? "publicado" : "borrador";
  const store = getStore();
  const video = await store.getVideoById(id);
  if (!video) return;
  // No se publica algo que el comprador no podría ver.
  const hasContent = video.kind === "fotos" ? video.image_count > 0 : !!video.bunny_video_id;
  if (status === "publicado" && !hasContent && !env.isDemo) return;
  await store.updateVideo(id, { status });
  revalidatePath("/admin");
}

export async function refreshVideo(form: FormData): Promise<void> {
  await requireAdmin();
  const video = await getStore().getVideoById(String(form.get("id")));
  if (video) await syncVideoFromBunny(video);
  revalidatePath("/admin");
}

export async function removeVideo(form: FormData): Promise<void> {
  await requireAdmin();
  const store = getStore();
  const video = await store.getVideoById(String(form.get("id")));
  if (!video) return;
  const photoPaths = (await store.listImages(video.id)).map((i) => i.path);
  try {
    await store.deleteVideo(video.id);
  } catch {
    // Tiene ventas: no se borra (los compradores perderían el acceso). Se despublica.
    await store.updateVideo(video.id, { status: "borrador" });
    revalidatePath("/admin");
    return;
  }
  try {
    if (video.bunny_video_id && bunnyEnabled()) await deleteBunnyVideo("full", video.bunny_video_id);
    if (video.trailer_video_id && bunnyTrailersEnabled()) await deleteBunnyVideo("trailer", video.trailer_video_id);
    await deletePhotoFiles(photoPaths);
  } catch (err) {
    console.error("[admin removeVideo]", err);
  }
  revalidatePath("/admin");
}

/** Registra una foto que el navegador ya subió al bucket privado. */
export async function registerPhoto(videoId: string, path: string, width: number, height: number): Promise<ActionResult> {
  await requireAdmin();
  const store = getStore();
  const video = await store.getVideoById(videoId);
  if (!video || video.kind !== "fotos") return { ok: false, error: "No se encontró el producto." };
  // La ruta tiene que ser la que entregó /api/admin/photo-ticket para este producto.
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path) || !path.startsWith(`${video.id}/`)) {
    return { ok: false, error: "Ruta de foto inválida." };
  }
  if (!(width > 0 && height > 0 && width < 30000 && height < 30000)) return { ok: false, error: "Foto inválida." };
  await store.addImage(video.id, { path, width: Math.round(width), height: Math.round(height) });
  if (video.image_count === 0) await store.updateVideo(video.id, { width: Math.round(width), height: Math.round(height) });
  return { ok: true, id: video.id };
}

/** Al terminar de subir las fotos: publica el producto si corresponde. */
export async function finishPhotos(videoId: string): Promise<ActionResult> {
  await requireAdmin();
  const store = getStore();
  const video = await store.getVideoById(videoId);
  if (!video || video.kind !== "fotos") return { ok: false, error: "No se encontró el producto." };
  if (video.status === "borrador" && video.publish_when_ready && video.image_count > 0 && video.cover_url) {
    await store.updateVideo(video.id, { status: "publicado" });
  }
  revalidatePath("/admin");
  return { ok: true, id: video.id };
}

export async function removePhoto(form: FormData): Promise<void> {
  await requireAdmin();
  const store = getStore();
  const removed = await store.removeImage(String(form.get("image_id")));
  if (!removed) return;
  await deletePhotoFiles([removed.path]);
  const video = await store.getVideoById(removed.video_id);
  // Sin fotos no puede seguir a la venta.
  if (video && video.image_count === 0 && video.status === "publicado") {
    await store.updateVideo(video.id, { status: "borrador" });
  }
  revalidatePath("/admin");
}

export async function grantAccess(form: FormData): Promise<void> {
  await requireAdmin();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const videoId = String(form.get("video_id") ?? "");
  if (!isEmail(email) || !videoId) return;
  await getStore().grantEntitlement(email, videoId, null);
  revalidatePath("/admin/ventas");
}

export async function saveRate(form: FormData): Promise<void> {
  await requireAdmin();
  const rate = Number(String(form.get("rate") ?? "").replace(",", "."));
  if (!Number.isFinite(rate) || rate <= 0) return;
  await getStore().setSetting("usd_ars_rate", String(rate));
  revalidatePath("/admin/ajustes");
}
