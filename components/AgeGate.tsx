import { env } from "@/lib/env";
import type { Dict } from "@/lib/i18n";

/**
 * Aviso de mayoría de edad. Se muestra EN LUGAR de la página (desde el servidor): hasta que se
 * confirma no se envía ninguna imagen ni video. Es un aviso, no una verificación de identidad.
 */
export function AgeGate({ t }: { t: Pick<Dict, "age_title" | "age_text" | "age_yes" | "age_no"> }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-[28rem] space-y-6 text-center">
        <p>{env.siteName}</p>
        <h1 className="text-[1.6rem] leading-tight font-medium tracking-tight">{t.age_title}</h1>
        <p className="text-mute">{t.age_text}</p>
        <div className="flex flex-wrap justify-center gap-2.5 pt-2">
          <form action="/api/edad" method="post">
            <button type="submit" className="btn">
              {t.age_yes}
            </button>
          </form>
          <a href="https://www.google.com" rel="noreferrer" className="btn btn-ghost">
            {t.age_no}
          </a>
        </div>
      </div>
    </main>
  );
}
