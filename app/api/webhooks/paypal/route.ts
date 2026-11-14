import { NextResponse, type NextRequest } from "next/server";
import { paypalEnabled } from "@/lib/env";
import { failOrder, fulfillOrder, refundOrder } from "@/lib/fulfill";
import {
  captureFromEvent,
  captureIdFromRefund,
  verifyPaypalWebhook,
  type PaypalEvent,
} from "@/lib/payments/paypal";
import { getStore } from "@/lib/store";

/** Aviso de PayPal: pago acreditado, rechazado o reembolsado. */
export async function POST(req: NextRequest) {
  if (!paypalEnabled()) return NextResponse.json({ ok: false }, { status: 503 });

  const raw = await req.text();
  if (!(await verifyPaypalWebhook(req.headers, raw))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const ev = JSON.parse(raw) as PaypalEvent;

  try {
    switch (ev.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const cap = captureFromEvent(ev);
        if (cap.customId) {
          await fulfillOrder(cap.customId, {
            provider: "paypal",
            providerRef: cap.captureId,
            amountCents: cap.amount_cents,
            currency: cap.currency,
          });
        }
        break;
      }
      case "PAYMENT.CAPTURE.DENIED": {
        const cap = captureFromEvent(ev);
        if (cap.customId) await failOrder(cap.customId);
        break;
      }
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.CAPTURE.REVERSED": {
        const captureId = captureIdFromRefund(ev) ?? ev.resource.id;
        const order = await getStore().getOrderByProviderRef("paypal", captureId);
        if (order) await refundOrder(order.id);
        break;
      }
    }
  } catch (err) {
    console.error("[paypal webhook]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
