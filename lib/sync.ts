import { getBunnyVideo, trailerUrls } from "./bunny";
import { bunnyEnabled, bunnyTrailersEnabled, env } from "./env";
import { getStore } from "./store";
import type { Video, VideoInput } from "./types";

const BUNNY_FINISHED = 4;

/**
 * Trae de Bunny el estado del video completo y del tráiler y actualiza la ficha:
 * proporción, duración, portada, URL del tráiler y (si corresponde) lo publica.
 */
export async function syncVideoFromBunny(video: Video): Promise<Video> {
  const patch: Partial<VideoInput> = {};
  let fullReady = !video.bunny_video_id ? false : null;
  let trailerReady: boolean | null = video.trailer_video_id ? null : true;

  if (video.bunny_video_id && bunnyEnabled()) {
    const info = await getBunnyVideo("full", video.bunny_video_id);
    fullReady = info?.status === BUNNY_FINISHED;
    if (info && fullReady) {
      if (info.width && info.height) {
        patch.width = info.width;
        patch.height = info.height;
      }
      patch.duration_seconds = info.length ?? 0;
    }
  }

  if (video.trailer_video_id && bunnyTrailersEnabled()) {
    const info = await getBunnyVideo("trailer", video.trailer_video_id);
    trailerReady = info?.status === BUNNY_FINISHED;
    if (info && trailerReady) {
      const urls = trailerUrls(video.trailer_video_id, info);
      patch.trailer_url = urls.mp4;
      // No pisa una portada subida a mano (esas no viven en el CDN de tráilers).
      const auto = !video.cover_url || (env.bunnyTrailerCdnHost && video.cover_url.includes(env.bunnyTrailerCdnHost));
      if (auto && urls.cover) patch.cover_url = urls.cover;
    }
  }

  if (video.status === "procesando" && fullReady && trailerReady) {
    patch.status = video.publish_when_ready ? "publicado" : "borrador";
  }

  if (Object.keys(patch).length === 0) return video;
  return (await getStore().updateVideo(video.id, patch)) ?? video;
}
