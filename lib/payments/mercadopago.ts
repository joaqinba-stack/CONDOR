import { hmacHex, safeEqual } from "../crypto";
import { env } from "../env";
import type { Order, Video } from "../types";

const API = "https://api.mercadopago.com";

function token(): string {
  if (!env.mpAccessToken) throw new Error("Mercado Pago no está configurado (MP_ACCESS_TOKEN)");
  return env.mpAccessToken;
}

/** Crea la preferencia de Checkout Pro y devuelve la URL a la que hay que mandar al comprador. */
export async function createPreference(order: Order, video: Video): Promise<string> {
  const base = env.siteUrl;
  // Mercado Pago solo acepta retorno automático y avisos hacia URLs públicas con https.
  const isPublic = base.startsWith("https://");
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": order.id,
    },
    body: JSON.stringify({
      items: [
        {
          id: video.id,
          title: video.title,
          quantity: 1,
          currency_id: "ARS",
          unit_price: order.amount_cents / 100,
        },
      ],
      payer: { email: order.email },
      external_reference: order.id,
      back_urls: {
        success: `${base}/checkout/exito?orden=${order.id}`,
        pending: `${base}/checkout/exito?orden=${order.id}`,
        failure: `${base}/checkout/error?orden=${order.id}`,
      },
      ...(isPublic
        ? { auto_return: "approved", notification_url: `${base}/api/webhooks/mercadopago` }
        : {}),
      statement_descriptor: env.siteName.slice(0, 13).toUpperCase(),
    }),
  });
  if (!res.ok) throw new Error(`Mercado Pago: no se pudo crear el pago (${res.status})`);
  const data = (await res.json()) as { init_point?: string };
  if (!data.init_point) throw new Error("Mercado Pago: respuesta sin init_point");
  return data.init_point;
}

/**
 * Valida la firma del webhook (header x-signature: "ts=...,v1=...").
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` firmado con HMAC-SHA256.
 */
export function verifyWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  nowMs?: number;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = opts;
  if (!signatureHeader) return false;
  const parts = new Map(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()] as const;
    }),
  );
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  return safeEqual(hmacHex(secret, manifest), v1.toLowerCase());
}

export interface MpPayment {
  id: string;
  status: string;
  external_reference: string | null;
  amount_cents: number;
  currency: string;
}

/** Consulta el pago a la API: es la fuente de verdad, no el cuerpo del webhook. */
export async function getPayment(paymentId: string): Promise<MpPayment | null> {
  if (!/^\d+$/.test(paymentId)) return null;
  const res = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago: no se pudo consultar el pago (${res.status})`);
  const p = (await res.json()) as {
    id: number;
    status: string;
    external_reference?: string | null;
    transaction_amount: number;
    currency_id: string;
  };
  return {
    id: String(p.id),
    status: p.status,
    external_reference: p.external_reference ?? null,
    amount_cents: Math.round(p.transaction_amount * 100),
    currency: p.currency_id,
  };
}
