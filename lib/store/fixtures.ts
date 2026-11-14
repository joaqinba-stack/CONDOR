import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProductImage, ProductKind, Video } from "../types";

/**
 * Catálogo del modo demo (sin base de datos). Los archivos viven en `public/demo/`.
 * Títulos, descripciones y precios son marcadores: en el sitio real se cargan desde /admin.
 */
interface DemoItem {
  slug: string;
  kind: ProductKind;
  title: string;
  title_en: string;
  description: string;
  usd: number;
  width: number;
  height: number;
  duration?: number;
  cover: string;
  trailer?: string;
  /** Video completo que se reproduce en modo demo. */
  full?: string;
  photos?: { file: string; width: number; height: number }[];
}

const items: DemoItem[] = [
  {
    slug: "jardin",
    kind: "fotos",
    title: "Jardín",
    title_en: "Garden",
    description: "Pack de dos fotos en alta resolución.",
    usd: 15,
    width: 1440,
    height: 1440,
    cover: "foto-1-cover.jpg",
    photos: [
      { file: "foto-1.jpg", width: 1440, height: 1440 },
      { file: "foto-2.jpg", width: 1200, height: 1600 },
    ],
  },
  {
    slug: "tu-algoritmo",
    kind: "video",
    title: "Tu algoritmo",
    title_en: "Your algorithm",
    description: "Video vertical completo, en alta calidad.",
    usd: 12,
    width: 720,
    height: 1280,
    duration: 10,
    cover: "video-1.jpg",
    trailer: "video-1-trailer.mp4",
    full: "video-1.mp4",
  },
  {
    slug: "domingo",
    kind: "video",
    title: "Domingo",
    title_en: "Sunday",
    description: "Video vertical completo, plano cercano.",
    usd: 10,
    width: 720,
    height: 1280,
    duration: 14,
    cover: "video-2.jpg",
    trailer: "video-2-trailer.mp4",
    full: "video-2.mp4",
  },
  {
    slug: "retrato",
    kind: "fotos",
    title: "Retrato",
    title_en: "Portrait",
    description: "Una foto en alta resolución.",
    usd: 6,
    width: 1200,
    height: 1600,
    cover: "foto-3-cover.jpg",
    photos: [{ file: "foto-3.jpg", width: 1200, height: 1600 }],
  },
  {
    slug: "gimnasio",
    kind: "fotos",
    title: "Gimnasio",
    title_en: "Gym",
    description: "Una foto en alta resolución.",
    usd: 6,
    width: 1206,
    height: 1600,
    cover: "foto-4-cover.jpg",
    photos: [{ file: "foto-4.jpg", width: 1206, height: 1600 }],
  },
];

export const DEMO_RATE = 1450;
export const DEMO_AVATAR = "/demo/avatar.jpg";

const id = (i: number) => `00000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`;

const baseVideos: Video[] = items.map((it, i) => ({
  id: id(i),
  kind: it.kind,
  image_count: it.photos?.length ?? 0,
  slug: it.slug,
  title: it.title,
  description: it.description,
  title_en: it.title_en,
  description_en: null,
  price_usd_cents: it.usd * 100,
  price_ars_cents: it.usd * DEMO_RATE * 100,
  bunny_video_id: null,
  trailer_video_id: null,
  trailer_url: it.trailer ? `/demo/${it.trailer}` : null,
  cover_url: `/demo/${it.cover}`,
  width: it.width,
  height: it.height,
  duration_seconds: it.duration ?? 0,
  status: "publicado",
  publish_when_ready: true,
  tags: [],
  manyvids_id: null,
  created_at: new Date(Date.UTC(2026, 10, 14 - i)).toISOString(),
}));

/**
 * Catálogo importado de ManyVids (si existe): importar/out/catalogo.json + medios copiados a
 * public/demo/mv/<id>/ por importar/medios.mjs. Solo se usa en modo demo; nada de esto se versiona.
 */
interface CatalogItem {
  manyvids_id: string;
  slug: string | null;
  titulo: string;
  descripcion: string;
  etiquetas: string[];
  duracion_segundos: number | null;
  ancho: number | null;
  alto: number | null;
  fecha_publicacion: string | null;
  precio_usd: number;
  precio_ars: number;
}

function loadCatalog(): { videos: Video[]; full: Record<string, string> } {
  const root = process.cwd();
  const file = path.join(root, "importar", "out", "catalogo.json");
  if (!existsSync(file)) return { videos: [], full: {} };
  let productos: CatalogItem[] = [];
  try {
    productos = JSON.parse(readFileSync(file, "utf8")).productos ?? [];
  } catch {
    return { videos: [], full: {} };
  }
  const media = (id: string, f: string) => path.join(root, "public", "demo", "mv", id, f);
  const ready = productos.filter((p) => ["cover.jpg", "trailer.mp4", "preview.mp4"].every((f) => existsSync(media(p.manyvids_id, f))));
  const used = new Set(items.map((it) => it.slug));
  const full: Record<string, string> = {};
  const videos = ready.map((p, i): Video => {
    let slug = (p.slug || `video-${p.manyvids_id}`).slice(0, 80);
    if (used.has(slug)) slug = `${slug}-${p.manyvids_id}`;
    used.add(slug);
    full[slug] = `/demo/mv/${p.manyvids_id}/preview.mp4`;
    return {
      id: `00000000-0000-4000-9000-${p.manyvids_id.padStart(12, "0")}`,
      kind: "video",
      image_count: 0,
      slug,
      title: p.titulo,
      description: p.descripcion,
      title_en: null,
      description_en: null,
      price_usd_cents: Math.round(p.precio_usd * 100),
      price_ars_cents: Math.round(p.precio_ars * 100),
      bunny_video_id: null,
      trailer_video_id: null,
      trailer_url: `/demo/mv/${p.manyvids_id}/trailer.mp4`,
      cover_url: `/demo/mv/${p.manyvids_id}/cover.jpg`,
      width: p.ancho || 16,
      height: p.alto || 9,
      duration_seconds: p.duracion_segundos ?? 0,
      status: "publicado",
      publish_when_ready: true,
      tags: p.etiquetas ?? [],
      manyvids_id: p.manyvids_id,
      created_at: p.fecha_publicacion ?? new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    };
  });
  return { videos, full };
}

const catalog = loadCatalog();

/**
 * Con catálogo importado: sus videos + los productos de fotos de ejemplo.
 * Sin catálogo: el catálogo de ejemplo original.
 */
export const demoVideos: Video[] = catalog.videos.length
  ? [...catalog.videos, ...baseVideos.filter((v) => v.kind === "fotos")].sort((a, b) => b.created_at.localeCompare(a.created_at))
  : baseVideos;

/** En modo demo la "ruta" de cada foto es directamente su URL pública. */
export const demoImages: ProductImage[] = items.flatMap((it, i) =>
  (it.photos ?? []).map((p, n) => ({
    id: `${id(i)}-${n}`,
    video_id: id(i),
    path: `/demo/${p.file}`,
    width: p.width,
    height: p.height,
    position: n,
  })),
);

/** Video completo de cada producto de video del modo demo. */
export const demoFullVideo: Record<string, string> = {
  ...Object.fromEntries(items.filter((it) => it.full).map((it) => [it.slug, `/demo/${it.full}`])),
  ...catalog.full,
};
