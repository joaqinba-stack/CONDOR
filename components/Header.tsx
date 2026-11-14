import Link from "next/link";
import { env } from "@/lib/env";
import { dict, getLocale } from "@/lib/i18n";
import { getSessionEmail, isAdminEmail } from "@/lib/session";
import { NavLinks, type NavItem } from "./NavLinks";

/**
 * `full`: cabecera de la home (marca / navegación en columna / texto de presentación).
 * `compact`: resto de las páginas.
 */
export async function Header({ variant = "compact" }: { variant?: "full" | "compact" }) {
  const locale = await getLocale();
  const t = dict(locale);
  const email = await getSessionEmail();

  const items: NavItem[] = [
    { href: "/", label: t.nav_videos },
    { href: "/sobre", label: t.nav_about },
    ...(env.contactEmail
      ? [{ href: `mailto:${env.contactEmail}`, label: t.nav_contact, external: true }]
      : []),
    email ? { href: "/biblioteca", label: t.nav_library } : { href: "/ingresar", label: t.nav_login },
    ...(isAdminEmail(email) ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const other = locale === "es" ? "en" : "es";
  const extras = (
    <div className={variant === "full" ? "mt-3 flex flex-col items-start" : "flex gap-5"}>
      <a href={`/api/lang?l=${other}`} className="link uppercase" aria-label="Idioma / Language">
        {other}
      </a>
      {email && (
        <form action="/salir" method="post">
          <button type="submit" className="link">
            {t.nav_logout}
          </button>
        </form>
      )}
    </div>
  );

  if (variant === "full") {
    return (
      <header className="reveal grid grid-cols-2 gap-x-5 gap-y-8 px-4 pt-4 md:grid-cols-12 md:px-5">
        <Link href="/" className="col-span-2 md:col-span-4">
          {env.siteName}
        </Link>
        <nav className="col-span-1 md:col-span-3 md:col-start-5">
          <NavLinks items={items} vertical />
          {extras}
        </nav>
        <div className="col-span-2 max-w-[34rem] space-y-4 md:col-span-4 md:col-start-9">
          <p>{t.intro}</p>
          <p className="text-mute">{t.intro_2}</p>
        </div>
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2 px-4 pt-4 md:px-5">
      <Link href="/">{env.siteName}</Link>
      <nav className="flex flex-wrap gap-x-5 gap-y-1">
        <NavLinks items={items} />
        {extras}
      </nav>
    </header>
  );
}
