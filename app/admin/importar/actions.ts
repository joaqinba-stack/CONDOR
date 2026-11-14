"use server";

import { revalidatePath } from "next/cache";
import { createBunnyVideo, uploadBunnyFromUrl } from "@/lib/bunny";
import { bunnyTrailersEnabled } from "@/lib/env";
import { slugify } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { getStore } from "@/lib/store";
import { SupabaseStore } from "@/lib/store/supabase";

/** Un producto de importar/out/catalogo.json (lo que genera importar/preparar.mjs). */
export interface CatalogItem {
  manyvids_id: string;
  slug?: string | null;
  titulo: string;
  descripcion?: string;
  etiquetas?: string[];
  duracion_segundos?: number | null;
  ancho?: number | null;
  alto?: number | null;
  fecha_publicacion?: string | null;
  precio_usd: number;
  precio_ars: number;
  portada_url?: string | null;
  adelanto_url?: string | null;
}

export interface ImportResult {
  status: "creado" | "ya_estaba" | "error";
  message?: string;
  warnings?: string[];
}

const ORIGIN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; tienda-importador)",
  Referer: "https://www.manyvids.com/",
};
// Solo se aceptan medios de ManyVids (evita que el servidor descargue de cualquier lado).
const ALLOWED_MEDIA = /^https:\/\/([a-z0-9-]+\.)*manyvids\.com\//i;

const cents = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 && v < 100000 ? Math.round(v * 100) : NaN;
};

/**
 * Crea UN producto (como borrador) a partir de un ítem del catálogo. Se llama de a uno desde
 * el navegador para mostrar progreso y no pasarse del tiempo máximo de una request.
 * No repite productos: si ya existe uno con ese ID de ManyVids, no hace nada.
 */
export async function importCatalogItem(item: CatalogItem): Promise<ImportResult> {
  await requireAdmin();
  const store = getStore();

  const id = String(item?.manyvids_id ?? "");
  const title = String(item?.titulo ?? "").trim().slice(0, 140);
  const usd = cents(item?.precio_usd);
  const ars = cents(item?.precio_ars);
  if (!/^\d{1,20}$/.test(id) || !title || Number.isNaN(usd) || Number.isNaN(ars)) {
    return { status: "error", message: "Ítem inválido" };
  }
  if (await store.getVideoByManyvidsId(id)) return { status: "ya_estaba" };

  let slug = slugify(item.slug || title);
  for (let i = 2; await store.getVideoBySlug(slug); i++) slug = `${slugify(item.slug || title)}-${i}`;

  const tags = Array.isArray(item.etiquetas)
    ? [...new Set(item.etiquetas.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))].slice(0, 30)
    : [];
  const width = Number(item.ancho) > 0 ? Math.round(Number(item.ancho)) : 16;
  const height = Number(item.alto) > 0 ? Math.round(Number(item.alto)) : 9;

  const video = await store.createVideo({
    kind: "video",
    image_count: 0,
    slug,
    title,
    description: String(item.descripcion ?? "").slice(0, 5000),
    title_en: null,
    description_en: null,
    price_usd_cents: usd,
    price_ars_cents: ars,
    bunny_video_id: null,
    trailer_video_id: null,
    trailer_url: null,
    cover_url: null,
    width,
    height,
    duration_seconds: Math.max(0, Math.round(Number(item.duracion_segundos) || 0)),
    // Queda en borrador hasta que se suba el video completo (se publica solo al terminar).
    status: "borrador",
    publish_when_ready: true,
    tags,
    manyvids_id: id,
  });

  const warnings: string[] = [];

  // Portada → bucket público "covers".
  if (item.portada_url && ALLOWED_MEDIA.test(item.portada_url) && store instanceof SupabaseStore) {
    try {
      const res = await fetch(item.portada_url, { headers: ORIGIN_HEADERS });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 4 * 1024 * 1024) throw new Error("demasiado grande");
      const path = `${video.id}-${Date.now()}.jpg`;
      const up = await store.client.storage.from("covers").upload(path, buf, { contentType: type, cacheControl: "31536000" });
      if (up.error) throw new Error(up.error.message);
      await store.updateVideo(video.id, { cover_url: store.client.storage.from("covers").getPublicUrl(path).data.publicUrl });
    } catch (err) {
      warnings.push(`portada: ${err instanceof Error ? err.message : "error"}`);
    }
  } else if (item.portada_url) {
    warnings.push("portada: falta la base de datos configurada");
  }

  // Adelanto → biblioteca pública de tráilers en Bunny.
  if (item.adelanto_url && ALLOWED_MEDIA.test(item.adelanto_url) && bunnyTrailersEnabled()) {
    try {
      const guid = await createBunnyVideo("trailer", `${title} (tráiler)`);
      await store.updateVideo(video.id, { trailer_video_id: guid });
      await uploadBunnyFromUrl("trailer", guid, item.adelanto_url, ORIGIN_HEADERS);
    } catch (err) {
      warnings.push(`adelanto: ${err instanceof Error ? err.message : "error"}`);
    }
  } else if (item.adelanto_url) {
    warnings.push("adelanto: falta configurar Bunny (tráilers)");
  }

  revalidatePath("/admin/videos");
  return { status: "creado", warnings };
}
