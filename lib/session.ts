import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hmacBase64Url, randomToken, safeEqual, sha256Hex } from "./crypto";
import { env } from "./env";
import { normalizeEmail } from "./format";
import { getStore } from "./store";

const COOKIE = "condor_session";
const SESSION_DAYS = 60;

/** Cookie firmada: base64url(json).firma — sin datos sensibles, solo el email y el vencimiento. */
export function signSession(email: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ e: normalizeEmail(email), x: now + SESSION_DAYS * 86400_000 }),
  ).toString("base64url");
  return `${payload}.${hmacBase64Url(env.sessionSecret, payload)}`;
}

export function verifySession(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  if (!safeEqual(sig, hmacBase64Url(env.sessionSecret, payload))) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof e !== "string" || typeof x !== "number" || x < now) return null;
    return e;
  } catch {
    return null;
  }
}

export async function getSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
}

export async function startSession(email: string) {
  const jar = await cookies();
  jar.set(COOKIE, signSession(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function isAdminEmail(email: string | null): boolean {
  if (!email) return false;
  return env.adminEmails.includes(email);
}

/** Corta la request si no hay un admin logueado. Usar en páginas y acciones de /admin. */
export async function requireAdmin(): Promise<string> {
  const email = await getSessionEmail();
  if (!email) redirect("/ingresar?next=/admin");
  if (!isAdminEmail(email)) redirect("/");
  return email;
}

/**
 * Crea un link de acceso de un solo uso. En la base se guarda solo el hash del token.
 * `ttlMinutes`: 30 para logins pedidos a mano, más largo para el email de compra.
 */
export async function createLoginLink(email: string, next: string, ttlMinutes = 30): Promise<string> {
  const token = randomToken();
  await getStore().createLoginToken(
    normalizeEmail(email),
    sha256Hex(token),
    new Date(Date.now() + ttlMinutes * 60_000),
  );
  const q = new URLSearchParams({ token, next });
  return `${env.siteUrl}/auth/confirm?${q}`;
}

export async function consumeLoginToken(token: string): Promise<string | null> {
  if (!token || token.length > 200) return null;
  return getStore().consumeLoginToken(sha256Hex(token));
}

/** Solo permite redirecciones internas ("/algo"), nunca a otro dominio. */
export function safeNext(next: string | null | undefined, fallback = "/biblioteca"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
