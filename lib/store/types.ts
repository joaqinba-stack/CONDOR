import type { Currency, Entitlement, Order, OrderStatus, Provider, Video, VideoInput } from "../types";

export interface NewOrder {
  email: string;
  video_id: string;
  provider: Provider;
  currency: Currency;
  amount_cents: number;
  locale: string;
}

/**
 * Acceso a datos. Dos implementaciones: Supabase (producción) y memoria (demo y tests).
 * Solo se usa desde el servidor.
 */
export interface Store {
  listPublishedVideos(): Promise<Video[]>;
  listAllVideos(): Promise<Video[]>;
  getVideoBySlug(slug: string): Promise<Video | null>;
  getVideoById(id: string): Promise<Video | null>;
  /** Busca por id de Bunny, sea el video completo o el tráiler. */
  getVideoByBunnyId(guid: string): Promise<Video | null>;
  createVideo(input: VideoInput): Promise<Video>;
  updateVideo(id: string, patch: Partial<VideoInput>): Promise<Video | null>;
  deleteVideo(id: string): Promise<void>;

  createOrder(input: NewOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByProviderRef(provider: Provider, ref: string): Promise<Order | null>;
  setOrderProviderRef(id: string, ref: string): Promise<void>;
  /**
   * Pasa la orden de `from` a `to` de forma atómica.
   * Devuelve true solo si esta llamada hizo el cambio (base de la idempotencia).
   */
  transitionOrder(
    id: string,
    from: OrderStatus[],
    to: OrderStatus,
    patch?: { provider_ref?: string; paid_at?: string },
  ): Promise<boolean>;
  listOrders(limit?: number): Promise<Order[]>;

  grantEntitlement(email: string, videoId: string, orderId: string | null): Promise<void>;
  revokeEntitlementByOrder(orderId: string): Promise<void>;
  revokeEntitlement(email: string, videoId: string): Promise<void>;
  hasEntitlement(email: string, videoId: string): Promise<boolean>;
  listEntitlements(email: string): Promise<Entitlement[]>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  createLoginToken(email: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Consume el token (un solo uso). Devuelve el email si era válido y no venció. */
  consumeLoginToken(tokenHash: string): Promise<string | null>;
  /** Cantidad de links de acceso pedidos para ese email desde `since`. */
  countLoginTokensSince(email: string, since: Date): Promise<number>;
}
