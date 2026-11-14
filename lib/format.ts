import type { Currency } from "./types";

export function formatPrice(cents: number, currency: Currency): string {
  const value = cents / 100;
  if (currency === "ARS") {
    return `$ ${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS`;
  }
  return `US$ ${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "video"
  );
}

export const normalizeEmail = (s: string) => s.trim().toLowerCase();

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 254;

/** "juan@gmail.com" → "j***@gmail.com" */
export function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  return `${u.slice(0, 1)}***@${d}`;
}
