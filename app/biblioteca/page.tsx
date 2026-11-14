import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MasonryGrid } from "@/components/MasonryGrid";
import { Shell } from "@/components/Shell";
import { toTile } from "@/lib/catalog";
import { dict, getLocale } from "@/lib/i18n";
import { getSessionEmail } from "@/lib/session";
import { getStore } from "@/lib/store";
import type { Video } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLocale()).library_title, robots: { index: false } };
}

export default async function Library() {
  const email = await getSessionEmail();
  if (!email) redirect("/ingresar?next=/biblioteca");
  const locale = await getLocale();
  const t = dict(locale);
  const store = getStore();

  const ents = await store.listEntitlements(email);
  const videos = (await Promise.all(ents.map((e) => store.getVideoById(e.video_id)))).filter(
    (v): v is Video => v !== null,
  );

  return (
    <Shell>
      <main className="px-2 pb-2 pt-[12vh]">
        <div className="reveal px-2 pb-10 md:px-3">
          <h1>{t.library_title}</h1>
          <p className="text-mute">{email}</p>
        </div>
        {videos.length === 0 ? (
          <div className="reveal space-y-4 px-2 pb-40 md:px-3">
            <p className="text-mute">{t.library_empty}</p>
            <Link href="/" className="btn btn-ghost">
              {t.library_browse}
            </Link>
          </div>
        ) : (
          <MasonryGrid tiles={videos.map((v) => ({ ...toTile(v, locale, { href: `/ver/${v.slug}` }), meta: t.watch_now }))} />
        )}
      </main>
    </Shell>
  );
}
