import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Entitlement, Order, ProductImage, Video } from "../types";
import type { Store } from "./types";

/**
 * Implementación sobre Supabase (Postgres). Usa la service role key: solo servidor.
 * Las tablas tienen RLS activado sin políticas, así que la clave pública no puede leer nada.
 */
export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  get client() {
    return this.db;
  }

  private ok<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.data;
  }

  async listPublishedVideos(tag?: string) {
    let q = this.db.from("videos").select("*").eq("status", "publicado");
    if (tag) q = q.contains("tags", [tag]);
    return this.ok(await q.order("created_at", { ascending: false })) as Video[];
  }
  async getVideoByManyvidsId(id: string) {
    return this.ok(
      await this.db.from("videos").select("*").eq("manyvids_id", id).maybeSingle(),
    ) as Video | null;
  }
  async listAllVideos() {
    return this.ok(
      await this.db.from("videos").select("*").order("created_at", { ascending: false }),
    ) as Video[];
  }
  async getVideoBySlug(slug: string) {
    return this.ok(
      await this.db.from("videos").select("*").eq("slug", slug).maybeSingle(),
    ) as Video | null;
  }
  async getVideoById(id: string) {
    return this.ok(
      await this.db.from("videos").select("*").eq("id", id).maybeSingle(),
    ) as Video | null;
  }
  async getVideoByBunnyId(guid: string) {
    const full = this.ok(
      await this.db.from("videos").select("*").eq("bunny_video_id", guid).maybeSingle(),
    ) as Video | null;
    if (full) return full;
    return this.ok(
      await this.db.from("videos").select("*").eq("trailer_video_id", guid).maybeSingle(),
    ) as Video | null;
  }
  async createVideo(input: Omit<Video, "id" | "created_at">) {
    return this.ok(await this.db.from("videos").insert(input).select("*").single()) as Video;
  }
  async updateVideo(id: string, patch: Partial<Video>) {
    return this.ok(
      await this.db.from("videos").update(patch).eq("id", id).select("*").maybeSingle(),
    ) as Video | null;
  }
  async deleteVideo(id: string) {
    this.ok(await this.db.from("videos").delete().eq("id", id));
  }

  async listImages(videoId: string) {
    return this.ok(
      await this.db.from("product_images").select("*").eq("video_id", videoId).order("position", { ascending: true }),
    ) as ProductImage[];
  }
  private async recount(videoId: string) {
    const res = await this.db
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("video_id", videoId);
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    this.ok(await this.db.from("videos").update({ image_count: res.count ?? 0 }).eq("id", videoId));
  }
  async addImage(videoId: string, image: { path: string; width: number; height: number }) {
    const last = this.ok(
      await this.db
        .from("product_images")
        .select("position")
        .eq("video_id", videoId)
        .order("position", { ascending: false })
        .limit(1),
    ) as { position: number }[];
    const row = this.ok(
      await this.db
        .from("product_images")
        .insert({ video_id: videoId, position: (last[0]?.position ?? -1) + 1, ...image })
        .select("*")
        .single(),
    ) as ProductImage;
    await this.recount(videoId);
    return row;
  }
  async removeImage(imageId: string) {
    const rows = this.ok(
      await this.db.from("product_images").delete().eq("id", imageId).select("*"),
    ) as ProductImage[];
    if (!rows[0]) return null;
    await this.recount(rows[0].video_id);
    return rows[0];
  }

  async createOrder(input: Parameters<Store["createOrder"]>[0]) {
    return this.ok(await this.db.from("orders").insert(input).select("*").single()) as Order;
  }
  async getOrder(id: string) {
    return this.ok(
      await this.db.from("orders").select("*").eq("id", id).maybeSingle(),
    ) as Order | null;
  }
  async getOrderByProviderRef(provider: Order["provider"], ref: string) {
    return this.ok(
      await this.db
        .from("orders")
        .select("*")
        .eq("provider", provider)
        .eq("provider_ref", ref)
        .limit(1)
        .maybeSingle(),
    ) as Order | null;
  }
  async setOrderProviderRef(id: string, ref: string) {
    this.ok(await this.db.from("orders").update({ provider_ref: ref }).eq("id", id));
  }
  async transitionOrder(
    id: string,
    from: Order["status"][],
    to: Order["status"],
    patch: { provider_ref?: string; paid_at?: string } = {},
  ) {
    const rows = this.ok(
      await this.db
        .from("orders")
        .update({ status: to, ...patch })
        .eq("id", id)
        .in("status", from)
        .select("id"),
    ) as { id: string }[];
    return rows.length > 0;
  }
  async listOrders(limit = 200) {
    return this.ok(
      await this.db
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    ) as Order[];
  }

  async grantEntitlement(email: string, videoId: string, orderId: string | null) {
    this.ok(
      await this.db
        .from("entitlements")
        .upsert(
          { email, video_id: videoId, order_id: orderId },
          { onConflict: "email,video_id", ignoreDuplicates: true },
        ),
    );
  }
  async revokeEntitlementByOrder(orderId: string) {
    this.ok(await this.db.from("entitlements").delete().eq("order_id", orderId));
  }
  async revokeEntitlement(email: string, videoId: string) {
    this.ok(
      await this.db.from("entitlements").delete().eq("email", email).eq("video_id", videoId),
    );
  }
  async hasEntitlement(email: string, videoId: string) {
    const rows = this.ok(
      await this.db
        .from("entitlements")
        .select("video_id")
        .eq("email", email)
        .eq("video_id", videoId)
        .limit(1),
    ) as unknown[];
    return rows.length > 0;
  }
  async listEntitlements(email: string) {
    return this.ok(
      await this.db
        .from("entitlements")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false }),
    ) as Entitlement[];
  }

  async getSetting(key: string) {
    const row = this.ok(
      await this.db.from("settings").select("value").eq("key", key).maybeSingle(),
    ) as { value: string } | null;
    return row?.value ?? null;
  }
  async setSetting(key: string, value: string) {
    this.ok(await this.db.from("settings").upsert({ key, value }, { onConflict: "key" }));
  }

  async createLoginToken(email: string, tokenHash: string, expiresAt: Date) {
    this.ok(
      await this.db
        .from("login_tokens")
        .insert({ email, token_hash: tokenHash, expires_at: expiresAt.toISOString() }),
    );
  }
  async consumeLoginToken(tokenHash: string) {
    const rows = this.ok(
      await this.db
        .from("login_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token_hash", tokenHash)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("email"),
    ) as { email: string }[];
    return rows[0]?.email ?? null;
  }
  async countLoginTokensSince(email: string, since: Date) {
    const res = await this.db
      .from("login_tokens")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since.toISOString());
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.count ?? 0;
  }
}
