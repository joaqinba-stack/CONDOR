import { bunnyEnabled, bunnyTrailersEnabled, env, mpEnabled, paypalEnabled } from "@/lib/env";
import { getStore } from "@/lib/store";
import { saveRate } from "../actions";

export default async function Settings() {
  const rate = (await getStore().getSetting("usd_ars_rate")) ?? "";
  const checks: [string, boolean, string][] = [
    ["Base de datos (Supabase)", !env.isDemo, "Sin esto el sitio corre en modo demo."],
    ["Mercado Pago", mpEnabled(), "Cobros en pesos."],
    ["Firma de avisos de Mercado Pago", !!env.mpWebhookSecret, "Recomendado: MP_WEBHOOK_SECRET."],
    ["PayPal", paypalEnabled(), `Cobros en dólares (${process.env.PAYPAL_ENV === "live" ? "producción" : "modo prueba"}).`],
    ["Avisos de PayPal", !!env.paypalWebhookId, "Necesario para reembolsos y pagos demorados."],
    ["Bunny: videos completos", bunnyEnabled(), "Subida y reproducción protegida."],
    ["Bunny: tráilers", bunnyTrailersEnabled(), "Clips públicos de la grilla."],
    ["Emails (Resend)", !!env.resendKey, "Sin esto los emails solo se ven en el registro del servidor."],
  ];

  return (
    <>
      <h1 className="mb-10">Ajustes</h1>

      <section className="max-w-[40rem]">
        <h2>Cotización del dólar</h2>
        <p className="mt-1 text-mute">
          Se usa solo para sugerir el precio en pesos al cargar un video. No cambia los precios ya cargados.
        </p>
        <form action={saveRate} className="mt-6 flex items-end gap-5">
          <label className="block flex-1 text-mute">
            1 USD = … ARS
            <input name="rate" inputMode="decimal" defaultValue={rate} required className="field" />
          </label>
          <button className="btn btn-ghost">Guardar</button>
        </form>
      </section>

      <section className="mt-16 max-w-[40rem]">
        <h2>Estado de la configuración</h2>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {checks.map(([name, ok, note]) => (
            <li key={name} className="flex items-baseline justify-between gap-5 py-2.5">
              <span>
                {name} <span className="text-dim">· {note}</span>
              </span>
              <span className={ok ? "text-fg" : "text-mute"}>{ok ? "Listo" : "Falta"}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
