import { sendPurchaseEmail } from "./email";
import { getStore } from "./store";
import type { Currency, Provider } from "./types";

export type FulfillResult = "fulfilled" | "already" | "mismatch" | "not_found";

export interface ConfirmedPayment {
  provider: Provider;
  providerRef: string;
  amountCents: number;
  currency: string;
}

/**
 * Único lugar donde un pago confirmado se convierte en acceso al video.
 * Es idempotente: lo pueden llamar varias veces (webhook repetido, webhook + retorno del
 * comprador) y el acceso y el email se generan una sola vez.
 */
export async function fulfillOrder(orderId: string, payment: ConfirmedPayment): Promise<FulfillResult> {
  const store = getStore();
  const order = await store.getOrder(orderId);
  if (!order) return "not_found";

  // El monto y la moneda cobrados tienen que coincidir con lo que pedía la orden.
  if (
    payment.provider !== order.provider ||
    payment.currency !== (order.currency as Currency) ||
    payment.amountCents < order.amount_cents
  ) {
    console.error("[fulfill] el pago no coincide con la orden", { orderId, payment });
    return "mismatch";
  }

  const transitioned = await store.transitionOrder(order.id, ["pendiente", "fallida"], "pagada", {
    provider_ref: payment.providerRef,
    paid_at: new Date().toISOString(),
  });

  const current = transitioned ? null : await store.getOrder(order.id);
  if (!transitioned && current?.status !== "pagada") return "already";

  // Se repite siempre (es un upsert) por si una ejecución anterior se cortó a la mitad.
  await store.grantEntitlement(order.email, order.video_id, order.id);
  if (!transitioned) return "already";

  const video = await store.getVideoById(order.video_id);
  if (video) {
    try {
      await sendPurchaseEmail(order, video);
    } catch (err) {
      // El acceso ya está dado: el comprador puede entrar igual pidiendo un link en /ingresar.
      console.error("[fulfill] no se pudo enviar el email de compra", err);
    }
  }
  return "fulfilled";
}

/** Reembolso o contracargo: se quita el acceso. */
export async function refundOrder(orderId: string): Promise<boolean> {
  const store = getStore();
  const changed = await store.transitionOrder(orderId, ["pagada"], "reembolsada");
  if (changed) await store.revokeEntitlementByOrder(orderId);
  return changed;
}

/** Pago rechazado o cancelado. No toca órdenes ya pagadas. */
export async function failOrder(orderId: string): Promise<void> {
  await getStore().transitionOrder(orderId, ["pendiente"], "fallida");
}
