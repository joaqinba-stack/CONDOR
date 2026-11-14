import type { Video } from "../types";

/** Catálogo de ejemplo para el modo demo (clips abstractos generados, sin derechos de terceros). */
const items: [string, string, string, string, number, number, number, number][] = [
  // slug, título, descripción, título EN, usd, ancho, alto, duración
  ["humo-denso", "Humo denso", "Capas de humo en cámara lenta sobre fondo negro. Ideal para superponer en modo pantalla.", "Dense smoke", 18, 640, 800, 94],
  ["fractal-mono", "Fractal monocromo", "Zoom infinito en blanco y negro para fondos y visuales en vivo.", "Mono fractal", 24, 640, 640, 120],
  ["halo-azul", "Halo azul", "Destellos circulares para intros, títulos y transiciones.", "Blue halo", 12, 640, 360, 45],
  ["trama-110", "Trama 110", "Textura generativa de alto contraste. Loop perfecto.", "Pattern 110", 15, 640, 860, 60],
  ["colonia", "Colonia", "Partículas orgánicas que nacen y mueren. 4K, 60 fps.", "Colony", 20, 640, 480, 75],
  ["espiral-gris", "Espiral gris", "Gradiente en espiral, suave, para fondos de producto.", "Grey spiral", 10, 640, 640, 30],
  ["alfombra", "Alfombra", "Geometría recursiva para visuales y portadas animadas.", "Carpet", 14, 640, 760, 50],
  ["brasas", "Brasas", "Fugas de luz cálidas para dar textura de película.", "Embers", 16, 640, 400, 80],
  ["niebla-clara", "Niebla clara", "Fondo claro y limpio para maquetas de interfaz.", "Light fog", 9, 640, 640, 40],
  ["costa-profunda", "Costa profunda", "Viaje por el borde de un fractal, en tonos fríos.", "Deep coast", 28, 640, 900, 150],
  ["ruido-30", "Ruido 30", "Grano y caos controlado para glitch y transiciones.", "Noise 30", 11, 640, 360, 35],
  ["aurora", "Aurora", "Luz violeta y cian en movimiento lento.", "Aurora", 19, 640, 540, 66],
];

export const DEMO_RATE = 1450;

export const demoVideos: Video[] = items.map(([slug, title, description, title_en, usd, w, h, dur], i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-0000000000${n}`,
    slug,
    title,
    description,
    title_en,
    description_en: null,
    price_usd_cents: usd * 100,
    price_ars_cents: usd * DEMO_RATE * 100,
    bunny_video_id: null,
    trailer_video_id: null,
    trailer_url: `/demo/${n}.mp4`,
    cover_url: `/demo/${n}.jpg`,
    width: w,
    height: h,
    duration_seconds: dur,
    status: "publicado",
    publish_when_ready: true,
    created_at: new Date(Date.UTC(2026, 10, 14 - i)).toISOString(),
  };
});
