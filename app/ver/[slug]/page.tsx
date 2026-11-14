import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ProtectedPlayer } from "@/components/ProtectedPlayer";
import { Shell } from "@/components/Shell";
import { getProductAccess } from "@/lib/access";
import { dict, getLocale, videoDescription, videoTitle } from "@/lib/i18n";
import { getSessionEmail } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * Página del contenido comprado (video o fotos). El control de acceso se hace en el servidor,
 * en getProductAccess: sin sesión o sin compra registrada nunca se generan las URLs.
 */
export default async function Watch({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const email = await getSessionEmail();
  if (!email) redirect(`/ingresar?next=/ver/${encodeURIComponent(slug)}`);

  const access = await getProductAccess(email, slug);
  if (access.status === "not_found") notFound();

  const locale = await getLocale();
  const t = dict(locale);
  const { video } = access;
  const title = videoTitle(video, locale);

  if (access.status === "forbidden") {
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

  const ratio = (video.width || 16) / (video.height || 9);
  const playable = access.embedUrl || access.demoSrc;

  return (
    <Shell>
      <main className="px-4 pb-24 pt-8 md:px-5">
        {video.kind === "fotos" ? (
          <PhotoGallery photos={access.photos} title={title} />
        ) : (
          <div
            className="reveal relative mx-auto w-full overflow-hidden bg-black"
            style={{ aspectRatio: String(ratio), maxWidth: `calc((100dvh - 11rem) * ${ratio})` }}
          >
            {playable ? (
              <ProtectedPlayer embedUrl={access.embedUrl} demoSrc={access.demoSrc} title={title} />
            ) : (
              <p className="absolute inset-0 grid place-items-center px-6 text-center text-mute">{t.processing}</p>
            )}
          </div>
        )}
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
