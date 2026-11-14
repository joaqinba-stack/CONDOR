export type VideoStatus = "borrador" | "procesando" | "publicado";
export type OrderStatus = "pendiente" | "pagada" | "reembolsada" | "fallida";
export type Provider = "mercadopago" | "paypal" | "manual";
export type Currency = "ARS" | "USD";
/** Qué se vende: un video (Bunny Stream) o una o varias fotos (Storage privado). */
export type ProductKind = "video" | "fotos";

/** Un producto de la tienda. Se llama Video por historia: hoy también puede ser un pack de fotos. */
export interface Video {
  id: string;
  kind: ProductKind;
  /** Cantidad de fotos (solo kind = "fotos"). */
  image_count: number;
  slug: string;
  title: string;
  description: string;
  title_en: string | null;
  description_en: string | null;
  price_usd_cents: number;
  price_ars_cents: number;
  /** Video completo en la biblioteca protegida de Bunny. */
  bunny_video_id: string | null;
  /** Tráiler en la biblioteca pública de Bunny. */
  trailer_video_id: string | null;
  /** URL pública del tráiler en MP4 (para la grilla). */
  trailer_url: string | null;
  cover_url: string | null;
  width: number;
  height: number;
  duration_seconds: number;
  status: VideoStatus;
  /** Publicar automáticamente cuando Bunny termine de procesar. */
  publish_when_ready: boolean;
  created_at: string;
}

export type VideoInput = Omit<Video, "id" | "created_at">;

/** Una foto de un producto de tipo "fotos". `path` es la ruta en el bucket privado. */
export interface ProductImage {
  id: string;
  video_id: string;
  path: string;
  width: number;
  height: number;
  position: number;
}

export interface Order {
  id: string;
  email: string;
  video_id: string;
  provider: Provider;
  provider_ref: string | null;
  currency: Currency;
  amount_cents: number;
  status: OrderStatus;
  locale: string;
  created_at: string;
  paid_at: string | null;
}

export interface Entitlement {
  email: string;
  video_id: string;
  order_id: string | null;
  created_at: string;
}
