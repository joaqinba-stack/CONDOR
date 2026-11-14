import { env } from "../env";
import type { Order, Video } from "../types";

function creds() {
  if (!env.paypalClientId || !env.paypalClientSecret) {
    throw new Error("PayPal no está configurado (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)");
  }
  return { id: env.paypalClientId, secret: env.paypalClientSecret };
}

async function accessToken(): Promise<string> {
  const { id, secret } = creds();
  const res = await fetch(`${env.paypalBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal: no se pudo autenticar (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function api(path: string, init: { method?: string; body?: unknown; idem?: string } = {}) {
  const res = await fetch(`${env.paypalBase}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(init.idem ? { "PayPal-Request-Id": init.idem } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  return res;
}

/** Crea la orden en PayPal y devuelve su id y la URL de aprobación. */
export async function createPaypalOrder(
  order: Order,
  video: Video,
): Promise<{ id: string; approveUrl: string }> {
  const base = env.siteUrl;
  const res = await api("/v2/checkout/orders", {
    method: "POST",
    idem: order.id,
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: video.id,
          custom_id: order.id,
          description: video.title.slice(0, 120),
          amount: { currency_code: "USD", value: (order.amount_cents / 100).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: env.siteName,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${base}/api/checkout/paypal/capture?orden=${order.id}`,
            cancel_url: `${base}/checkout/error?orden=${order.id}`,
          },
        },
      },
    },
  });
  if (!res.ok) throw new Error(`PayPal: no se pudo crear el pago (${res.status})`);
  const data = (await res.json()) as { id: string; links?: { rel: string; href: string }[] };
  const approveUrl = data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!approveUrl) throw new Error("PayPal: respuesta sin link de aprobación");
  return { id: data.id, approveUrl };
}

export interface PaypalCapture {
  captureId: string;
  status: string;
  customId: string | null;
  amount_cents: number;
  currency: string;
}

interface CaptureResource {
  id: string;
  status: string;
  custom_id?: string;
  amount?: { currency_code: string; value: string };
}

const toCapture = (c: CaptureResource): PaypalCapture => ({
  captureId: c.id,
  status: c.status,
  customId: c.custom_id ?? null,
  amount_cents: Math.round(parseFloat(c.amount?.value ?? "0") * 100),
  currency: c.amount?.currency_code ?? "",
});

/** Captura (cobra) una orden aprobada por el comprador. */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalCapture | null> {
  if (!/^[A-Z0-9]{10,30}$/i.test(paypalOrderId)) return null;
  const res = await api(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    idem: `capture-${paypalOrderId}`,
    body: {},
  });
  // 422 = ya capturada o no aprobada: se lee el estado actual de la orden.
  const source = res.ok ? res : res.status === 422 ? await api(`/v2/checkout/orders/${paypalOrderId}`) : null;
  if (!source || !source.ok) return null;
  const data = (await source.json()) as {
    purchase_units?: { custom_id?: string; payments?: { captures?: CaptureResource[] } }[];
  };
  const unit = data.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  if (!cap) return null;
  return toCapture({ ...cap, custom_id: cap.custom_id ?? unit?.custom_id });
}

/** Verifica con PayPal que el webhook sea auténtico. */
export async function verifyPaypalWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  if (!env.paypalWebhookId) return false;
  const h = (k: string) => headers.get(k);
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  if (required.some((k) => !h(k))) return false;
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const res = await api("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: {
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: env.paypalWebhookId,
      webhook_event: event,
    },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}

export interface PaypalEvent {
  event_type: string;
  resource: CaptureResource & { links?: { rel: string; href: string }[] };
}

export const captureFromEvent = (ev: PaypalEvent): PaypalCapture => toCapture(ev.resource);

/** En un reembolso, el id de la captura original viene en el link "up". */
export function captureIdFromRefund(ev: PaypalEvent): string | null {
  const up = ev.resource.links?.find((l) => l.rel === "up")?.href;
  const m = up?.match(/\/captures\/([A-Z0-9]+)/i);
  return m?.[1] ?? null;
}
