import { notFound } from "next/navigation";
import { VideoForm } from "@/components/admin/VideoForm";
import { bunnyEnabled, bunnyTrailersEnabled } from "@/lib/env";
import { getStore } from "@/lib/store";

export default async function EditVideo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const v = await store.getVideoById(id);
  if (!v) notFound();
  const rate = Number((await store.getSetting("usd_ars_rate")) ?? 0);

  return (
    <>
      <h1 className="mb-10">Editar: {v.title}</h1>
      <VideoForm
        rate={rate}
        uploadsEnabled={bunnyEnabled()}
        trailersEnabled={bunnyTrailersEnabled()}
        initial={{
          id: v.id,
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
        }}
      />
    </>
  );
}
