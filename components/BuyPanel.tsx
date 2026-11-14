"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

type Provider = "mercadopago" | "paypal";

interface Option {
  provider: Provider;
  price: string;
}

export function BuyPanel({
  slug,
  options,
  initialEmail,
  t,
}: {
  slug: string;
  /** Ordenadas: primero la sugerida según el país del visitante. */
  options: Option[];
  initialEmail: string;
  t: Pick<
    Dict,
    | "buy_with_mp"
    | "buy_with_paypal"
    | "pay_ars"
    | "pay_usd"
    | "your_email"
    | "email_hint"
    | "redirecting"
    | "invalid_email"
    | "generic_error"
    | "provider_off"
    | "secure_note"
    | "owned"
    | "nav_login"
  >;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);

  async function pay(provider: Provider) {
    setError(null);
    setOwned(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(t.invalid_email);
      return;
    }
    setBusy(provider);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email.trim(), provider }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.error === "owned") setOwned(true);
      else if (data.error === "provider_off") setError(t.provider_off);
      else if (data.error === "invalid_email") setError(t.invalid_email);
      else setError(t.generic_error);
    } catch {
      setError(t.generic_error);
    }
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-mute">{t.your_email}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nombre@email.com"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <span className="mt-1.5 block text-[0.8rem] text-dim">{t.email_hint}</span>
      </label>

      <div className="space-y-2.5">
        {options.map((o, i) => (
          <button
            key={o.provider}
            type="button"
            disabled={busy !== null}
            onClick={() => pay(o.provider)}
            className={`btn w-full justify-between ${i === 0 ? "" : "btn-ghost"}`}
          >
            <span>
              {busy === o.provider ? t.redirecting : o.provider === "mercadopago" ? t.buy_with_mp : t.buy_with_paypal}
            </span>
            <span className={i === 0 ? "opacity-60" : "text-mute"}>{o.price}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="min-h-[1.2em] text-[0.8rem]">
        {error && <p className="text-[#ff8a7a]">{error}</p>}
        {owned && (
          <p className="text-fg">
            {t.owned}.{" "}
            <Link href={`/ingresar?next=/ver/${slug}&email=${encodeURIComponent(email.trim())}`} className="underline">
              {t.nav_login}
            </Link>
          </p>
        )}
        {!error && !owned && <p className="text-dim">{t.secure_note}</p>}
      </div>
    </div>
  );
}
