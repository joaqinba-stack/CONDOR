import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { env } from "@/lib/env";
import { dict, getLocale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = dict(await getLocale());
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: env.siteName, template: `%s — ${env.siteName}` },
    description: t.intro,
    openGraph: { siteName: env.siteName, type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = dict(locale);
  return (
    <html lang={locale}>
      <body>
        {env.isDemo && (
          <div data-demo-banner className="bg-tile px-4 py-1.5 text-center text-[0.75rem] text-mute md:px-5">{t.demo_banner}</div>
        )}
        {children}
      </body>
    </html>
  );
}
