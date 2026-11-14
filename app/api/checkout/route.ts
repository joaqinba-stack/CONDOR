import { NextResponse, type NextRequest } from "next/server";
import { env, mpEnabled, paypalEnabled } from "@/lib/env";
import { isEmail, normalizeEmail } from "@/lib/format";
import { getLocale } from "@/lib/i18n";
import { createPreference } from "@/lib/payments/mercadopago";
import { createPaypalOrder } from "@/lib/payments/paypal";
import { getStore } from "@/lib/store";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Inicia una compra: crea la orden "pendiente" y devuelve la URL del medio de pago.
 * El precio sale siempre de la base de datos, nunca de lo que manda el navegador.
 */
export async function POST(req: NextRequest) {
  let body: { slug?: unknown; email?: unknown; provider?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const provider = body.provider;

  if (!isEmail(email)) return fail("invalid_email");
  if (provider !== "mercadopago" && provider !== "paypal") return fail("bad_request");

  const store = getStore();
  const video = await store.getVideoBySlug(slug);
  if (!video || video.status !== "publicado") return fail("not_found", 404);
  if (await store.hasEntitlement(email, video.id)) return fail("owned", 409);

  const demo = env.isDemo;
  if (!demo && provider === "mercadopago" && !mpEnabled()) return fail("provider_off", 503);
  if (!demo && provider === "paypal" && !paypalEnabled()) return fail("provider_off", 503);

  const currency = provider === "mercadopago" ? "ARS" : "USD";
  const amount = currency === "ARS" ? video.price_ars_cents : video.price_usd_cents;
  if (amount <= 0) return fail("provider_off", 503);

  const order = await store.createOrder({
    email,
    video_id: video.id,
    provider,
    currency,
    amount_cents: amount,
    locale: await getLocale(),
  });

  try {
    if (demo) return NextResponse.json({ url: `/checkout/demo?orden=${order.id}` });

    if (provider === "mercadopago") {
      return NextResponse.json({ url: await createPreference(order, video) });
    }
    const pp = await createPaypalOrder(order, video);
    await store.setOrderProviderRef(order.id, pp.id);
    return NextResponse.json({ url: pp.approveUrl });
  } catch (err) {
    console.error("[checkout]", err);
    await store.transitionOrder(order.id, ["pendiente"], "fallida");
    return fail("provider_error", 502);
  }
}
