import { beforeEach, describe, expect, it } from "vitest";
import { getProductAccess } from "@/lib/access";
import { setStoreForTests } from "@/lib/store";
import { demoFullVideo, demoImages, demoVideos } from "@/lib/store/fixtures";
import { MemoryStore } from "@/lib/store/memory";

let store: MemoryStore;
const pack = demoVideos.find((v) => v.kind === "fotos" && v.image_count > 1)!;
const video = demoVideos.find((v) => v.kind === "video")!;
const buyer = "ana@mail.com";

beforeEach(() => {
  store = new MemoryStore(demoVideos, demoImages);
  setStoreForTests(store);
  process.env.ADMIN_EMAILS = "admin@mail.com";
  delete process.env.SUPABASE_URL;
});

describe("Acceso al contenido comprado", () => {
  it("sin sesión o sin compra no se entrega ninguna foto ni video", async () => {
    for (const email of [null, buyer]) {
      const a = await getProductAccess(email, pack.slug);
      expect(a.status).toBe("forbidden");
      expect(a).not.toHaveProperty("photos");
      const b = await getProductAccess(email, video.slug);
      expect(b.status).toBe("forbidden");
      expect(b).not.toHaveProperty("demoSrc");
      expect(b).not.toHaveProperty("embedUrl");
    }
  });

  it("con la compra registrada entrega las fotos del pack, en orden", async () => {
    await store.grantEntitlement(buyer, pack.id, null);
    const a = await getProductAccess(buyer, pack.slug);
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    expect(a.photos).toHaveLength(pack.image_count);
    expect(a.photos.map((p) => p.url)).toEqual(demoImages.filter((i) => i.video_id === pack.id).map((i) => i.path));
  });

  it("comprar un producto no da acceso a otro", async () => {
    await store.grantEntitlement(buyer, pack.id, null);
    expect((await getProductAccess(buyer, video.slug)).status).toBe("forbidden");
    const other = demoVideos.find((v) => v.kind === "fotos" && v.id !== pack.id)!;
    expect((await getProductAccess(buyer, other.slug)).status).toBe("forbidden");
  });

  it("la compra de un video entrega el video y ninguna foto", async () => {
    await store.grantEntitlement(buyer, video.id, null);
    const a = await getProductAccess(buyer, video.slug);
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    // El video completo de la demo (sea del catálogo de ejemplo o del importado).
    expect(a.demoSrc).toBe(demoFullVideo[video.slug]);
    expect(a.demoSrc).toMatch(/^\/demo\/.+\.mp4$/);
    expect(a.photos).toEqual([]);
  });

  it("quien administra puede ver todo; un producto inexistente no existe para nadie", async () => {
    expect((await getProductAccess("admin@mail.com", pack.slug)).status).toBe("ok");
    expect((await getProductAccess("admin@mail.com", "no-existe")).status).toBe("not_found");
  });

  it("al quitar el acceso (reembolso) deja de entregar las fotos", async () => {
    await store.grantEntitlement(buyer, pack.id, null);
    await store.revokeEntitlement(buyer, pack.id);
    expect((await getProductAccess(buyer, pack.slug)).status).toBe("forbidden");
  });
});

describe("Fotos de un producto", () => {
  it("agregar y quitar mantiene el orden y la cantidad", async () => {
    const p = await store.createVideo({ ...pack, slug: "nuevo-pack", image_count: 0, status: "borrador" });
    const a = await store.addImage(p.id, { path: `${p.id}/a.jpg`, width: 10, height: 20 });
    const b = await store.addImage(p.id, { path: `${p.id}/b.jpg`, width: 10, height: 20 });
    expect([a.position, b.position]).toEqual([0, 1]);
    expect((await store.getVideoById(p.id))?.image_count).toBe(2);

    expect((await store.removeImage(a.id))?.path).toBe(`${p.id}/a.jpg`);
    expect(await store.removeImage(a.id)).toBeNull();
    expect((await store.getVideoById(p.id))?.image_count).toBe(1);
    expect((await store.listImages(p.id)).map((i) => i.path)).toEqual([`${p.id}/b.jpg`]);
  });

  it("borrar el producto borra sus fotos", async () => {
    await store.deleteVideo(pack.id);
    expect(await store.listImages(pack.id)).toEqual([]);
  });
});
