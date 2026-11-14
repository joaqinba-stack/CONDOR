import { signedEmbedUrl } from "./bunny";
import { bunnyEnabled, env } from "./env";
import { signPhotos, type SignedPhoto } from "./photos";
import { isAdminEmail } from "./session";
import { getStore } from "./store";
import { demoFullVideo } from "./store/fixtures";
import type { Video } from "./types";

export type ProductAccess =
  | { status: "not_found" }
  | { status: "forbidden"; video: Video }
  | { status: "ok"; video: Video; embedUrl?: string; demoSrc?: string; photos: SignedPhoto[] };

/**
 * Único lugar donde se decide si alguien puede ver un producto y se generan las URLs
 * del contenido. Sin compra registrada (o sin ser admin) no se firma nada.
 */
export async function getProductAccess(email: string | null, slug: string): Promise<ProductAccess> {
  const store = getStore();
  const video = await store.getVideoBySlug(slug);
  if (!video) return { status: "not_found" };

  const allowed = !!email && (isAdminEmail(email) || (await store.hasEntitlement(email, video.id)));
  if (!allowed) return { status: "forbidden", video };

  if (video.kind === "fotos") {
    return { status: "ok", video, photos: await signPhotos(await store.listImages(video.id)) };
  }

  const embedUrl = video.bunny_video_id && bunnyEnabled() ? signedEmbedUrl(video.bunny_video_id) : undefined;
  const demoSrc = !embedUrl && env.isDemo ? (demoFullVideo[video.slug] ?? video.trailer_url ?? undefined) : undefined;
  return { status: "ok", video, embedUrl, demoSrc, photos: [] };
}
