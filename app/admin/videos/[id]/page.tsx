import { notFound } from "next/navigation";
import { VideoForm } from "@/components/admin/VideoForm";
import { bunnyEnabled, bunnyTrailersEnabled } from "@/lib/env";
import { photosEnabled, signPhotos } from "@/lib/photos";
import { getStore } from "@/lib/store";
import { removePhoto } from "../../actions";

export default async function EditVideo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const v = await store.getVideoById(id);
  if (!v) notFound();
  const rate = Number((await store.getSetting("usd_ars_rate")) ?? 0);
  const photos = v.kind === "fotos" ? await signPhotos(await store.listImages(v.id), 600) : [];

  return (
    <>
      <h1 className="mb-10">Editar: {v.title}</h1>

      {v.kind === "fotos" && (
        <section className="mb-12 max-w-[40rem]">
          <p className="text-mute">Fotos cargadas ({photos.length})</p>
          {photos.length > 0 && (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <li key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="aspect-square w-full bg-tile object-cover" />
                  <form action={removePhoto} className="mt-1">
                    <input type="hidden" name="image_id" value={p.id} />
                    <button className="link text-[0.8rem] hover:!text-[#ff8a7a]">Quitar</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <VideoForm
        rate={rate}
        uploadsEnabled={bunnyEnabled()}
        trailersEnabled={bunnyTrailersEnabled()}
        photosEnabled={photosEnabled()}
        initial={{
          id: v.id,
          kind: v.kind,
          title: v.title,
          description: v.description,
          title_en: v.title_en,
          description_en: v.description_en,
          price_usd: String(v.price_usd_cents / 100),
          price_ars: String(v.price_ars_cents / 100),
          publish_when_ready: v.publish_when_ready,
          hasFull: !!v.bunny_video_id,
          hasTrailer: !!v.trailer_video_id || !!v.trailer_url,
          cover_url: v.cover_url,
          photoCount: v.image_count,
        }}
      />
    </>
  );
}
