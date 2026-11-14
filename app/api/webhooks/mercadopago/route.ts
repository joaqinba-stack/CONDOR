import { NextResponse, type NextRequest } from "next/server";
import { env, mpEnabled } from "@/lib/env";
import { applyMercadoPagoPayment } from "@/lib/mp-sync";
import { verifyWebhookSignature } from "@/lib/payments/mercadopago";

/** Aviso de Mercado Pago: un pago cambió de estado. */
export async function POST(req: NextRequest) {
  if (!mpEnabled()) return NextResponse.json({ ok: false }, { status: 503 });

  const q = req.nextUrl.searchParams;
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const type = q.get("type") ?? body.type;
  const dataId = q.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);

  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true });

  if (env.mpWebhookSecret) {
    const valid = verifyWebhookSignature({
      signatureHeader: req.headers.get("x-signature"),
      requestId: req.headers.get("x-request-id"),
      dataId,
      secret: env.mpWebhookSecret,
    });
    if (!valid) return NextResponse.json({ ok: false }, { status: 401 });
  } else {
    console.warn("[mp webhook] falta MP_WEBHOOK_SECRET: no se valida la firma (el pago igual se verifica contra la API)");
  }

  try {
    await applyMercadoPagoPayment(dataId);
  } catch (err) {
    console.error("[mp webhook]", err);
    // 500 → Mercado Pago reintenta más tarde.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
