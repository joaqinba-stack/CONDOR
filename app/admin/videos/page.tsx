import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { getStore } from "@/lib/store";
import { refreshVideo, removeVideo, setVideoStatus } from "../actions";

const STATUS: Record<string, string> = { borrador: "Borrador", procesando: "Procesando…", publicado: "Publicado" };

export default async function AdminVideos() {
  const videos = await getStore().listAllVideos();
  return (
    <>
      <div className="mb-10 flex items-center justify-between gap-4">
        <h1>Videos ({videos.length})</h1>
        <Link href="/admin/videos/nuevo" className="btn">
          Nuevo video
        </Link>
      </div>

      {videos.length === 0 ? (
        <p className="text-mute">Todavía no cargaste ningún video. Empezá con “Nuevo video”.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-3">
              <div className="h-12 w-16 shrink-0 overflow-hidden bg-tile">
                {v.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.cover_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-[12rem] flex-1">
                <Link href={`/admin/videos/${v.id}`} className="hover:underline">
                  {v.title}
                </Link>
                <p className="text-mute">
                  {formatPrice(v.price_usd_cents, "USD")} · {formatPrice(v.price_ars_cents, "ARS")}
                </p>
              </div>
              <span className={v.status === "publicado" ? "text-fg" : "text-mute"}>{STATUS[v.status]}</span>
              <div className="flex flex-wrap gap-x-4 text-mute">
                {v.status === "procesando" && (
                  <form action={refreshVideo}>
                    <input type="hidden" name="id" value={v.id} />
                    <button className="link">Actualizar estado</button>
                  </form>
                )}
                {v.status !== "procesando" && (
                  <form action={setVideoStatus}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="status" value={v.status === "publicado" ? "borrador" : "publicado"} />
                    <button className="link">{v.status === "publicado" ? "Ocultar" : "Publicar"}</button>
                  </form>
                )}
                <Link href={`/admin/videos/${v.id}`} className="link">
                  Editar
                </Link>
                {v.status === "publicado" && (
                  <Link href={`/v/${v.slug}`} className="link">
                    Ver
                  </Link>
                )}
                <form action={removeVideo}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className="link hover:!text-[#ff8a7a]">Borrar</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 max-w-[40rem] text-[0.8rem] text-dim">
        Un video con ventas no se borra (los compradores perderían el acceso): al borrarlo solo se oculta de la tienda.
      </p>
    </>
  );
}
