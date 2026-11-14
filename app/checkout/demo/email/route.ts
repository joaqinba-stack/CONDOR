import { NextResponse, type NextRequest } from "next/server";
import { buildPurchaseEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getStore } from "@/lib/store";

/**
 * Solo en modo demo (donde no se envían emails): muestra el email de compra tal como le
 * llegaría al comprador, con un link de acceso que funciona, para poder recorrer el flujo completo.
 */
export async function GET(req: NextRequest) {
  if (!env.isDemo) return new NextResponse("No encontrado", { status: 404 });
  const store = getStore();
  const order = await store.getOrder(req.nextUrl.searchParams.get("orden") ?? "");
  const video = order?.status === "pagada" ? await store.getVideoById(order.video_id) : null;
  if (!order || !video) return new NextResponse("No encontrado", { status: 404 });

  const mail = await buildPurchaseEmail(order, video);
  return new NextResponse(mail.html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" },
  });
}
