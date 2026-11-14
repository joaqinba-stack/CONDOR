import { randomUUID } from "node:crypto";
import type { Entitlement, Order, Video } from "../types";
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

  constructor(videos: Video[] = []) {
    this.videos = videos.map((v) => ({ ...v }));
  }

  async listPublishedVideos() {
    return this.videos.filter((v) => v.status === "publicado");
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
