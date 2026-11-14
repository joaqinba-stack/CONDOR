import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { dict, getLocale } from "@/lib/i18n";
import { consumeLoginToken, safeNext, startSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false }, referrer: "no-referrer" };

type Props = { searchParams: Promise<{ token?: string; next?: string; e?: string }> };

/**
 * Destino del link de acceso. El token se consume recién al apretar el botón (POST),
 * así los antivirus y previsualizadores de email que abren el link no lo gastan.
 */
export default async function Confirm({ searchParams }: Props) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const next = safeNext(sp.next);
  const t = dict(await getLocale());

  async function confirm() {
    "use server";
    const email = await consumeLoginToken(token);
    if (!email) redirect(`/auth/confirm?e=1&next=${encodeURIComponent(next)}`);
    await startSession(email);
    redirect(next);
  }

  return (
    <Shell>
      <main className="reveal grid grid-cols-1 px-4 pt-[18vh] md:grid-cols-12 md:px-5">
        <div className="max-w-[26rem] space-y-5 md:col-span-4 md:col-start-5">
          {sp.e || !token ? (
            <>
              <p>{t.confirm_invalid}</p>
              <Link href={`/ingresar?next=${encodeURIComponent(next)}`} className="btn btn-ghost">
                {t.nav_login}
              </Link>
            </>
          ) : (
            <>
              <h1>{t.confirm_title}</h1>
              <form action={confirm}>
                <button className="btn">{t.confirm_button}</button>
              </form>
            </>
          )}
        </div>
      </main>
    </Shell>
  );
}
