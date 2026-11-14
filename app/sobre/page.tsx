import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import { env } from "@/lib/env";
import { dict, getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLocale()).about_title };
}

export default async function About() {
  const t = dict(await getLocale());
  return (
    <Shell>
      <main className="reveal grid grid-cols-1 gap-x-5 gap-y-10 px-4 pb-24 pt-[18vh] md:grid-cols-12 md:px-5">
        <div className="max-w-[34rem] space-y-4 md:col-span-4 md:col-start-5">
          <p>{t.about_text}</p>
          {env.contactEmail && (
            <p>
              <a href={`mailto:${env.contactEmail}`} className="link">
                {env.contactEmail}
              </a>
            </p>
          )}
        </div>
        <div className="max-w-[34rem] md:col-span-4 md:col-start-9">
          <p className="text-mute">{t.about_how}</p>
          <ol className="mt-4 space-y-3">
            {[t.about_how_1, t.about_how_2, t.about_how_3].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="text-dim">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </Shell>
  );
}
