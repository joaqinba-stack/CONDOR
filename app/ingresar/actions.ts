"use server";

import { sendLoginEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { isEmail, normalizeEmail } from "@/lib/format";
import { getLocale } from "@/lib/i18n";
import { createLoginLink, safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";

export interface LoginState {
  status: "idle" | "sent" | "wait" | "invalid" | "error";
  /** Solo en modo demo: link directo, porque no se envían emails. */
  demoLink?: string;
}

export async function requestLogin(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const next = safeNext(String(form.get("next") ?? ""));
  if (!isEmail(email)) return { status: "invalid" };

  try {
    // Freno anti-abuso: un link por minuto y cinco por hora para cada email.
    const store = getStore();
    const lastMinute = await store.countLoginTokensSince(email, new Date(Date.now() - 60_000));
    const lastHour = await store.countLoginTokensSince(email, new Date(Date.now() - 3600_000));
    if (lastMinute >= 1 || lastHour >= 5) return { status: "wait" };

    if (env.isDemo) return { status: "sent", demoLink: await createLoginLink(email, next, 30) };

    await sendLoginEmail(email, next, await getLocale());
    return { status: "sent" };
  } catch (err) {
    console.error("[login]", err);
    return { status: "error" };
  }
}
