import { formatPrice } from "@/lib/format";
import { getStore } from "@/lib/store";
import { grantAccess } from "../actions";

const STATUS: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  reembolsada: "Reembolsada",
  fallida: "No completada",
};
const PROVIDER: Record<string, string> = { mercadopago: "Mercado Pago", paypal: "PayPal", manual: "Manual" };

export default async function Sales() {
  const store = getStore();
  const [orders, videos] = await Promise.all([store.listOrders(300), store.listAllVideos()]);
  const titles = new Map(videos.map((v) => [v.id, v.title]));
  const paid = orders.filter((o) => o.status === "pagada");
  const total = (c: "ARS" | "USD") => paid.filter((o) => o.currency === c).reduce((s, o) => s + o.amount_cents, 0);

  return (
    <>
      <h1 className="mb-10">Ventas</h1>

      <dl className="mb-12 grid max-w-[40rem] grid-cols-3 gap-5">
        <div>
          <dt className="text-mute">Ventas pagadas</dt>
          <dd className="text-2xl">{paid.length}</dd>
        </div>
        <div>
          <dt className="text-mute">Mercado Pago</dt>
          <dd className="text-2xl">{formatPrice(total("ARS"), "ARS")}</dd>
        </div>
        <div>
          <dt className="text-mute">PayPal</dt>
          <dd className="text-2xl">{formatPrice(total("USD"), "USD")}</dd>
        </div>
      </dl>

      {orders.length === 0 ? (
        <p className="text-mute">Todavía no hay ventas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left">
            <thead className="text-mute">
              <tr className="border-b border-line">
                {["Fecha", "Email", "Video", "Medio", "Monto", "Estado"].map((h) => (
                  <th key={h} className="py-2 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line">
                  <td className="py-2 pr-4 text-mute tabular-nums">
                    {new Date(o.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="py-2 pr-4">{o.email}</td>
                  <td className="py-2 pr-4">{titles.get(o.video_id) ?? "—"}</td>
                  <td className="py-2 pr-4 text-mute">{PROVIDER[o.provider]}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatPrice(o.amount_cents, o.currency)}</td>
                  <td className={`py-2 pr-4 ${o.status === "pagada" ? "text-fg" : "text-mute"}`}>{STATUS[o.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-16 max-w-[40rem]">
        <h2>Dar acceso manual</h2>
        <p className="mt-1 text-mute">
          Para regalar un video o resolver un reclamo. La persona entra con ese email desde “Ingresar”.
        </p>
        <form action={grantAccess} className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-mute">
            Email
            <input name="email" type="email" required className="field" />
          </label>
          <label className="block text-mute">
            Video
            <select name="video_id" required className="field">
              {videos.map((v) => (
                <option key={v.id} value={v.id} className="bg-bg">
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost">Dar acceso</button>
        </form>
      </section>
    </>
  );
}
