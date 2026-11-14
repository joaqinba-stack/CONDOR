import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => [] as { email: string; slug: string }[]);
vi.mock("@/lib/email", () => ({
  sendPurchaseEmail: vi.fn(async (order: { email: string }, video: { slug: string }) => {
    sent.push({ email: order.email, slug: video.slug });
  }),
}));

import { failOrder, fulfillOrder, refundOrder } from "@/lib/fulfill";
import { applyMercadoPagoPayment } from "@/lib/mp-sync";
import { setStoreForTests } from "@/lib/store";
import { demoVideos } from "@/lib/store/fixtures";
import { MemoryStore } from "@/lib/store/memory";

let store: MemoryStore;
const video = demoVideos[0];
const email = "ana@mail.com";

async function newOrder(provider: "mercadopago" | "paypal" = "mercadopago") {
  return store.createOrder({
    email,
    video_id: video.id,
    provider,
    currency: provider === "mercadopago" ? "ARS" : "USD",
    amount_cents: provider === "mercadopago" ? video.price_ars_cents : video.price_usd_cents,
    locale: "es",
  });
}

beforeEach(() => {
  store = new MemoryStore(demoVideos);
  setStoreForTests(store);
  sent.length = 0;
  process.env.MP_ACCESS_TOKEN = "TEST-token";
});

describe("fulfillOrder", () => {
  it("un pago confirmado da acceso y manda un email", async () => {
    const o = await newOrder();
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    const r = await fulfillOrder(o.id, { provider: "mercadopago", providerRef: "p1", amountCents: o.amount_cents, currency: "ARS" });
    expect(r).toBe("fulfilled");
    expect(await store.hasEntitlement(email, video.id)).toBe(true);
    expect((await store.getOrder(o.id))?.status).toBe("pagada");
    expect((await store.getOrder(o.id))?.provider_ref).toBe("p1");
    expect(sent).toEqual([{ email, slug: video.slug }]);
  });

  it("es idempotente: avisos repetidos no duplican acceso ni emails", async () => {
    const o = await newOrder();
    const pay = { provider: "mercadopago" as const, providerRef: "p1", amountCents: o.amount_cents, currency: "ARS" };
    const results = await Promise.all([fulfillOrder(o.id, pay), fulfillOrder(o.id, pay), fulfillOrder(o.id, pay)]);
    expect(results.filter((r) => r === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r === "already")).toHaveLength(2);
    expect(await fulfillOrder(o.id, pay)).toBe("already");
    expect(sent).toHaveLength(1);
    expect(store.entitlements).toHaveLength(1);
  });

  it("no da acceso si el monto es menor, la moneda es otra o el medio no coincide", async () => {
    const o = await newOrder();
    const ok = { provider: "mercadopago" as const, providerRef: "p1", amountCents: o.amount_cents, currency: "ARS" };
    expect(await fulfillOrder(o.id, { ...ok, amountCents: o.amount_cents - 1 })).toBe("mismatch");
    expect(await fulfillOrder(o.id, { ...ok, currency: "USD" })).toBe("mismatch");
    expect(await fulfillOrder(o.id, { ...ok, provider: "paypal" })).toBe("mismatch");
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    expect((await store.getOrder(o.id))?.status).toBe("pendiente");
    expect(sent).toHaveLength(0);
  });

  it("orden inexistente", async () => {
    expect(await fulfillOrder("nope", { provider: "paypal", providerRef: "x", amountCents: 1, currency: "USD" })).toBe("not_found");
  });

  it("un reembolso quita el acceso y un aviso de pago posterior no lo devuelve", async () => {
    const o = await newOrder("paypal");
    const pay = { provider: "paypal" as const, providerRef: "cap1", amountCents: o.amount_cents, currency: "USD" };
    await fulfillOrder(o.id, pay);
    expect(await refundOrder(o.id)).toBe(true);
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    expect((await store.getOrder(o.id))?.status).toBe("reembolsada");
    expect(await refundOrder(o.id)).toBe(false);
    expect(await fulfillOrder(o.id, pay)).toBe("already");
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
  });

  it("un rechazo no pisa una orden pagada, y un reintento aprobado sí la paga", async () => {
    const o = await newOrder();
    await failOrder(o.id);
    expect((await store.getOrder(o.id))?.status).toBe("fallida");
    const pay = { provider: "mercadopago" as const, providerRef: "p2", amountCents: o.amount_cents, currency: "ARS" };
    expect(await fulfillOrder(o.id, pay)).toBe("fulfilled");
    await failOrder(o.id);
    expect((await store.getOrder(o.id))?.status).toBe("pagada");
  });

  it("si falla el email, el acceso queda dado igual", async () => {
    const { sendPurchaseEmail } = await import("@/lib/email");
    vi.mocked(sendPurchaseEmail).mockRejectedValueOnce(new Error("resend caído"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const o = await newOrder();
    const r = await fulfillOrder(o.id, { provider: "mercadopago", providerRef: "p1", amountCents: o.amount_cents, currency: "ARS" });
    expect(r).toBe("fulfilled");
    expect(await store.hasEntitlement(email, video.id)).toBe(true);
    errors.mockRestore();
  });
});

describe("Mercado Pago: el estado sale de la API, no del aviso", () => {
  const mockPayment = (p: Record<string, unknown>) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(p), { status: 200 }));

  it("pago aprobado → acceso", async () => {
    const o = await newOrder();
    const f = mockPayment({ id: 555, status: "approved", external_reference: o.id, transaction_amount: o.amount_cents / 100, currency_id: "ARS" });
    await applyMercadoPagoPayment("555");
    expect(f.mock.calls[0][0]).toBe("https://api.mercadopago.com/v1/payments/555");
    expect(await store.hasEntitlement(email, video.id)).toBe(true);
    f.mockRestore();
  });

  it("pago pendiente o de otra orden → sin acceso", async () => {
    const o = await newOrder();
    let f = mockPayment({ id: 556, status: "in_process", external_reference: o.id, transaction_amount: o.amount_cents / 100, currency_id: "ARS" });
    await applyMercadoPagoPayment("556");
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    f.mockRestore();

    f = mockPayment({ id: 557, status: "approved", external_reference: "otra-orden", transaction_amount: 1, currency_id: "ARS" });
    await applyMercadoPagoPayment("557", o.id);
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    f.mockRestore();
  });

  it("pago aprobado por menos plata → sin acceso", async () => {
    const o = await newOrder();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = mockPayment({ id: 558, status: "approved", external_reference: o.id, transaction_amount: 1, currency_id: "ARS" });
    await applyMercadoPagoPayment("558");
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    f.mockRestore();
    errors.mockRestore();
  });

  it("contracargo → se quita el acceso", async () => {
    const o = await newOrder();
    await fulfillOrder(o.id, { provider: "mercadopago", providerRef: "559", amountCents: o.amount_cents, currency: "ARS" });
    const f = mockPayment({ id: 559, status: "charged_back", external_reference: o.id, transaction_amount: o.amount_cents / 100, currency_id: "ARS" });
    await applyMercadoPagoPayment("559");
    expect(await store.hasEntitlement(email, video.id)).toBe(false);
    f.mockRestore();
  });

  it("ignora ids que no son numéricos (no llama a la API)", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    await applyMercadoPagoPayment("../../x");
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
});

describe("Links de acceso", () => {
  it("sirven una sola vez y vencen", async () => {
    await store.createLoginToken(email, "h1", new Date(Date.now() + 60_000));
    expect(await store.consumeLoginToken("h1")).toBe(email);
    expect(await store.consumeLoginToken("h1")).toBeNull();
    await store.createLoginToken(email, "h2", new Date(Date.now() - 1));
    expect(await store.consumeLoginToken("h2")).toBeNull();
    expect(await store.consumeLoginToken("inexistente")).toBeNull();
  });
});
