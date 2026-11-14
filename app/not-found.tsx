import Link from "next/link";
import { Shell } from "@/components/Shell";
import { dict, getLocale } from "@/lib/i18n";

export default async function NotFound() {
  const t = dict(await getLocale());
  return (
    <Shell>
      <main className="px-4 pt-[22vh] md:px-5">
        <p>{t.not_found}</p>
        <Link href="/" className="link">
          {t.back_home}
        </Link>
      </main>
    </Shell>
  );
}
