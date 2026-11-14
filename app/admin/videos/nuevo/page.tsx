import { VideoForm } from "@/components/admin/VideoForm";
import { bunnyEnabled, bunnyTrailersEnabled } from "@/lib/env";
import { photosEnabled } from "@/lib/photos";
import { getStore } from "@/lib/store";

export default async function NewVideo() {
  const rate = Number((await getStore().getSetting("usd_ars_rate")) ?? 0);
  return (
    <>
      <h1 className="mb-10">Nuevo producto</h1>
      <VideoForm rate={rate} uploadsEnabled={bunnyEnabled()} trailersEnabled={bunnyTrailersEnabled()} photosEnabled={photosEnabled()} />
    </>
  );
}
