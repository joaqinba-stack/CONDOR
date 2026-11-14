import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProtectedPlayer } from "@/components/ProtectedPlayer";
import { Shell } from "@/components/Shell";
import { signedEmbedUrl } from "@/lib/bunny";
import { bunnyEnabled, env } from "@/lib/env";
import { dict, getLocale, videoDescription, videoTitle } from "@/lib/i18n";
import { getSessionEmail, isAdminEmail } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * Página del video comprado. El control de acceso se hace acá, en el servidor:
 * sin sesión o sin compra registrada nunca se genera la URL del video.
 */
export default async function Watch({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const email = await getSessionEmail();
  if (!email) redirect(`/ingresar?next=/ver/${encodeURIComponent(slug)}`);

  const store = getStore();
  const video = await store.getVideoBySlug(slug);
  if (!video) notFound();

  const locale = await getLocale();
  const t = dict(locale);
  const allowed = isAdminEmail(email) || (await store.hasEntitlement(email, video.id));
  const title = videoTitle(video, locale);

  if (!allowed) {
    return (
      <Shell>
        <main className="reveal grid grid-cols-1 px-4 pt-[18vh] md:grid-cols-12 md:px-5">
          <div className="max-w-[26rem] space-y-4 md:col-span-4 md:col-start-5">
            <p>{t.no_access}</p>
            {video.status === "publicado" && (
              <Link href={`/v/${video.slug}`} className="btn">
                {t.buy}
              </Link>
            )}
          </div>
        </main>
      </Shell>
    );
  }

  const embedUrl = video.bunny_video_id && bunnyEnabled() ? signedEmbedUrl(video.bunny_video_id) : undefined;
  const demoSrc = !embedUrl && env.isDemo ? (video.trailer_url ?? undefined) : undefined;
  const ratio = (video.width || 16) / (video.height || 9);

  return (
    <Shell>
      <main className="px-4 pb-24 pt-8 md:px-5">
        <div
          className="reveal relative mx-auto w-full overflow-hidden bg-black"
          style={{ aspectRatio: String(ratio), maxWidth: `calc((100dvh - 11rem) * ${ratio})` }}
        >
          {embedUrl || demoSrc ? (
            <ProtectedPlayer embedUrl={embedUrl} demoSrc={demoSrc} title={title} />
          ) : (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-mute">{t.processing}</p>
          )}
        </div>
        <div className="reveal mx-auto mt-6 max-w-[44rem]" style={{ "--i": 2 } as React.CSSProperties}>
          <h1 className="font-medium">{title}</h1>
          <p className="mt-2 whitespace-pre-line text-mute">{videoDescription(video, locale)}</p>
          <p className="mt-6">
            <Link href="/biblioteca" className="link">
              ← {t.nav_library}
            </Link>
          </p>
        </div>
      </main>
    </Shell>
  );
}
