import { NextResponse, type NextRequest } from "next/server";
import { failOrder, fulfillOrder } from "@/lib/fulfill";
import { capturePaypalOrder } from "@/lib/payments/paypal";
import { getStore } from "@/lib/store";

/**
 * PayPal devuelve acá al comprador después de aprobar el pago.
 * Se captura (cobra) en el servidor y recién entonces se habilita el video.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orden") ?? "";
  const paypalId = req.nextUrl.searchParams.get("token") ?? "";
  const to = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin), 303);

  const order = await getStore().getOrder(orderId);
  if (!order || order.provider !== "paypal") return to("/");
  const done = to(`/checkout/exito?orden=${order.id}`);
  if (order.status !== "pendiente") return done;
  // El id de PayPal tiene que ser el que se guardó al crear esta orden.
  if (!paypalId || order.provider_ref !== paypalId) return to(`/checkout/error?orden=${order.id}`);

  try {
    const cap = await capturePaypalOrder(paypalId);
    if (!cap || cap.customId !== order.id) return to(`/checkout/error?orden=${order.id}`);
    if (cap.status === "COMPLETED") {
      await fulfillOrder(order.id, {
        provider: "paypal",
        providerRef: cap.captureId,
        amountCents: cap.amount_cents,
        currency: cap.currency,
      });
    } else if (cap.status === "DECLINED" || cap.status === "FAILED") {
      await failOrder(order.id);
      return to(`/checkout/error?orden=${order.id}`);
    }
    // PENDING: queda "pendiente" y lo termina el webhook cuando PayPal lo acredite.
  } catch (err) {
    console.error("[paypal capture]", err);
  }
  return done;
}
