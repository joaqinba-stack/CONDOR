import { BulkUpload } from "@/components/admin/BulkUpload";
import { ImportCatalog } from "@/components/admin/ImportCatalog";
import { bunnyEnabled, bunnyTrailersEnabled, env } from "@/lib/env";
import { getStore } from "@/lib/store";

export default async function ImportPage() {
  const videos = await getStore().listAllVideos();
  const pending = videos
    .filter((v) => v.kind === "video" && !v.bunny_video_id)
    .map((v) => ({ id: v.id, title: v.title, manyvids_id: v.manyvids_id }));

  return (
    <>
      <h1 className="mb-3">Importar</h1>
      <p className="mb-12 max-w-[44rem] text-mute">
        Dos pasos: primero se crea el catálogo (texto, precios, etiquetas, portada y adelanto) y después se suben los
        videos completos desde la computadora. Cada producto se publica solo cuando su video completo terminó de
        procesarse.
      </p>

      <section className="max-w-[44rem]">
        <h2>1. Importar catálogo</h2>
        <p className="mt-1 text-mute">
          Elegí el archivo <code>catalogo.json</code>. Los productos que ya estén importados no se repiten.
          {(!bunnyTrailersEnabled() || env.isDemo) && " Sin Bunny y la base configurados se crea solo el texto (sin portada ni adelanto)."}
        </p>
        <div className="mt-6">
          <ImportCatalog />
        </div>
      </section>

      <section className="mt-20 max-w-[44rem]">
        <h2>2. Subir los videos completos</h2>
        <p className="mt-1 text-mute">
          Elegí varios archivos a la vez. Cada uno se asocia a su producto por el nombre: si el nombre del archivo
          tiene el número de ManyVids del video (por ejemplo <code>7893201.mov</code>) o un nombre parecido al título.
          Antes de subir se muestra la lista para revisar.
        </p>
        <div className="mt-6">
          <BulkUpload products={pending} enabled={bunnyEnabled()} />
        </div>
      </section>
    </>
  );
}
