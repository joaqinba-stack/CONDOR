import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Shell } from "@/components/Shell";
import { mpEnabled } from "@/lib/env";
import { maskEmail } from "@/lib/format";
import { dict, getLocale } from "@/lib/i18n";
import { applyMercadoPagoPayment } from "@/lib/mp-sync";
import { getSessionEmail } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

type Props = { searchParams: Promise<{ orden?: string; payment_id?: string }> };

export default async function Success({ searchParams }: Props) {
  const { orden, payment_id } = await searchParams;
  const store = getStore();
  let order = orden ? await store.getOrder(orden) : null;
  if (!order) notFound();

  // Mercado Pago vuelve con ?payment_id=. Si el webhook todavía no llegó, se consulta el pago
  // a la API (fuente de verdad) para no hacer esperar al comprador.
  if (order.status === "pendiente" && order.provider === "mercadopago" && payment_id && mpEnabled()) {
    try {
      await applyMercadoPagoPayment(payment_id, order.id);
      order = (await store.getOrder(order.id)) ?? order;
    } catch (err) {
      console.error("[exito]", err);
    }
  }

  const t = dict(await getLocale());
  const video = await store.getVideoById(order.video_id);
  const email = await getSessionEmail();
  const mine = email === order.email;
  const masked = maskEmail(order.email);

  return (
    <Shell>
      <main className="reveal grid grid-cols-1 px-4 pt-[18vh] md:grid-cols-12 md:px-5">
        <div className="max-w-[30rem] space-y-4 md:col-span-5 md:col-start-5">
          {order.status === "pagada" && (
            <>
              <h1>{t.ok_title}</h1>
              <p className="text-mute">
                {t.ok_paid} <span className="text-fg">{masked}</span>. {t.ok_check_spam}
              </p>
              {video && (
                <p className="pt-4">
                  <Link href={mine ? `/ver/${video.slug}` : `/ingresar?next=/ver/${video.slug}`} className="btn">
                    {mine ? t.watch_now : t.nav_login}
                  </Link>
                </p>
              )}
            </>
          )}
          {order.status === "pendiente" && (
            <>
              <AutoRefresh />
              <h1>{t.ok_pending_title}…</h1>
              <p className="text-mute">
                {t.ok_pending} <span className="text-fg">{masked}</span>.
              </p>
            </>
          )}
          {order.status === "fallida" && (
            <>
              <h1>{t.ok_failed_title}</h1>
              <p className="text-mute">{t.ok_failed}</p>
            </>
          )}
          {order.status === "reembolsada" && <h1>{t.ok_refunded}</h1>}
          {video && order.status !== "pagada" && order.status !== "pendiente" && (
            <p className="pt-4">
              <Link href={`/v/${video.slug}`} className="btn btn-ghost">
                {t.try_again}
              </Link>
            </p>
          )}
        </div>
      </main>
    </Shell>
  );
}
