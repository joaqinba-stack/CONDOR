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

export const demoVideos: Video[] = items.map((it, i) => ({
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
  created_at: new Date(Date.UTC(2026, 10, 14 - i)).toISOString(),
}));

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
export const demoFullVideo: Record<string, string> = Object.fromEntries(
  items.filter((it) => it.full).map((it) => [it.slug, `/demo/${it.full}`]),
);
