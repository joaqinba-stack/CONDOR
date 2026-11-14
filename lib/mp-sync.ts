import { failOrder, fulfillOrder, refundOrder } from "./fulfill";
import { getPayment } from "./payments/mercadopago";

/**
 * Lee un pago de Mercado Pago desde su API y aplica el resultado a la orden.
 * Lo usan el webhook y la página de retorno (por si el webhook tarda).
 * Si se pasa `expectedOrderId`, el pago tiene que pertenecer a esa orden.
 */
export async function applyMercadoPagoPayment(paymentId: string, expectedOrderId?: string): Promise<void> {
  const p = await getPayment(paymentId);
  if (!p?.external_reference) return;
  if (expectedOrderId && p.external_reference !== expectedOrderId) return;
  const orderId = p.external_reference;

  if (p.status === "approved") {
    await fulfillOrder(orderId, {
      provider: "mercadopago",
      providerRef: p.id,
      amountCents: p.amount_cents,
      currency: p.currency,
    });
  } else if (p.status === "refunded" || p.status === "charged_back") {
    await refundOrder(orderId);
  } else if (p.status === "rejected" || p.status === "cancelled") {
    await failOrder(orderId);
  }
}
