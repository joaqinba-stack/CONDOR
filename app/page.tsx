import { MasonryGrid } from "@/components/MasonryGrid";
import { Shell } from "@/components/Shell";
import { toTile } from "@/lib/catalog";
import { getCountry, preferredCurrency } from "@/lib/geo";
import { dict, getLocale } from "@/lib/i18n";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const locale = await getLocale();
  const t = dict(locale);
  const currency = preferredCurrency(await getCountry());
  const videos = await getStore().listPublishedVideos();

  return (
    <Shell variant="full">
      <main className="px-2 pb-2 pt-[22vh] md:pt-[30vh]">
        {videos.length === 0 ? (
          <p className="px-2 pb-40 text-mute md:px-3">{t.empty}</p>
        ) : (
          <MasonryGrid tiles={videos.map((v) => toTile(v, locale, { currency }))} />
        )}
      </main>
    </Shell>
  );
}
