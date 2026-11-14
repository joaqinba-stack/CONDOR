import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Shell } from "@/components/Shell";
import { dict, getLocale } from "@/lib/i18n";
import { getSessionEmail, safeNext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLocale()).login_title, robots: { index: false } };
}

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getSessionEmail()) redirect(next);
  const t = dict(await getLocale());

  return (
    <Shell>
      <main className="reveal grid grid-cols-1 px-4 pt-[18vh] md:grid-cols-12 md:px-5">
        <div className="max-w-[26rem] space-y-6 md:col-span-4 md:col-start-5">
          <div className="space-y-2">
            <h1>{t.login_title}</h1>
            <p className="text-mute">{t.login_text}</p>
          </div>
          <LoginForm next={next} initialEmail={(sp.email ?? "").slice(0, 254)} t={t} />
        </div>
      </main>
    </Shell>
  );
}
