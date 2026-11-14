import { headers } from "next/headers";
import type { Currency, Video } from "./types";

/** País del visitante según el hosting (Vercel / Cloudflare). Null si no se sabe. */
export async function getCountry(): Promise<string | null> {
  const h = await headers();
  const c = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry");
  if (c && /^[A-Z]{2}$/i.test(c)) return c.toUpperCase();
  // Sin dato de país: si el navegador está en español rioplatense o genérico, asumimos Argentina.
  const accept = h.get("accept-language")?.toLowerCase() ?? "";
  if (accept.startsWith("es-ar") || accept.startsWith("es,") || accept === "es" || accept === "") return "AR";
  return null;
}

export const preferredCurrency = (country: string | null): Currency => (country === "AR" ? "ARS" : "USD");

export const priceFor = (v: Video, currency: Currency) =>
  currency === "ARS" ? v.price_ars_cents : v.price_usd_cents;
