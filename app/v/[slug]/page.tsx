import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyPanel } from "@/components/BuyPanel";
import { LoopVideo } from "@/components/LoopVideo";
import { Shell } from "@/components/Shell";
import { formatPrice } from "@/lib/format";
import { getCountry, preferredCurrency } from "@/lib/geo";
import { dict, getLocale, kindLabel, videoDescription, videoTitle } from "@/lib/i18n";
import { getSessionEmail, isAdminEmail } from "@/lib/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const video = await getStore().getVideoBySlug(slug);
  return video && video.status === "publicado" ? video : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const video = await load(slug);
  if (!video) return {};
  const locale = await getLocale();
  return {
    title: videoTitle(video, locale),
    description: videoDescription(video, locale).slice(0, 160),
    openGraph: video.cover_url ? { images: [video.cover_url] } : undefined,
  };
}

export default async function VideoPage({ params }: Props) {
  const { slug } = await params;
  const video = await load(slug);
  if (!video) notFound();

  const locale = await getLocale();
  const t = dict(locale);
  const email = await getSessionEmail();
  const owned = email ? isAdminEmail(email) || (await getStore().hasEntitlement(email, video.id)) : false;

  const ars = { provider: "mercadopago" as const, price: formatPrice(video.price_ars_cents, "ARS") };
  const usd = { provider: "paypal" as const, price: formatPrice(video.price_usd_cents, "USD") };
  const currency = preferredCurrency(await getCountry());
  const options = currency === "ARS" ? [ars, usd] : [usd, ars];

  const title = videoTitle(video, locale);
  const description = videoDescription(video, locale);

  return (
    <Shell>
      <main className="grid grid-cols-1 gap-x-5 gap-y-10 px-4 pb-24 pt-6 md:grid-cols-12 md:px-5 md:pt-8">
        <div className="reveal md:col-span-4 lg:col-span-3">
          <div className="max-w-[26rem] md:sticky md:top-8">
            <h1 className="font-medium">{title}</h1>
            <p className="text-mute">
              {options[0].price} · {kindLabel(video, t)}
            </p>
            {description && <p className="mt-5 whitespace-pre-line text-mute">{description}</p>}

            <div className="mt-10">
              {owned ? (
                <div className="space-y-3">
                  <p className="text-mute">{t.owned}</p>
                  <Link href={`/ver/${video.slug}`} className="btn">
                    {t.watch_now}
                  </Link>
                </div>
              ) : (
                <BuyPanel slug={video.slug} options={options} initialEmail={email ?? ""} t={t} />
              )}
            </div>
          </div>
        </div>

        <div className="reveal order-first md:order-none md:col-span-8 lg:col-span-7 lg:col-start-5" style={{ "--i": 2 } as React.CSSProperties}>
          <div
            className="relative mx-auto w-full overflow-hidden bg-tile"
            style={{
              aspectRatio: `${video.width || 16} / ${video.height || 9}`,
              maxWidth: `calc((100dvh - 6rem) * ${(video.width || 16) / (video.height || 9)})`,
            }}
          >
            {video.trailer_url ? (
              <LoopVideo src={video.trailer_url} poster={video.cover_url} />
            ) : (
              video.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.cover_url} alt={title} className="absolute inset-0 h-full w-full object-cover" />
              )
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}
