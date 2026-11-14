import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { env } from "@/lib/env";
import { formatPrice } from "@/lib/format";
import { failOrder, fulfillOrder } from "@/lib/fulfill";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Pago simulado. Solo existe en modo demo (sin base de datos ni medios de pago configurados). */
export default async function DemoCheckout({ searchParams }: { searchParams: Promise<{ orden?: string }> }) {
  if (!env.isDemo) notFound();
  const { orden } = await searchParams;
  const store = getStore();
  const order = orden ? await store.getOrder(orden) : null;
  if (!order) notFound();
  const video = await store.getVideoById(order.video_id);

  async function approve() {
    "use server";
    if (!env.isDemo) return;
    const o = await getStore().getOrder(orden!);
    if (!o) return;
    await fulfillOrder(o.id, {
      provider: o.provider,
      providerRef: `demo-${o.id}`,
      amountCents: o.amount_cents,
      currency: o.currency,
    });
    redirect(`/checkout/exito?orden=${o.id}`);
  }

  async function reject() {
    "use server";
    if (!env.isDemo) return;
    await failOrder(orden!);
    redirect(`/checkout/error?orden=${orden}`);
  }

  return (
    <Shell>
      <main className="reveal grid grid-cols-1 px-4 pt-[18vh] md:grid-cols-12 md:px-5">
        <div className="max-w-[30rem] space-y-4 md:col-span-5 md:col-start-5">
          <h1>Pago simulado ({order.provider === "mercadopago" ? "Mercado Pago" : "PayPal"})</h1>
          <p className="text-mute">
            En el sitio real acá se abre el checkout del medio de pago. En modo demo podés simular el resultado.
          </p>
          <p>
            {video?.title} · {formatPrice(order.amount_cents, order.currency)}
            <br />
            <span className="text-mute">{order.email}</span>
          </p>
          <div className="flex flex-wrap gap-2.5 pt-4">
            <form action={approve}>
              <button className="btn">Simular pago aprobado</button>
            </form>
            <form action={reject}>
              <button className="btn btn-ghost">Simular rechazo</button>
            </form>
          </div>
        </div>
      </main>
    </Shell>
  );
}
