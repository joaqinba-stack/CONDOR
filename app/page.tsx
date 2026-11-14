import Link from "next/link";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Shell } from "@/components/Shell";
import { toTile } from "@/lib/catalog";
import { getCountry, preferredCurrency } from "@/lib/geo";
import { dict, getLocale } from "@/lib/i18n";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ etiqueta?: string }> }) {
  const locale = await getLocale();
  const t = dict(locale);
  const currency = preferredCurrency(await getCountry());
  const tag = (await searchParams).etiqueta?.slice(0, 40) || undefined;
  const videos = await getStore().listPublishedVideos(tag);

  return (
    <Shell variant="full">
      <main className="px-2 pb-2 pt-[22vh] md:pt-[30vh]">
        {tag && (
          <p className="reveal flex gap-4 px-2 pb-6 md:px-3">
            <span>
              <span className="text-mute">{t.tag_filter}:</span> #{tag} <span className="text-dim">({videos.length})</span>
            </span>
            <Link href="/" className="link">
              {t.see_all}
            </Link>
          </p>
        )}
        {videos.length === 0 ? (
          <p className="px-2 pb-40 text-mute md:px-3">{t.empty}</p>
        ) : (
          <MasonryGrid tiles={videos.map((v) => toTile(v, locale, { currency }))} />
        )}
      </main>
    </Shell>
  );
}
