import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/email", () => ({ sendPurchaseEmail: vi.fn(async (o: { email: string }) => void sent.push(o.email)) }));
vi.mock("@/lib/i18n", async (orig) => ({ ...(await orig<typeof import("@/lib/i18n")>()), getLocale: async () => "es" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", async (orig) => ({ ...(await orig<typeof import("@/lib/session")>()), requireAdmin: async () => "admin@mail.com" }));

import { importCatalogItem } from "@/app/admin/importar/actions";
import { POST as checkout } from "@/app/api/checkout/route";
import { matchFile, similarity } from "@/lib/match";
import { setStoreForTests } from "@/lib/store";
import { demoImages, demoVideos } from "@/lib/store/fixtures";
import { MemoryStore } from "@/lib/store/memory";
import type { Video } from "@/lib/types";

let store: MemoryStore;
const base = demoVideos.find((v) => v.kind === "video")!;
const freeVideo: Video = { ...base, id: "f-1", slug: "gratis", price_usd_cents: 0, price_ars_cents: 0, tags: ["Twerk", "SFW"] };
const paidVideo: Video = { ...base, id: "p-1", slug: "pago", price_usd_cents: 500, price_ars_cents: 725000, tags: ["Twerk"] };

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/checkout", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  store = new MemoryStore([freeVideo, paidVideo], demoImages);
  setStoreForTests(store);
  sent.length = 0;
  delete process.env.SUPABASE_URL;
});

describe("Productos gratis", () => {
  it("dan acceso a ese email y le mandan el link, sin pasar por un medio de pago", async () => {
    const res = await checkout(req({ slug: "gratis", email: "Ana@Mail.com", provider: "free" }));
    expect(res.status).toBe(200);
    expect((await res.json()).url).toMatch(/^\/checkout\/exito\?orden=/);
    expect(await store.hasEntitlement("ana@mail.com", "f-1")).toBe(true);
    expect(sent).toEqual(["ana@mail.com"]);
    expect(store.orders[0]).toMatchObject({ provider: "manual", amount_cents: 0, status: "pagada" });
  });

  it("pedirlo de nuevo no duplica nada", async () => {
    await checkout(req({ slug: "gratis", email: "ana@mail.com", provider: "free" }));
    const again = await checkout(req({ slug: "gratis", email: "ana@mail.com", provider: "free" }));
    expect(again.status).toBe(409);
    expect(sent).toHaveLength(1);
    expect(store.entitlements).toHaveLength(1);
  });

  it("un producto pago no se puede obtener como gratis", async () => {
    const res = await checkout(req({ slug: "pago", email: "ana@mail.com", provider: "free" }));
    expect(res.status).toBe(400);
    expect(await store.hasEntitlement("ana@mail.com", "p-1")).toBe(false);
    expect(store.orders).toHaveLength(0);
  });

  it("un producto pago sigue cobrando el precio de la base", async () => {
    const res = await checkout(req({ slug: "pago", email: "ana@mail.com", provider: "paypal", amount: 1 }));
    expect(res.status).toBe(200);
    expect(store.orders[0]).toMatchObject({ provider: "paypal", amount_cents: 500, status: "pendiente" });
    expect(await store.hasEntitlement("ana@mail.com", "p-1")).toBe(false);
  });
});

describe("Etiquetas", () => {
  it("filtran los productos publicados", async () => {
    expect((await store.listPublishedVideos("Twerk")).map((v) => v.id).sort()).toEqual(["f-1", "p-1"]);
    expect((await store.listPublishedVideos("SFW")).map((v) => v.id)).toEqual(["f-1"]);
    expect(await store.listPublishedVideos("NoExiste")).toEqual([]);
    expect(await store.listPublishedVideos()).toHaveLength(2);
  });
});

describe("Importar catálogo", () => {
  const item = { manyvids_id: "7893201", titulo: "Un video", descripcion: "Texto", etiquetas: ["A", "B", "A"], precio_usd: 5, precio_ars: 7300, duracion_segundos: 779, ancho: 1920, alto: 1080 };

  it("crea el producto como borrador con sus datos", async () => {
    expect((await importCatalogItem(item)).status).toBe("creado");
    const v = await store.getVideoByManyvidsId("7893201");
    expect(v).toMatchObject({ title: "Un video", price_usd_cents: 500, price_ars_cents: 730000, status: "borrador", tags: ["A", "B"], duration_seconds: 779 });
  });

  it("no repite un producto ya importado", async () => {
    await importCatalogItem(item);
    expect((await importCatalogItem(item)).status).toBe("ya_estaba");
    expect(store.videos.filter((v) => v.manyvids_id === "7893201")).toHaveLength(1);
  });

  it("rechaza ítems inválidos", async () => {
    expect((await importCatalogItem({ ...item, manyvids_id: "../x" })).status).toBe("error");
    expect((await importCatalogItem({ ...item, precio_usd: -1 })).status).toBe("error");
    expect((await importCatalogItem({ ...item, titulo: "" })).status).toBe("error");
  });
});

describe("Asociar archivos a productos", () => {
  const products = [
    { id: "a", title: "Lesbian Outdoors BDSM FUCK", manyvids_id: "7893201" },
    { id: "b", title: "Latinas Twerking", manyvids_id: "7648862" },
  ];

  it("por número de ManyVids en el nombre", () => {
    expect(matchFile("7648862.mov", products)).toMatchObject({ product: { id: "b" }, by: "id" });
    expect(matchFile("final_7893201_v2.mp4", products)).toMatchObject({ product: { id: "a" }, by: "id" });
  });

  it("por título parecido", () => {
    expect(matchFile("latinas-twerking.mp4", products)).toMatchObject({ product: { id: "b" }, by: "titulo" });
    expect(similarity("Lesbian outdoors bdsm fuck FINAL.mov", products[0].title)).toBeGreaterThanOrEqual(0.6);
  });

  it("si no se parece a nada, no lo asocia", () => {
    expect(matchFile("IMG_0001.mov", products)).toBeNull();
  });
});
