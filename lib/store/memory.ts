import { randomUUID } from "node:crypto";
import type { Entitlement, Order, ProductImage, Video } from "../types";
import type { Store } from "./types";

interface LoginToken {
  email: string;
  hash: string;
  expires: number;
  created: number;
  used: boolean;
}

/** Implementación en memoria: modo demo y tests. Los datos se pierden al reiniciar. */
export class MemoryStore implements Store {
  videos: Video[];
  orders: Order[] = [];
  entitlements: Entitlement[] = [];
  settings = new Map<string, string>();
  tokens: LoginToken[] = [];
  images: ProductImage[];

  constructor(videos: Video[] = [], images: ProductImage[] = []) {
    this.videos = videos.map((v) => ({ ...v }));
    this.images = images.map((i) => ({ ...i }));
  }

  async listPublishedVideos(tag?: string) {
    return this.videos.filter((v) => v.status === "publicado" && (!tag || v.tags.includes(tag)));
  }
  async getVideoByManyvidsId(id: string) {
    return this.videos.find((v) => v.manyvids_id === id) ?? null;
  }
  async listAllVideos() {
    return [...this.videos];
  }
  async getVideoBySlug(slug: string) {
    return this.videos.find((v) => v.slug === slug) ?? null;
  }
  async getVideoById(id: string) {
    return this.videos.find((v) => v.id === id) ?? null;
  }
  async getVideoByBunnyId(guid: string) {
    return (
      this.videos.find((v) => v.bunny_video_id === guid || v.trailer_video_id === guid) ?? null
    );
  }
  async createVideo(input: Omit<Video, "id" | "created_at">) {
    const v: Video = { ...input, id: randomUUID(), created_at: new Date().toISOString() };
    this.videos.unshift(v);
    return v;
  }
  async updateVideo(id: string, patch: Partial<Video>) {
    const v = this.videos.find((x) => x.id === id);
    if (!v) return null;
    Object.assign(v, patch);
    return v;
  }
  async deleteVideo(id: string) {
    this.videos = this.videos.filter((v) => v.id !== id);
    this.images = this.images.filter((i) => i.video_id !== id);
  }

  async listImages(videoId: string) {
    return this.images.filter((i) => i.video_id === videoId).sort((a, b) => a.position - b.position);
  }
  private recount(videoId: string) {
    const v = this.videos.find((x) => x.id === videoId);
    if (v) v.image_count = this.images.filter((i) => i.video_id === videoId).length;
  }
  async addImage(videoId: string, image: { path: string; width: number; height: number }) {
    const last = Math.max(-1, ...this.images.filter((i) => i.video_id === videoId).map((i) => i.position));
    const row: ProductImage = { id: randomUUID(), video_id: videoId, position: last + 1, ...image };
    this.images.push(row);
    this.recount(videoId);
    return row;
  }
  async removeImage(imageId: string) {
    const row = this.images.find((i) => i.id === imageId) ?? null;
    if (!row) return null;
    this.images = this.images.filter((i) => i.id !== imageId);
    this.recount(row.video_id);
    return row;
  }

  async createOrder(input: Parameters<Store["createOrder"]>[0]) {
    const o: Order = {
      ...input,
      id: randomUUID(),
      provider_ref: null,
      status: "pendiente",
      created_at: new Date().toISOString(),
      paid_at: null,
    };
    this.orders.unshift(o);
    return o;
  }
  async getOrder(id: string) {
    return this.orders.find((o) => o.id === id) ?? null;
  }
  async getOrderByProviderRef(provider: Order["provider"], ref: string) {
    return this.orders.find((o) => o.provider === provider && o.provider_ref === ref) ?? null;
  }
  async setOrderProviderRef(id: string, ref: string) {
    const o = this.orders.find((x) => x.id === id);
    if (o) o.provider_ref = ref;
  }
  async transitionOrder(
    id: string,
    from: Order["status"][],
    to: Order["status"],
    patch: { provider_ref?: string; paid_at?: string } = {},
  ) {
    const o = this.orders.find((x) => x.id === id);
    if (!o || !from.includes(o.status)) return false;
    o.status = to;
    Object.assign(o, patch);
    return true;
  }
  async listOrders(limit = 200) {
    return this.orders.slice(0, limit);
  }

  async grantEntitlement(email: string, videoId: string, orderId: string | null) {
    if (this.entitlements.some((e) => e.email === email && e.video_id === videoId)) return;
    this.entitlements.push({
      email,
      video_id: videoId,
      order_id: orderId,
      created_at: new Date().toISOString(),
    });
  }
  async revokeEntitlementByOrder(orderId: string) {
    this.entitlements = this.entitlements.filter((e) => e.order_id !== orderId);
  }
  async revokeEntitlement(email: string, videoId: string) {
    this.entitlements = this.entitlements.filter(
      (e) => !(e.email === email && e.video_id === videoId),
    );
  }
  async hasEntitlement(email: string, videoId: string) {
    return this.entitlements.some((e) => e.email === email && e.video_id === videoId);
  }
  async listEntitlements(email: string) {
    return this.entitlements.filter((e) => e.email === email);
  }

  async getSetting(key: string) {
    return this.settings.get(key) ?? null;
  }
  async setSetting(key: string, value: string) {
    this.settings.set(key, value);
  }

  async createLoginToken(email: string, tokenHash: string, expiresAt: Date) {
    this.tokens.push({
      email,
      hash: tokenHash,
      expires: expiresAt.getTime(),
      created: Date.now(),
      used: false,
    });
  }
  async consumeLoginToken(tokenHash: string) {
    const t = this.tokens.find((x) => x.hash === tokenHash);
    if (!t || t.used || t.expires < Date.now()) return null;
    t.used = true;
    return t.email;
  }
  async countLoginTokensSince(email: string, since: Date) {
    return this.tokens.filter((t) => t.email === email && t.created >= since.getTime()).length;
  }
}
