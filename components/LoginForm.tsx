"use client";

import { useActionState } from "react";
import { requestLogin, type LoginState } from "@/app/ingresar/actions";
import type { Dict } from "@/lib/i18n";

export function LoginForm({
  next,
  initialEmail,
  t,
}: {
  next: string;
  initialEmail: string;
  t: Pick<Dict, "your_email" | "login_send" | "login_sent" | "login_wait" | "invalid_email" | "generic_error">;
}) {
  const [state, action, pending] = useActionState<LoginState, FormData>(requestLogin, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="space-y-4">
        <p>{t.login_sent}</p>
        {state.demoLink && (
          <p>
            <a href={state.demoLink} className="btn">
              Modo demo: entrar sin email
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-mute">{t.your_email}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="nombre@email.com"
          defaultValue={initialEmail}
          className="field"
        />
      </label>
      <button type="submit" disabled={pending} className="btn">
        {t.login_send}
      </button>
      <p aria-live="polite" className="min-h-[1.2em] text-[0.8rem] text-[#ff8a7a]">
        {state.status === "invalid" && t.invalid_email}
        {state.status === "wait" && t.login_wait}
        {state.status === "error" && t.generic_error}
      </p>
    </form>
  );
}
