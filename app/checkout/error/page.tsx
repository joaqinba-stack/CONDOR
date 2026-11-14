import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { dict, getLocale } from "@/lib/i18n";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function CheckoutError({ searchParams }: { searchParams: Promise<{ orden?: string }> }) {
  const { orden } = await searchParams;
  const t = dict(await getLocale());
  const store = getStore();
  const order = orden ? await store.getOrder(orden) : null;
  const video = order ? await store.getVideoById(order.video_id) : null;

  return (
    <Shell>
      <main className="reveal grid grid-cols-1 px-4 pt-[18vh] md:grid-cols-12 md:px-5">
        <div className="max-w-[30rem] space-y-4 md:col-span-5 md:col-start-5">
          <h1>{t.ok_failed_title}</h1>
          <p className="text-mute">{t.ok_failed}</p>
          <p className="pt-4">
            <Link href={video ? `/v/${video.slug}` : "/"} className="btn btn-ghost">
              {video ? t.try_again : t.back_home}
            </Link>
          </p>
        </div>
      </main>
    </Shell>
  );
}
